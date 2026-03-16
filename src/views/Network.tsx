"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import Papa from "papaparse";
import "./Network.css";
import { createClient } from "../lib/supabase/client";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../hooks/useToast";
import CompanyLogo from "../components/CompanyLogo";
import api from "../api/client";

type LinkedInRow = {
  first_name: string;
  last_name: string;
  email: string;
  company: string;
  position: string;
  connected_on: string;
  linkedin_url: string;
};

type SortCol = "first_name" | "company" | "position" | "email" | "connected_on";

type Connection = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  company: string | null;
  position: string | null;
  connected_on: string | null;
  linkedin_url: string | null;
};

type NetworkStats = {
  total: number;
  withEmail: number;
  uniqueCompanies: number;
  matchCount: number;
};

type CrossRefMatch = {
  lead_id: string;
  lead_title: string;
  lead_company: string;
  lead_location: string | null;
  connection_count: number;
  connection_names: string[];
  connection_urls: string[];
  run_at: string;
};

type PlanGroup = {
  company: string;
  leads: CrossRefMatch[];
  preferredLeads: CrossRefMatch[];
  uniqueNames: string[];
  uniqueUrls: string[];
};

type EmailDraft = {
  leadId: string;
  leadTitle: string;
  company: string;
  toNames: string[];
  toName: string;
  toEmail: string;
  from: string;
  subject: string;
  body: string;
};

// Strips common legal suffixes for normalization
function normalizeCompany(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(inc\.?|llc\.?|ltd\.?|corp\.?|co\.?|group|holdings|international)\b/gi, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Converts "01 Mar 2026" → "2026-03-01" for Supabase date column
function parseLinkedInDate(raw: string): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0];
}

// LinkedIn CSV headers — mapped from actual export format
function mapRow(row: Record<string, string>): LinkedInRow {
  return {
    first_name: row["First Name"] || "",
    last_name: row["Last Name"] || "",
    email: row["Email Address"] || "",
    company: row["Company"] || "",
    position: row["Position"] || "",
    connected_on: parseLinkedInDate(row["Connected On"] || "") || "",
    linkedin_url: row["URL"] || "",
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function generateDraftEmail(connectionName: string, company: string): string {
  const namePart = connectionName.split("(")[0].trim();
  const parts = namePart.split(/\s+/).filter(Boolean);
  const first = parts[0]?.toLowerCase() || "";
  const last = parts[1]?.toLowerCase() || "";
  const co = company
    .toLowerCase()
    .replace(/\b(inc|llc|corp|ltd|co|group|holdings|international|technologies|technology|solutions|services|software|systems)\b/gi, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
  return first && last ? `${first}.${last}@${co}.com` : "";
}

function matchesPreferredRole(title: string, roles: string[]): boolean {
  if (!roles.length) return false;
  const t = title.toLowerCase();
  return roles.some((role) => t.includes(role.toLowerCase()));
}

export default function Network() {
  const { user, preferredRoles } = useAuth();
  const { showToast, toastElement } = useToast();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [connections, setConnections] = useState<Connection[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const [sortCol, setSortCol] = useState<SortCol>("company");
  const [sortAsc, setSortAsc] = useState(true);
  const [filterHasEmail, setFilterHasEmail] = useState(false);

  // Stats
  const [stats, setStats] = useState<NetworkStats | null>(null);

  // Active view tab
  const [activeView, setActiveView] = useState<"matches" | "network">("matches");

  // Cross-reference
  const [crossRefMatches, setCrossRefMatches] = useState<CrossRefMatch[]>([]);
  const [crossRefRunAt, setCrossRefRunAt] = useState<string | null>(null);
  const [crossRefLoading, setCrossRefLoading] = useState(false);
  const [crossRefStep, setCrossRefStep] = useState<number>(0);

  // Networking Plan
  const [deselectedRoles, setDeselectedRoles] = useState<Set<string>>(new Set());
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());
  const [showAllMatches, setShowAllMatches] = useState(false);

  // Onboarding modal (first import only)
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);

  // Email compose modal
  const [emailDraft, setEmailDraft] = useState<EmailDraft | null>(null);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  // lead_id → ISO timestamp of when email was sent this session
  const [sentEmails, setSentEmails] = useState<Record<string, string>>({});

  // CSV preview state
  const [preview, setPreview] = useState<LinkedInRow[] | null>(null);
  const [importing, setImporting] = useState(false);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasActiveFilters = filterHasEmail || search.trim().length > 0;
  const roles = preferredRoles || [];

  // activeRoles = preferred roles that haven't been individually deselected
  const activeRoles = roles.filter((r) => !deselectedRoles.has(r));

  function toggleRole(role: string) {
    setDeselectedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  }

  // Derived: group cross-ref matches by company for Networking Plan
  const planGroups = useMemo<PlanGroup[]>(() => {
    const map = new Map<string, PlanGroup>();
    for (const m of crossRefMatches) {
      if (!map.has(m.lead_company)) {
        map.set(m.lead_company, {
          company: m.lead_company,
          leads: [],
          preferredLeads: [],
          uniqueNames: [],
          uniqueUrls: [],
        });
      }
      const g = map.get(m.lead_company)!;
      g.leads.push(m);
      if (matchesPreferredRole(m.lead_title, activeRoles)) {
        g.preferredLeads.push(m);
      }
      for (let i = 0; i < m.connection_names.length; i++) {
        if (!g.uniqueNames.includes(m.connection_names[i])) {
          g.uniqueNames.push(m.connection_names[i]);
          g.uniqueUrls.push(m.connection_urls?.[i] || "");
        }
      }
    }

    const groups = Array.from(map.values());
    const filtered =
      activeRoles.length > 0
        ? groups.filter((g) => g.preferredLeads.length > 0)
        : groups;

    return filtered.sort(
      (a, b) =>
        b.preferredLeads.length - a.preferredLeads.length ||
        b.leads.length - a.leads.length ||
        b.uniqueNames.length - a.uniqueNames.length
    );
  }, [crossRefMatches, activeRoles]);

  async function fetchStats() {
    if (!user) return;

    const [
      { count: totalCount },
      { count: emailCount },
      { data: companyData },
      { count: matchCount },
    ] = await Promise.all([
      supabase.from("linkedin_connections").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("linkedin_connections").select("*", { count: "exact", head: true }).eq("user_id", user.id).not("email", "is", null).neq("email", ""),
      supabase.from("linkedin_connections").select("company_normalized").eq("user_id", user.id).range(0, 9999),
      supabase.from("network_lead_matches").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    ]);

    const uniqueCompanies = new Set(
      (companyData || []).map((r) => r.company_normalized).filter(Boolean)
    ).size;

    setStats({
      total: totalCount || 0,
      withEmail: emailCount || 0,
      uniqueCompanies,
      matchCount: matchCount || 0,
    });
  }

  async function fetchCrossRefMatches() {
    if (!user) return;
    const { data, error } = await supabase
      .from("network_lead_matches")
      .select("lead_id, connection_count, connection_names, connection_urls, run_at, leads(title, company, location)")
      .eq("user_id", user.id)
      .order("connection_count", { ascending: false });

    if (!error && data) {
      const mapped: CrossRefMatch[] = data.map((row: any) => ({
        lead_id: row.lead_id,
        lead_title: row.leads?.title || "",
        lead_company: row.leads?.company || "",
        lead_location: row.leads?.location || null,
        connection_count: row.connection_count,
        connection_names: row.connection_names || [],
        connection_urls: row.connection_urls || [],
        run_at: row.run_at,
      }));
      setCrossRefMatches(mapped);
      if (mapped.length > 0) setCrossRefRunAt(mapped[0].run_at);
    }
  }

  async function runCrossReference(): Promise<boolean> {
    if (!user) return false;
    setCrossRefLoading(true);
    setCrossRefStep(1);
    await sleep(1000);

    // 1. Fetch all user connections including linkedin_url
    const { data: connData, error: connError } = await supabase
      .from("linkedin_connections")
      .select("company_normalized, first_name, last_name, position, linkedin_url")
      .eq("user_id", user.id)
      .range(0, 9999);

    if (connError || !connData) {
      showToast("Failed to load connections for cross-reference.", "error");
      setCrossRefLoading(false);
      setCrossRefStep(0);
      return false;
    }

    setCrossRefStep(2);
    await sleep(1000);

    // 2. Build a map: company_normalized → { names, urls }
    const companyMap = new Map<string, { names: string[]; urls: string[] }>();
    for (const c of connData) {
      if (!c.company_normalized) continue;
      const label = [
        [c.first_name, c.last_name].filter(Boolean).join(" "),
        c.position ? `(${c.position})` : "",
      ].filter(Boolean).join(" ");
      if (!companyMap.has(c.company_normalized)) {
        companyMap.set(c.company_normalized, { names: [], urls: [] });
      }
      const entry = companyMap.get(c.company_normalized)!;
      entry.names.push(label);
      entry.urls.push(c.linkedin_url || "");
    }

    // 3. Fetch all global leads
    const { data: leadsData, error: leadsError } = await supabase
      .from("leads")
      .select("id, title, company, location")
      .eq("is_global", true)
      .range(0, 9999);

    if (leadsError || !leadsData) {
      showToast("Failed to load leads for cross-reference.", "error");
      setCrossRefLoading(false);
      setCrossRefStep(0);
      return false;
    }

    setCrossRefStep(3);
    await sleep(1000);

    // 4. Find matches
    const matches: {
      lead_id: string;
      connection_count: number;
      connection_names: string[];
      connection_urls: string[];
    }[] = [];

    for (const lead of leadsData) {
      const normalized = normalizeCompany(lead.company);
      if (companyMap.has(normalized)) {
        const { names, urls } = companyMap.get(normalized)!;
        matches.push({ lead_id: lead.id, connection_count: names.length, connection_names: names, connection_urls: urls });
      }
    }

    if (matches.length === 0) {
      showToast("No matches found between your connections and public leads.", "success");
      setCrossRefLoading(false);
      setCrossRefStep(0);
      return false;
    }

    setCrossRefStep(4);
    await sleep(1000);

    // 5. Delete old matches and insert fresh
    await supabase.from("network_lead_matches").delete().eq("user_id", user.id);

    const insertRows = matches.map((m) => ({
      user_id: user.id,
      lead_id: m.lead_id,
      connection_count: m.connection_count,
      connection_names: m.connection_names,
      connection_urls: m.connection_urls,
    }));

    const { error: insertError } = await supabase.from("network_lead_matches").insert(insertRows);

    if (insertError) {
      showToast("Failed to save cross-reference results: " + insertError.message, "error");
      setCrossRefLoading(false);
      setCrossRefStep(0);
      return false;
    }

    showToast(`Found ${matches.length} lead${matches.length !== 1 ? "s" : ""} with connections.`, "success");
    await fetchCrossRefMatches();
    await fetchStats();
    setActiveView("matches");
    setCrossRefLoading(false);
    setCrossRefStep(0);
    return true;
  }

  async function fetchConnections(
    currentPage = 0,
    currentSearch = "",
    col: SortCol = sortCol,
    asc: boolean = sortAsc,
    hasEmail: boolean = filterHasEmail
  ) {
    if (!user) return;
    setLoading(true);

    let query = supabase
      .from("linkedin_connections")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order(col, { ascending: asc, nullsFirst: false })
      .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

    if (currentSearch.trim()) {
      const q = `%${currentSearch.trim()}%`;
      query = query.or(
        `first_name.ilike.${q},last_name.ilike.${q},company.ilike.${q},position.ilike.${q}`
      );
    }

    if (hasEmail) {
      query = query.not("email", "is", null).neq("email", "");
    }

    const { data, error, count } = await query;

    if (error) {
      showToast("Error loading connections", "error");
    } else {
      setConnections(data || []);
      setTotal(count || 0);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!user) return;
    fetchConnections(0, "");
    fetchStats();
    fetchCrossRefMatches();
    try {
      const stored = localStorage.getItem(`network_emailed_${user.id}`);
      if (stored) setSentEmails(JSON.parse(stored));
    } catch {}
  }, [user]);

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(0);
    fetchConnections(0, value);
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
    fetchConnections(newPage, search);
  }

  function handleSort(col: SortCol) {
    const newAsc = col === sortCol ? !sortAsc : true;
    setSortCol(col);
    setSortAsc(newAsc);
    setPage(0);
    fetchConnections(0, search, col, newAsc);
  }

  function handleToggleHasEmail() {
    const next = !filterHasEmail;
    setFilterHasEmail(next);
    setPage(0);
    fetchConnections(0, search, sortCol, sortAsc, next);
  }

  function handleResetFilters() {
    setSearch("");
    setFilterHasEmail(false);
    setPage(0);
    fetchConnections(0, "", sortCol, sortAsc, false);
  }

  function toggleCompany(company: string) {
    setExpandedCompanies((prev) => {
      const next = new Set(prev);
      if (next.has(company)) next.delete(company);
      else next.add(company);
      return next;
    });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const headerIndex = text.split("\n").findIndex((line) =>
        line.startsWith("First Name")
      );
      if (headerIndex === -1) {
        showToast("No valid rows found. Make sure this is a LinkedIn connections CSV.", "error");
        return;
      }
      const csv = text.split("\n").slice(headerIndex).join("\n");

      Papa.parse<Record<string, string>>(csv, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data.map(mapRow).filter((r) => r.first_name || r.last_name);
          if (rows.length === 0) {
            showToast("No valid rows found. Make sure this is a LinkedIn connections CSV.", "error");
            return;
          }
          setPreview(rows);
        },
        error: () => {
          showToast("Failed to parse CSV file.", "error");
        },
      });
    };
    reader.readAsText(file);
  }

  async function handleConfirmImport() {
    if (!preview || !user) return;
    setImporting(true);

    const { error: deleteError } = await supabase
      .from("linkedin_connections")
      .delete()
      .eq("user_id", user.id);

    if (deleteError) {
      showToast("Failed to clear existing connections.", "error");
      setImporting(false);
      return;
    }

    const rows = preview.map((r) => ({
      user_id: user.id,
      first_name: r.first_name || null,
      last_name: r.last_name || null,
      email: r.email || null,
      company: r.company || null,
      company_normalized: r.company ? normalizeCompany(r.company) : null,
      position: r.position || null,
      connected_on: r.connected_on || null,
      linkedin_url: r.linkedin_url || null,
    }));

    const { error } = await supabase.from("linkedin_connections").insert(rows);

    if (error) {
      showToast("Import failed: " + error.message, "error");
      setImporting(false);
    } else {
      showToast(`${rows.length} connections imported. Generating your networking plan...`, "success");
      setPreview(null);
      setSearch("");
      setPage(0);
      setImporting(false);
      fetchConnections(0, "");
      fetchStats();
      const hadMatches = await runCrossReference();
      if (hadMatches) {
        const seen = localStorage.getItem(`network_onboarded_${user!.id}`);
        if (!seen) {
          setOnboardingStep(1);
          setShowOnboardingModal(true);
        }
      }
    }
  }

  function handleCancelPreview() {
    setPreview(null);
  }

  const userFirstName =
    (user as any)?.user_metadata?.full_name?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "";

  function buildEmailBody(connectionName: string, leadTitle: string, company: string): string {
    const firstName = connectionName.split(/[\s(]/)[0] || "there";
    return [
      `Hi ${firstName},`,
      "",
      "I hope all is well!",
      "",
      `I'm currently looking for my next gig and I saw this role (${leadTitle}) opening at ${company}. How has your experience there been so far?`,
      "",
      "Best,",
      userFirstName,
    ].join("\n");
  }

  function openEmailModal(lead: CrossRefMatch, group: PlanGroup) {
    const firstConnection = group.uniqueNames[0] || "";
    setEmailDraft({
      leadId: lead.lead_id,
      leadTitle: lead.lead_title,
      company: group.company,
      toNames: group.uniqueNames,
      toName: firstConnection,
      toEmail: generateDraftEmail(firstConnection, group.company),
      from: user?.email || "",
      subject: `Quick question about ${group.company}`,
      body: buildEmailBody(firstConnection, lead.lead_title, group.company),
    });
    setEmailSending(false);
    setEmailSent(false);
  }

  function completeOnboarding() {
    if (user) localStorage.setItem(`network_onboarded_${user.id}`, "1");
    setShowOnboardingModal(false);
  }

  async function handleSendEmail() {
    if (!emailDraft) return;
    setEmailSending(true);
    await sleep(1500);

    // Save the lead if not already tracked, advance from Saved → Contacted, then log activity
    const activityNote = `Email sent to ${emailDraft.toName} at ${emailDraft.company}`;
    try {
      const existing = (await api.userLeads.getByLeadId(emailDraft.leadId)) as any;
      const userLeadId = existing?._id;
      if (userLeadId) {
        if (existing.currentStatus === "saved") {
          // Advance to Contacted and use the email note as the history entry
          await api.userLeads.updateStatus(userLeadId, "contacted", activityNote);
        } else {
          // Already past Saved — just log the activity, don't change status
          await api.userLeads.update(userLeadId, {
            activityNote,
            activityAction: "email_sent",
          });
        }
      } else {
        // Brand new — save directly as Contacted
        await api.userLeads.save({
          leadId: emailDraft.leadId,
          currentStatus: "contacted",
          activityNote,
          activityAction: "email_sent",
        });
      }
    } catch {
      // Activity logging is best-effort — don't block the UI
    }

    const sentAt = new Date().toISOString();
    setSentEmails((prev) => {
      const updated = { ...prev, [emailDraft.leadId]: sentAt };
      try { localStorage.setItem(`network_emailed_${user!.id}`, JSON.stringify(updated)); } catch {}
      return updated;
    });
    setEmailSending(false);
    setEmailSent(true);
  }

  function formatSentTime(iso: string): string {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  const CROSSREF_STEPS = [
    "",
    "Loading your LinkedIn connections...",
    "Cross-referencing across the GigFrog leads database...",
    "Finding all matches and pulling email addresses...",
    "Building your networking plan...",
  ];

  return (
    <div className="page-container">
      {toastElement}

      {/* Onboarding modal — first import only */}
      {showOnboardingModal && (() => {
        const sampleGroup = planGroups[0];
        const sampleLead = sampleGroup?.preferredLeads[0] || sampleGroup?.leads[0];
        const sampleName = sampleGroup?.uniqueNames[0]?.split(/[\s(]/)[0] || "Alex";
        const sampleRole = sampleLead?.lead_title || "Software Engineer";
        const sampleCompany = sampleGroup?.company || "your target company";
        const sampleBody = [
          `Hi ${sampleName},`,
          "",
          "I hope all is well!",
          "",
          `I'm currently looking for my next gig and saw a ${sampleRole} opening at ${sampleCompany}. How has your experience there been so far?`,
          "",
          "Best,",
          userFirstName || "you",
        ].join("\n");

        return (
          <div className="network-crossref-modal-overlay">
            <div className="network-crossref-modal network-onboarding-modal">
              {/* Step dots */}
              <div className="network-onboarding-step-dots">
                {[1, 2, 3].map((s) => (
                  <div
                    key={s}
                    className={`network-onboarding-step-dot${onboardingStep === s ? " network-onboarding-step-dot--active" : ""}`}
                  />
                ))}
              </div>

              {onboardingStep === 1 && (
                <>
                  <p className="network-onboarding-title">Your Networking Plan is Ready</p>
                  <p className="network-onboarding-body">
                    The next step is to send emails to one person (or more) for each company that has
                    an opening you&rsquo;re interested in. We&rsquo;ve already built out the email
                    templates and grabbed all the email addresses. Simply click on the{" "}
                    <strong>Email icon</strong> next to the role you want and you can preview the
                    email before hitting send.
                  </p>
                  <div className="network-onboarding-actions">
                    <button className="btn btn-primary" onClick={() => setOnboardingStep(2)}>
                      Next &rarr;
                    </button>
                  </div>
                </>
              )}

              {onboardingStep === 2 && (
                <>
                  <p className="network-onboarding-title">Your Default Email Template</p>
                  <p className="network-onboarding-email-note">
                    You can edit the message any way you like before hitting send. The email will be
                    sent from the email you signed up with &mdash; any replies go directly to your
                    inbox.
                  </p>
                  <div className="network-onboarding-email-preview">{sampleBody}</div>
                  <div className="network-onboarding-actions">
                    <button className="btn btn-secondary" onClick={() => setOnboardingStep(1)}>
                      &larr; Back
                    </button>
                    <button className="btn btn-primary" onClick={() => setOnboardingStep(3)}>
                      Next &rarr;
                    </button>
                  </div>
                </>
              )}

              {onboardingStep === 3 && (
                <>
                  <p className="network-onboarding-title">You&rsquo;re All Set!</p>
                  <p className="network-onboarding-body">
                    Great! Go ahead and review your matches and get those emails sent so we can get
                    referrals and interviews going!
                  </p>
                  <div className="network-onboarding-actions">
                    <button className="btn btn-secondary" onClick={() => setOnboardingStep(2)}>
                      &larr; Back
                    </button>
                    <button className="btn btn-primary" onClick={completeOnboarding}>
                      View My Matches
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* Email compose modal */}
      {emailDraft && (
        <div className="network-crossref-modal-overlay" onClick={() => !emailSending && !emailSent && setEmailDraft(null)}>
          <div className="network-crossref-modal network-email-modal" onClick={(e) => e.stopPropagation()}>
            {emailSent ? (
              <div className="network-email-sent-state">
                <div className="network-email-sent-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p className="network-email-sent-title">Email Sent!</p>
                <p className="network-email-sent-sub">Your message is on its way to {emailDraft.toName.split(/[\s(]/)[0] || "your connection"}.</p>
                <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => setEmailDraft(null)}>
                  Done
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                  <CompanyLogo company={emailDraft.company} size={32} className="network-plan-logo" />
                  <p className="network-email-modal-header" style={{ margin: 0 }}>
                    Send Email &mdash; {emailDraft.company}
                  </p>
                </div>

                <div className="network-email-field">
                  <span className="network-email-field-label">From</span>
                  <span className="network-email-field-value">{emailDraft.from}</span>
                </div>

                <div className="network-email-field">
                  <span className="network-email-field-label">To</span>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                    {emailDraft.toNames.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {emailDraft.toNames.map((name, i) => {
                          const isSelected = emailDraft.toName === name;
                          return (
                            <button
                              key={i}
                              type="button"
                              className={`network-conn-chip${isSelected ? "" : " network-conn-chip--no-link"}`}
                              style={isSelected ? { borderColor: "var(--accent)", color: "var(--accent)", fontWeight: "bold" } : {}}
                              onClick={() => {
                                const newEmail = generateDraftEmail(name, emailDraft.company);
                                const newBody = buildEmailBody(name, emailDraft.leadTitle, emailDraft.company);
                                setEmailDraft({ ...emailDraft, toName: name, toEmail: newEmail, body: newBody });
                              }}
                            >
                              {name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <input
                      type="email"
                      placeholder="Email address"
                      value={emailDraft.toEmail}
                      onChange={(e) => setEmailDraft({ ...emailDraft, toEmail: e.target.value })}
                    />
                  </div>
                </div>

                <div className="network-email-field">
                  <span className="network-email-field-label">Subject</span>
                  <input
                    type="text"
                    value={emailDraft.subject}
                    onChange={(e) => setEmailDraft({ ...emailDraft, subject: e.target.value })}
                  />
                </div>

                <div className="network-email-field network-email-body-field">
                  <textarea
                    value={emailDraft.body}
                    onChange={(e) => setEmailDraft({ ...emailDraft, body: e.target.value })}
                  />
                </div>

                <div className="network-email-actions">
                  <button className="btn btn-secondary" onClick={() => setEmailDraft(null)} disabled={emailSending}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" onClick={handleSendEmail} disabled={emailSending}>
                    {emailSending ? "Sending..." : "Send Email"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Cross-reference loading modal */}
      {crossRefLoading && (
        <div className="network-crossref-modal-overlay">
          <div className="network-crossref-modal">
            <div className="network-crossref-spinner" />
            <p className="network-crossref-modal-title">Building Your Networking Plan</p>
            <p className="network-crossref-modal-step">
              {CROSSREF_STEPS[crossRefStep] || "Working..."}
            </p>
            <div className="network-crossref-progress-track">
              <div
                className="network-crossref-progress-fill"
                style={{ width: `${(crossRefStep / (CROSSREF_STEPS.length - 1)) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <h1 className="page-title">Network</h1>
      </div>

      {/* Onboarding prompt — only shown before any connections are loaded */}
      {stats?.total === 0 && !preview && (
        <div className="card" style={{ marginBottom: 24 }}>
          <p style={{ marginBottom: 8 }}>
            In order to maximize your network and find new leads, cross-referencing your LinkedIn connections is the way to go. Click the link below and follow the steps to download your connections. It can take up to 24 hours for LinkedIn to send the file — once you receive it, look for the file called <strong>Connections.csv</strong>.
          </p>
          <a
            href="https://www.linkedin.com/help/linkedin/answer/a566336/export-connections-from-linkedin"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 14 }}
          >
            How to export your LinkedIn connections →
          </a>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          style={{ display: "none" }}
          onChange={handleFileChange}
          onClick={() => { if (fileInputRef.current) fileInputRef.current.value = ""; }}
        />
        <button
          className="btn btn-primary"
          onClick={() => fileInputRef.current?.click()}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Upload LinkedIn Connections
        </button>
      </div>

      {/* View switcher — only shown once connections exist */}
      {stats && stats.total > 0 && (
        <div className="network-view-tabs">
          {(["matches", "network"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              className={`network-view-tab${activeView === opt ? " network-view-tab--active" : ""}`}
              onClick={() => setActiveView(opt)}
            >
              {opt === "matches" ? "Lead Matches" : "Network"}
            </button>
          ))}
        </div>
      )}

      {/* Stats cards — hidden in "network" view */}
      {stats && stats.total > 0 && activeView !== "network" && (
        <div className="network-stats-row">
          <div className="network-stat-card">
            <div className="network-stat-value">{stats.total.toLocaleString()}</div>
            <div className="network-stat-label">Connections</div>
          </div>
          <div className="network-stat-card">
            <div className="network-stat-value">{stats.withEmail.toLocaleString()}</div>
            <div className="network-stat-label">Have Email</div>
          </div>
          <div className="network-stat-card">
            <div className="network-stat-value">{stats.uniqueCompanies.toLocaleString()}</div>
            <div className="network-stat-label">Companies</div>
          </div>
          <div className="network-stat-card network-stat-card--accent">
            <div className="network-stat-value">{stats.matchCount.toLocaleString()}</div>
            <div className="network-stat-label">Lead Matches</div>
          </div>
        </div>
      )}

      {/* Networking Plan — hidden in "network" view */}
      {stats && stats.total > 0 && activeView !== "network" && (
        <div className="network-crossref-section">
          {/* Header */}
          <div className="network-crossref-header">
            <div>
              <strong>Networking Plan</strong>
              {crossRefRunAt && (
                <span style={{ color: "var(--text-muted)", fontSize: 12, marginLeft: 10 }}>
                  Last run {new Date(crossRefRunAt).toLocaleDateString()}
                </span>
              )}
            </div>
            {crossRefMatches.length > 0 && (
              <button
                className="btn btn-secondary"
                onClick={runCrossReference}
                disabled={crossRefLoading}
              >
                {crossRefLoading ? "Running..." : "Re-run"}
              </button>
            )}
          </div>

          {roles.length > 0 && (
            <div className="network-chips-row" style={{ marginTop: 0, marginBottom: 10 }}>
              {roles.map((role) => (
                <button
                  key={role}
                  onClick={() => toggleRole(role)}
                  className={`network-chip${!deselectedRoles.has(role) ? " network-chip--active" : ""}`}
                  style={{ fontSize: "8pt" }}
                >
                  {role}
                </button>
              ))}
              {deselectedRoles.size > 0 && (
                <button
                  className="network-chip-clear"
                  onClick={() => setDeselectedRoles(new Set())}
                >
                  Reset
                </button>
              )}
            </div>
          )}

          {/* Plan groups */}
          {planGroups.length > 0 && (
            <>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
                {planGroups.length} {planGroups.length === 1 ? "company" : "companies"} ·{" "}
                {planGroups.reduce((n, g) => n + (activeRoles.length > 0 ? g.preferredLeads.length : g.leads.length), 0)} leads
                {activeRoles.length > 0 ? " matching selected roles" : ""}
              </div>

              <div className="network-plan-list">
                {planGroups.map((g) => {
                  const isExpanded = expandedCompanies.has(g.company);
                  const visibleLeads = activeRoles.length > 0 ? g.preferredLeads : g.leads;
                  return (
                    <div key={g.company} className="network-plan-group">
                      <div
                        className="network-plan-group-header"
                        onClick={() => toggleCompany(g.company)}
                      >
                        <div className="network-plan-group-left">
                          <CompanyLogo company={g.company} size={24} className="network-plan-logo" />
                          <span className="network-plan-company">{g.company}</span>
                          <span className="network-plan-meta">
                            {visibleLeads.length} {visibleLeads.length === 1 ? "lead" : "leads"}
                            {activeRoles.length > 0 && g.leads.length > g.preferredLeads.length && (
                              <span style={{ color: "var(--text-muted)" }}>
                                {" "}(+{g.leads.length - g.preferredLeads.length} other)
                              </span>
                            )}
                          </span>
                          <div className="network-plan-conns">
                            {g.uniqueNames.map((name, i) => (
                              g.uniqueUrls[i] ? (
                                <a
                                  key={i}
                                  href={g.uniqueUrls[i]}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="network-conn-chip"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {name}
                                </a>
                              ) : (
                                <span key={i} className="network-conn-chip network-conn-chip--no-link">
                                  {name}
                                </span>
                              )
                            ))}
                          </div>
                        </div>
                        <span className="network-plan-chevron">{isExpanded ? "▲" : "▼"}</span>
                      </div>

                      {isExpanded && (
                        <div className="network-plan-leads">
                          {visibleLeads.map((m) => (
                            <div key={m.lead_id} className="network-plan-lead-row">
                              <Link href={`/leads/${m.lead_id}`} className="network-connection-link">
                                {m.lead_title}
                              </Link>
                              {m.lead_location && (
                                <span style={{ color: "var(--text-muted)", fontSize: "8pt", marginLeft: 8 }}>
                                  {m.lead_location}
                                </span>
                              )}
                              {sentEmails[m.lead_id] ? (
                                <span className="network-email-icon-btn network-email-icon-btn--sent">
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                  Email sent &middot; {formatSentTime(sentEmails[m.lead_id])}
                                </span>
                              ) : (
                                <button
                                  className="network-email-icon-btn"
                                  title={`Email a connection at ${g.company}`}
                                  onClick={(e) => { e.stopPropagation(); openEmailModal(m, g); }}
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                                    <polyline points="22,6 12,13 2,6"/>
                                  </svg>
                                  Send email
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* All matches toggle */}
              <div style={{ marginTop: 14, borderTop: "1px solid #eee", paddingTop: 10 }}>
                <button
                  className="network-chip-clear"
                  onClick={() => setShowAllMatches((v) => !v)}
                  style={{ fontSize: "8pt" }}
                >
                  {showAllMatches ? "▲ Hide" : "▼ Show"} all {crossRefMatches.length} matches
                </button>

                {showAllMatches && (
                  <div className="network-table-container" style={{ marginTop: 10 }}>
                    <table className="network-table">
                      <thead>
                        <tr>
                          <th>Lead</th>
                          <th>Company</th>
                          <th>Location</th>
                          <th>Connections</th>
                          <th>Your Connections</th>
                        </tr>
                      </thead>
                      <tbody>
                        {crossRefMatches.map((m) => (
                          <tr key={m.lead_id}>
                            <td>
                              <Link href={`/leads/${m.lead_id}`} className="network-connection-link">
                                {m.lead_title}
                              </Link>
                            </td>
                            <td>{m.lead_company}</td>
                            <td>{m.lead_location}</td>
                            <td>
                              <span className="network-match-count">{m.connection_count}</span>
                            </td>
                            <td>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                {m.connection_names.map((name, i) => (
                                  m.connection_urls[i] ? (
                                    <a
                                      key={i}
                                      href={m.connection_urls[i]}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="network-conn-chip"
                                    >
                                      {name}
                                    </a>
                                  ) : (
                                    <span key={i} className="network-conn-chip network-conn-chip--no-link">
                                      {name}
                                    </span>
                                  )
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {/* No plan results after filter applied */}
          {crossRefMatches.length > 0 && planGroups.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
              No matches for your preferred roles.{" "}
              <button
                className="network-chip-clear"
                style={{ display: "inline", padding: 0, border: "none", fontSize: "inherit", color: "var(--accent)", cursor: "pointer" }}
                onClick={() => setDeselectedRoles(new Set(roles))}
              >
                Show all {crossRefMatches.length} matches
              </button>
            </p>
          )}
        </div>
      )}

      {/* CSV Preview */}
      {preview && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 12 }}>
            <strong>{preview.length} connections</strong> ready to import
            <span style={{ color: "var(--text-muted)", fontSize: 13, marginLeft: 8 }}>
              (this will replace any existing connections)
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button className="btn btn-secondary" onClick={handleCancelPreview} disabled={importing}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleConfirmImport} disabled={importing}>
              {importing ? "Importing..." : "Confirm Import"}
            </button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ border: "1px solid var(--border)", padding: "8px 12px", background: "var(--surface-2, var(--bg-secondary))", textAlign: "left" }}>Name</th>
                  <th style={{ border: "1px solid var(--border)", padding: "8px 12px", background: "var(--surface-2, var(--bg-secondary))", textAlign: "left" }}>Company</th>
                  <th style={{ border: "1px solid var(--border)", padding: "8px 12px", background: "var(--surface-2, var(--bg-secondary))", textAlign: "left" }}>Position</th>
                  <th style={{ border: "1px solid var(--border)", padding: "8px 12px", background: "var(--surface-2, var(--bg-secondary))", textAlign: "left" }}>Email</th>
                  <th style={{ border: "1px solid var(--border)", padding: "8px 12px", background: "var(--surface-2, var(--bg-secondary))", textAlign: "left" }}>Connected On</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 10).map((row, i) => (
                  <tr key={i}>
                    <td style={{ border: "1px solid var(--border)", padding: "8px 12px" }}>{row.first_name} {row.last_name}</td>
                    <td style={{ border: "1px solid var(--border)", padding: "8px 12px" }}>{row.company}</td>
                    <td style={{ border: "1px solid var(--border)", padding: "8px 12px" }}>{row.position}</td>
                    <td style={{ border: "1px solid var(--border)", padding: "8px 12px" }}>{row.email}</td>
                    <td style={{ border: "1px solid var(--border)", padding: "8px 12px" }}>{row.connected_on}</td>
                  </tr>
                ))}
                {preview.length > 10 && (
                  <tr>
                    <td colSpan={5} style={{ border: "1px solid var(--border)", padding: "8px 12px", color: "var(--text-muted)", textAlign: "center", fontStyle: "italic" }}>
                      ...and {preview.length - 10} more
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Connections list — hidden in "matches" view */}
      {!preview && activeView !== "matches" && (
        <>
          {total > 0 && (
            <div style={{ marginBottom: 16 }}>
              <input
                className="search-input"
                type="text"
                placeholder="Search by name, company, or role..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
              <div className="network-chips-row">
                <button
                  onClick={handleToggleHasEmail}
                  className={`network-chip${filterHasEmail ? " network-chip--active" : ""}`}
                >
                  Has Email
                </button>
                {hasActiveFilters && (
                  <button className="network-chip-clear" onClick={handleResetFilters}>
                    Reset
                  </button>
                )}
              </div>
            </div>
          )}

          {loading ? (
            <div className="loading-state">Loading...</div>
          ) : connections.length === 0 && !search ? (
            <div className="empty-state">
              <p>No connections yet. Upload your Connections.csv to get started.</p>
            </div>
          ) : connections.length === 0 ? (
            <div className="empty-state">No connections match &ldquo;{search}&rdquo;</div>
          ) : (
            <div className="network-table-container">
              <table className="network-table">
                <thead>
                  <tr>
                    {([
                      { label: "Name", col: "first_name" },
                      { label: "Company", col: "company" },
                      { label: "Position", col: "position" },
                      { label: "Email", col: "email" },
                      { label: "Connected On", col: "connected_on" },
                    ] as { label: string; col: SortCol }[]).map(({ label, col }) => (
                      <th
                        key={col}
                        onClick={() => handleSort(col)}
                        style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
                      >
                        {label}
                        {sortCol === col ? (sortAsc ? " ▲" : " ▼") : " ↕"}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {connections.map((c) => (
                    <tr key={c.id}>
                      <td>
                        {c.linkedin_url ? (
                          <a className="network-connection-link" href={c.linkedin_url} target="_blank" rel="noopener noreferrer">
                            {c.first_name} {c.last_name}
                          </a>
                        ) : (
                          <>{c.first_name} {c.last_name}</>
                        )}
                      </td>
                      <td>{c.company}</td>
                      <td>{c.position}</td>
                      <td>
                        {c.email ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span>{c.email}</span>
                            <button
                              className="copy-icon-btn"
                              title="Copy email"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(c.email!);
                                const btn = e.currentTarget;
                                const orig = btn.innerHTML;
                                btn.innerHTML = '<span style="font-size: 8pt; color: #00a000; white-space: nowrap;">Copied!</span>';
                                btn.style.padding = "4px 6px";
                                setTimeout(() => { btn.innerHTML = orig; btn.style.padding = "4px"; }, 1500);
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                              </svg>
                            </button>
                          </div>
                        ) : null}
                      </td>
                      <td>{c.connected_on}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
                  {search
                    ? `${total} result${total !== 1 ? "s" : ""} for "${search}"`
                    : `${total} connections`}
                </span>
                {totalPages > 1 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => handlePageChange(Math.max(0, page - 1))}
                      disabled={page === 0}
                      style={{ padding: "4px 10px" }}
                    >
                      ‹ Prev
                    </button>
                    <span style={{ color: "var(--text-muted)" }}>
                      {page + 1} / {totalPages}
                    </span>
                    <button
                      className="btn btn-secondary"
                      onClick={() => handlePageChange(Math.min(totalPages - 1, page + 1))}
                      disabled={page === totalPages - 1}
                      style={{ padding: "4px 10px" }}
                    >
                      Next ›
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

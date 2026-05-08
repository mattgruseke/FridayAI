"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Papa from "papaparse";
import "./Network.css";
import { createClient } from "../lib/supabase/client";
import { SCORE_BUCKETS } from "../lib/scoring";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../hooks/useToast";
import CompanyLogo from "../components/CompanyLogo";
import api from "../api/client";
import NetworkAnalysisCard from "../components/NetworkAnalysisCard";
import OutreachTemplateModal from "../components/OutreachTemplateModal";


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
  connection_emails: string[];
  run_at: string;
};

type PlanGroup = {
  company: string;
  leads: CrossRefMatch[];
  preferredLeads: CrossRefMatch[];
  uniqueNames: string[];
  uniqueUrls: string[];
  uniqueEmails: string[];
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


function matchesPreferredRole(title: string, roles: string[]): boolean {
  if (!roles.length) return false;
  const t = title.toLowerCase();
  return roles.some((role) => t.includes(role.toLowerCase()));
}

export default function Network() {
  const { user, preferredRoles, onboardingCompleted, hasNetworkAccess, fullName, refreshProfile } = useAuth();
  const { showToast, toastElement } = useToast();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (user && !hasNetworkAccess) {
      router.replace("/leads");
    }
  }, [user, router]);
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
  const [planFilterEmailOnly, setPlanFilterEmailOnly] = useState(false);
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());
  const [showAllMatches, setShowAllMatches] = useState(false);

  // Score filter (driven by bell curve bar clicks or URL params from home)
  const searchParams = useSearchParams();
  const [scoreMap, setScoreMap] = useState<Record<string, number>>({});
  const [activeScoreRange, setActiveScoreRange] = useState<[number, number] | null>(() => {
    const min = searchParams.get("minScore");
    const max = searchParams.get("maxScore");
    if (min !== null && max !== null) return [Number(min), Number(max)];
    return null;
  });

  // First-upload confirmation modal
  const [showFirstUploadModal, setShowFirstUploadModal] = useState(false);
  const [firstUploadListName, setFirstUploadListName] = useState("");
  const [firstUploadMatchCount, setFirstUploadMatchCount] = useState(0);

  // Incremented after each successful upload to force NetworkAnalysisCard to re-fetch
  const [scoreKey, setScoreKey] = useState(0);

  // Name modal (shown after first upload if full_name not set)
  const [showNameModal, setShowNameModal] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [nameSaving, setNameSaving] = useState(false);

  // Outreach template modal
  const [templateModal, setTemplateModal] = useState<{ subject: string; body: string; leadId: string; company: string } | null>(null);

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

  // Score-filtered matches — used by both planGroups and the stats row
  const scoreFilteredMatches = useMemo(() => {
    if (!activeScoreRange || activeScoreRange[0] === -1) return crossRefMatches;
    return crossRefMatches.filter((m) => {
      const score = scoreMap[m.lead_id] ?? -1;
      return score >= activeScoreRange[0] && score < activeScoreRange[1];
    });
  }, [crossRefMatches, activeScoreRange, scoreMap]);

  // Stats derived from the filtered match set so all four cards stay in sync
  const matchStats = useMemo(() => {
    const uniqueCompanies = new Set(scoreFilteredMatches.map((m) => m.lead_company)).size;
    const withEmail = scoreFilteredMatches.filter((m) => m.connection_emails.some((e) => e)).length;
    const seenUrls = new Set<string>();
    const seenNames = new Set<string>();
    for (const m of scoreFilteredMatches) {
      for (let i = 0; i < m.connection_names.length; i++) {
        const url = m.connection_urls[i];
        const name = m.connection_names[i];
        if (url) seenUrls.add(url);
        else if (name) seenNames.add(name);
      }
    }
    return {
      matchCount: scoreFilteredMatches.length,
      uniqueCompanies,
      withEmail,
      totalConnections: seenUrls.size + seenNames.size,
    };
  }, [scoreFilteredMatches]);

  // Derived: group cross-ref matches by company for Networking Plan
  const planGroups = useMemo<PlanGroup[]>(() => {
    const scoredMatches = scoreFilteredMatches;

    const map = new Map<string, PlanGroup>();
    for (const m of scoredMatches) {
      if (!map.has(m.lead_company)) {
        map.set(m.lead_company, {
          company: m.lead_company,
          leads: [],
          preferredLeads: [],
          uniqueNames: [],
          uniqueUrls: [],
          uniqueEmails: [],
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
          g.uniqueEmails.push(m.connection_emails?.[i] || "");
        }
      }
    }

    const groups = Array.from(map.values());
    let filtered =
      activeRoles.length > 0
        ? groups.filter((g) => g.preferredLeads.length > 0)
        : groups;

    if (planFilterEmailOnly) {
      filtered = filtered.filter((g) => g.uniqueEmails.some((e) => e));
    }

    return filtered.sort(
      (a, b) =>
        b.preferredLeads.length - a.preferredLeads.length ||
        b.leads.length - a.leads.length ||
        b.uniqueNames.length - a.uniqueNames.length
    );
  }, [crossRefMatches, activeRoles, activeScoreRange, scoreMap, planFilterEmailOnly]);

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
      .select("lead_id, connection_count, connection_names, connection_urls, connection_emails, run_at, leads(title, company, location)")
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
        connection_emails: row.connection_emails || [],
        run_at: row.run_at,
      }));
      setCrossRefMatches(mapped);
      if (mapped.length > 0) setCrossRefRunAt(mapped[0].run_at);
    }
  }

  async function runCrossReference(): Promise<CrossRefMatch[] | null> {
    if (!user) return null;
    setCrossRefLoading(true);
    setCrossRefStep(1);
    await sleep(1000);

    // 1. Fetch all user connections including linkedin_url and email
    const { data: connData, error: connError } = await supabase
      .from("linkedin_connections")
      .select("company_normalized, first_name, last_name, position, linkedin_url, email")
      .eq("user_id", user.id)
      .range(0, 9999);

    if (connError || !connData) {
      showToast("Failed to load connections for cross-reference.", "error");
      setCrossRefLoading(false);
      setCrossRefStep(0);
      return null;
    }

    setCrossRefStep(2);
    await sleep(1000);

    // 2. Build a map: company_normalized → { names, urls, emails }
    const companyMap = new Map<string, { names: string[]; urls: string[]; emails: string[] }>();
    for (const c of connData) {
      if (!c.company_normalized) continue;
      const label = [
        [c.first_name, c.last_name].filter(Boolean).join(" "),
        c.position ? `(${c.position})` : "",
      ].filter(Boolean).join(" ");
      if (!companyMap.has(c.company_normalized)) {
        companyMap.set(c.company_normalized, { names: [], urls: [], emails: [] });
      }
      const entry = companyMap.get(c.company_normalized)!;
      entry.names.push(label);
      entry.urls.push(c.linkedin_url || "");
      entry.emails.push(c.email || "");
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
      return null;
    }

    setCrossRefStep(3);
    await sleep(1000);

    // 4. Find matches
    const matches: {
      lead_id: string;
      connection_count: number;
      connection_names: string[];
      connection_urls: string[];
      connection_emails: string[];
    }[] = [];

    for (const lead of leadsData) {
      const normalized = normalizeCompany(lead.company);
      if (companyMap.has(normalized)) {
        const { names, urls, emails } = companyMap.get(normalized)!;
        matches.push({ lead_id: lead.id, connection_count: names.length, connection_names: names, connection_urls: urls, connection_emails: emails });
      }
    }

    if (matches.length === 0) {
      showToast("No matches found between your connections and public leads.", "success");
      setCrossRefLoading(false);
      setCrossRefStep(0);
      return null;
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
      connection_emails: m.connection_emails,
    }));

    const { error: insertError } = await supabase.from("network_lead_matches").insert(insertRows);

    if (insertError) {
      showToast("Failed to save cross-reference results: " + insertError.message, "error");
      setCrossRefLoading(false);
      setCrossRefStep(0);
      return null;
    }

    showToast(`Found ${matches.length} lead${matches.length !== 1 ? "s" : ""} with connections.`, "success");

    await fetchCrossRefMatches();
    await fetchStats();
    setActiveView("matches");
    setCrossRefLoading(false);
    setCrossRefStep(0);

    // Save last_run_lead_count + last_run_at, dismiss any existing rerun notifications
    const { count: currentLeadCount } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("is_global", true);
    await supabase
      .from("user_profiles")
      .update({ last_run_lead_count: currentLeadCount ?? leadsData.length, last_run_at: new Date().toISOString() })
      .eq("id", user.id);
    await supabase
      .from("notifications")
      .update({ is_completed: true })
      .eq("user_id", user.id)
      .eq("type", "network_rerun_suggested");

    // Return the mapped matches so the caller can use them (e.g. first-upload list creation)
    return matches.map((m) => ({
      lead_id: m.lead_id,
      lead_title: "",
      lead_company: "",
      lead_location: null,
      connection_count: m.connection_count,
      connection_names: m.connection_names,
      connection_urls: m.connection_urls,
      connection_emails: m.connection_emails,
      run_at: new Date().toISOString(),
    }));
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

  // Check if a rerun notification should be created on mount
  useEffect(() => {
    if (!user) return;
    async function checkRerunNotification() {
      const [
        { count: currentLeadCount },
        { data: profile },
        { data: existing },
      ] = await Promise.all([
        supabase.from("leads").select("*", { count: "exact", head: true }).eq("is_global", true),
        supabase.from("user_profiles").select("last_run_lead_count").eq("id", user!.id).single(),
        supabase.from("notifications")
          .select("id")
          .eq("user_id", user!.id)
          .eq("type", "network_rerun_suggested")
          .eq("is_completed", false)
          .limit(1),
      ]);

      const lastCount = profile?.last_run_lead_count ?? null;
      if (lastCount === null) return; // never run before, no prompt needed
      const delta = (currentLeadCount ?? 0) - lastCount;
      if (delta < 10) return;
      if (existing && existing.length > 0) return; // already have one

      await supabase.from("notifications").insert({
        user_id: user!.id,
        type: "network_rerun_suggested",
        message: `${delta} new leads added since your last network analysis — re-run to find new connections.`,
        action_url: "/network",
        is_dismissed: false,
        is_completed: false,
      });
    }
    checkRerunNotification();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchConnections(0, "");
    fetchStats();
    fetchCrossRefMatches();
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
      setScoreKey((k) => k + 1);
      // Mark linkedin_upload notification as complete
      api.notifications.completeByType("linkedin_upload").catch(() => { });
      const matchedLeads = await runCrossReference();
      const isFirstUpload = !localStorage.getItem(`network_onboarded_${user!.id}`);
      if (matchedLeads && matchedLeads.length > 0 && isFirstUpload) {
        const runNow = new Date();
        const runName = `${runNow.getMonth() + 1}-${runNow.getDate()}-${runNow.getFullYear()} ${runNow.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase()}`;
        const runMetadata = {
          type: "network_run",
          run_at: runNow.toISOString(),
          matches: Object.fromEntries(
            matchedLeads.map((m) => [m.lead_id, {
              connection_count: m.connection_count,
              connection_names: m.connection_names,
              connection_urls: m.connection_urls,
              connection_emails: m.connection_emails,
            }])
          ),
        };
        await api.userLists.create({
          name: runName,
          leadIds: matchedLeads.map((m) => m.lead_id),
          metadata: runMetadata,
        }).catch(() => {});
        localStorage.setItem(`network_onboarded_${user!.id}`, "1");
        setFirstUploadListName(runName);
        setFirstUploadMatchCount(matchedLeads.length);
        setShowFirstUploadModal(true);
      }
      // Prompt for name if not yet set
      if (!fullName) {
        setShowNameModal(true);
      }
    }
  }

  function handleCancelPreview() {
    setPreview(null);
  }

  async function handleSaveName() {
    if (!user || !nameInput.trim()) return;
    setNameSaving(true);
    await supabase.from("user_profiles").update({ full_name: nameInput.trim() }).eq("id", user.id);
    await refreshProfile();
    setNameSaving(false);
    setShowNameModal(false);
  }

  const userFirstName =
    fullName?.split(" ")[0] ||
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

  function openTemplateModal(lead: CrossRefMatch, group: PlanGroup) {
    const firstName = group.uniqueNames[0] || "";
    setTemplateModal({
      subject: `Quick question about ${group.company}`,
      body: buildEmailBody(firstName, lead.lead_title, group.company),
      leadId: lead.lead_id,
      company: group.company,
    });
  }

  async function handleNetworkTemplateCopied(leadId: string, company: string) {
    try {
      const existing = (await api.userLeads.getByLeadId(leadId)) as any;
      const userLeadId = existing?._id;
      if (userLeadId) {
        await api.userLeads.update(userLeadId, {
          activityNote: `Outreach template copied for ${company}`,
          activityAction: "template_copied",
        });
      }
    } catch { }
  }

  function dismissFirstUploadModal() {
    setShowFirstUploadModal(false);
  }

  async function handleCreateList() {
    const source = scoreFilteredMatches.length > 0 ? scoreFilteredMatches : crossRefMatches;
    if (!source.length) return;
    const runNow = new Date();
    const runName = `${runNow.getMonth() + 1}-${runNow.getDate()}-${runNow.getFullYear()} ${runNow.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase()}`;
    const runMetadata = {
      type: "network_run",
      run_at: runNow.toISOString(),
      matches: Object.fromEntries(
        source.map((m) => [m.lead_id, {
          connection_count: m.connection_count,
          connection_names: m.connection_names,
          connection_urls: m.connection_urls,
          connection_emails: m.connection_emails,
        }])
      ),
    };
    await api.userLists.create({
      name: runName,
      leadIds: source.map((m) => m.lead_id),
      metadata: runMetadata,
    }).catch(() => {});
    showToast(`List "${runName}" saved to your Lists.`, "success");
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

      {/* Outreach Template Modal */}
      <OutreachTemplateModal
        open={!!templateModal}
        onClose={() => setTemplateModal(null)}
        initialSubject={templateModal?.subject ?? ""}
        initialBody={templateModal?.body ?? ""}
        onCopied={() => templateModal && handleNetworkTemplateCopied(templateModal.leadId, templateModal.company)}
      />

      {/* First-upload confirmation modal */}
      {showFirstUploadModal && (
        <div className="network-crossref-modal-overlay">
          <div className="network-crossref-modal network-onboarding-modal">
            <p className="network-onboarding-title">Nice!</p>
            <p className="network-onboarding-body">
              We have your LinkedIn connections and created a list of all{" "}
              <strong>{firstUploadMatchCount}</strong> lead match{firstUploadMatchCount !== 1 ? "es" : ""} called{" "}
              <strong>&ldquo;{firstUploadListName}&rdquo;</strong>.
              You can create new lists by clicking <strong>Create List</strong> under the lead stats section.
            </p>
            <div className="network-onboarding-actions">
              <button className="btn btn-primary" onClick={dismissFirstUploadModal}>
                View My Matches
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cross-reference loading modal */}
      {crossRefLoading && (
        <div className="network-crossref-modal-overlay">
          <div className="network-crossref-modal">
            <div className="network-crossref-spinner" />
            <p className="network-crossref-modal-title">Analyzing your connections...</p>
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

      {/* Name prompt modal */}
      {showNameModal && (
        <div className="network-crossref-modal-overlay">
          <div className="network-crossref-modal network-onboarding-modal">
            <p className="network-onboarding-title">One more thing</p>
            <p className="network-onboarding-body">
              Now that you&rsquo;ve uploaded your connections, you&rsquo;re ready to start reaching
              out to folks in your network. What name should we put at the end of these outreach
              emails?
            </p>
            <input
              type="text"
              className="network-name-input"
              placeholder="Your name"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); }}
              autoFocus
            />
            <div className="network-onboarding-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setShowNameModal(false)}
              >
                Skip for now
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveName}
                disabled={!nameInput.trim() || nameSaving}
              >
                {nameSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <h1 className="page-title">Network</h1>
      </div>

      {/* Card shown full-width before connections are uploaded */}
      {(!stats || stats.total === 0) && (
        <div className="section">
          <NetworkAnalysisCard
            key={scoreKey}
            onboardingCompleted={onboardingCompleted}
            compact
            onScoresLoaded={(leads) => {
              const map: Record<string, number> = {};
              for (const l of leads) map[l.id] = l.score;
              setScoreMap(map);
            }}
          />
        </div>
      )}

      {/* Onboarding prompt — only shown before any connections are loaded */}
      {stats?.total === 0 && !preview && (
        <div className="network-empty-upload">
          <div className="network-empty-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h3 className="network-empty-title">Unlock your network</h3>
          <p className="network-empty-subtitle">
            Upload your LinkedIn connections to see who you know at companies hiring for your target roles.
          </p>
          <div className="network-empty-steps">
            <div className="network-empty-step">
              <span className="network-empty-step-num">1</span>
              <span>Go to <a href="https://www.linkedin.com/mypreferences/d/categories/privacy" target="_blank" rel="noopener noreferrer">LinkedIn → Settings &amp; Privacy</a></span>
            </div>
            <div className="network-empty-step">
              <span className="network-empty-step-num">2</span>
              <span>Click <strong>Data Privacy</strong> → <strong>Download my data</strong> → select <strong>Connections</strong> → click <strong>Request archive</strong></span>
            </div>
            <div className="network-empty-step">
              <span className="network-empty-step-num">3</span>
              <span>LinkedIn will email you a download link — <strong>this can take up to 24 hours</strong></span>
            </div>
            <div className="network-empty-step">
              <span className="network-empty-step-num">4</span>
              <span>Come back and upload the Connections.csv file using the button below</span>
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        style={{ display: "none" }}
        onChange={handleFileChange}
        onClick={() => { if (fileInputRef.current) fileInputRef.current.value = ""; }}
      />

      {/* Upload button — only shown before connections exist; after upload it moves to card header */}
      {(!stats || stats.total === 0) && (
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
          <button
            className="btn btn-primary"
            onClick={() => fileInputRef.current?.click()}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload LinkedIn Connections.csv file
          </button>
        </div>
      )}

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

      {/* Two-column layout when connections exist and in matches view */}
      {stats && stats.total > 0 && activeView === "matches" && (
        <div className="network-split-layout">
          {/* Left: sticky chart */}
          <div className="network-split-col-chart">
            <NetworkAnalysisCard
              key={scoreKey}
              onboardingCompleted={onboardingCompleted}
              onRerun={crossRefMatches.length > 0 ? runCrossReference : undefined}
              rerunLoading={crossRefLoading}
              onUpload={() => fileInputRef.current?.click()}
              onScoresLoaded={(leads) => {
                const map: Record<string, number> = {};
                for (const l of leads) map[l.id] = l.score;
                setScoreMap(map);
              }}
              onBarClick={(range) => setActiveScoreRange(range[0] === -1 ? null : range)}
              activeScoreRange={activeScoreRange}
              leadIdFilter={crossRefMatches.length > 0 ? new Set(crossRefMatches.map((m) => m.lead_id)) : undefined}
            />
          </div>

          {/* Right: stats + analysis */}
          <div className="network-split-col-results">
            <div className="network-stats-row">
              <div className="network-stat-card network-stat-card--accent" style={{ cursor: "pointer" }} onClick={() => setActiveView("matches")}>
                <div className="network-stat-value">{matchStats.matchCount.toLocaleString()}</div>
                <div className="network-stat-label">
                  {activeScoreRange ? (() => {
                    const zone = SCORE_BUCKETS.find((b) => b.range[0] === activeScoreRange[0])?.zone;
                    const label = zone === "high" ? "Strong" : zone === "medium" ? "Moderate" : "Low";
                    return `${label} Lead Matches`;
                  })() : "Lead Matches"}
                </div>
              </div>
              <div className="network-stat-card" style={{ cursor: "pointer" }} onClick={() => setActiveView("matches")}>
                <div className="network-stat-value">{matchStats.uniqueCompanies.toLocaleString()}</div>
                <div className="network-stat-label">{activeScoreRange ? "Matched Co." : "Companies"}</div>
              </div>
              <div className="network-stat-card" style={{ cursor: "pointer" }} onClick={() => { setActiveView("network"); setFilterHasEmail(true); }}>
                <div className="network-stat-value">{matchStats.withEmail.toLocaleString()}</div>
                <div className="network-stat-label">Have Email</div>
              </div>
              <div className="network-stat-card" style={{ cursor: "pointer" }} onClick={() => setActiveView("network")}>
                <div className="network-stat-value">{matchStats.totalConnections.toLocaleString()}</div>
                <div className="network-stat-label">Connections</div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
              <button
                className="btn"
                onClick={handleCreateList}
                disabled={!crossRefMatches.length}
                style={{ fontSize: 12 }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 5 }}>
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                {activeScoreRange ? `Create List (${matchStats.matchCount})` : "Create List"}
              </button>
            </div>

        <div className="network-crossref-section">
          {/* Header */}
          <div className="network-crossref-header">
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <strong>LinkedIn Lead Analysis</strong>
              {crossRefRunAt && (
                <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                  Last run {new Date(crossRefRunAt).toLocaleDateString()}
                </span>
              )}
              {activeScoreRange && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, background: "var(--accent)", color: "#fff", borderRadius: 4, padding: "2px 8px" }}>
                  Score {activeScoreRange[0]}–{activeScoreRange[1]}
                  <button
                    onClick={() => setActiveScoreRange(null)}
                    style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 0, lineHeight: 1, fontSize: 14 }}
                    aria-label="Clear score filter"
                  >×</button>
                </span>
              )}
            </div>
          </div>

          <div className="network-chips-row" style={{ marginTop: 0, marginBottom: 10 }}>
            <button
              onClick={() => setPlanFilterEmailOnly((v) => !v)}
              className={`network-chip${planFilterEmailOnly ? " network-chip--active" : ""}`}
              style={{ fontSize: "8pt" }}
            >
              Has email
            </button>
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
            {(deselectedRoles.size > 0 || planFilterEmailOnly) && (
              <button
                className="network-chip-clear"
                onClick={() => { setDeselectedRoles(new Set()); setPlanFilterEmailOnly(false); }}
              >
                Clear
              </button>
            )}
          </div>

          {/* Plan groups */}
          {planGroups.length > 0 && (
            <>
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
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                                    <path d="M19 0h-14c-2.76 0-5 2.24-5 5v14c0 2.76 2.24 5 5 5h14c2.76 0 5-2.24 5-5v-14c0-2.76-2.24-5-5-5zm-11 19h-3v-10h3v10zm-1.5-11.27c-.97 0-1.75-.79-1.75-1.76s.78-1.75 1.75-1.75 1.75.78 1.75 1.75-.78 1.76-1.75 1.76zm13.5 11.27h-3v-5.6c0-1.34-.03-3.07-1.87-3.07-1.87 0-2.16 1.46-2.16 2.97v5.7h-3v-10h2.88v1.36h.04c.4-.76 1.38-1.56 2.84-1.56 3.04 0 3.6 2 3.6 4.59v5.61z"/>
                                  </svg>
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
                        <span className="network-plan-chevron">{isExpanded ? "Hide Leads ▲" : "Show Leads ▼"}</span>
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
                              {g.uniqueEmails.some((e) => e) && (
                                <button
                                  className="network-email-icon-btn"
                                  onClick={() => openTemplateModal(m, g)}
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                  </svg>
                                  Send email using outreach template
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
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                                        <path d="M19 0h-14c-2.76 0-5 2.24-5 5v14c0 2.76 2.24 5 5 5h14c2.76 0 5-2.24 5-5v-14c0-2.76-2.24-5-5-5zm-11 19h-3v-10h3v10zm-1.5-11.27c-.97 0-1.75-.79-1.75-1.76s.78-1.75 1.75-1.75 1.75.78 1.75 1.75-.78 1.76-1.75 1.76zm13.5 11.27h-3v-5.6c0-1.34-.03-3.07-1.87-3.07-1.87 0-2.16 1.46-2.16 2.97v5.7h-3v-10h2.88v1.36h.04c.4-.76 1.38-1.56 2.84-1.56 3.04 0 3.6 2 3.6 4.59v5.61z"/>
                                      </svg>
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
          </div>
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
          {stats && stats.total > 0 && (
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
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}

          {loading ? (
            <div className="loading-state">Loading...</div>
          ) : connections.length === 0 && !search ? (
            <div className="network-empty-upload">
              <div className="network-empty-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <h3 className="network-empty-title">Unlock your network</h3>
              <p className="network-empty-subtitle">
                Upload your LinkedIn connections to see who you know at companies hiring for your target roles.
              </p>
              <div className="network-empty-steps">
                <div className="network-empty-step">
                  <span className="network-empty-step-num">1</span>
                  <span>Go to <a href="https://www.linkedin.com/mypreferences/d/categories/privacy" target="_blank" rel="noopener noreferrer">LinkedIn → Settings &amp; Privacy</a></span>
                </div>
                <div className="network-empty-step">
                  <span className="network-empty-step-num">2</span>
                  <span>Click <strong>Data Privacy</strong> → <strong>Download my data</strong> → select <strong>Connections</strong> → click <strong>Request archive</strong></span>
                </div>
                <div className="network-empty-step">
                  <span className="network-empty-step-num">3</span>
                  <span>LinkedIn will email you a download link — <strong>this can take up to 24 hours</strong></span>
                </div>
                <div className="network-empty-step">
                  <span className="network-empty-step-num">4</span>
                  <span>Come back and upload the Connections.csv using the button above</span>
                </div>
              </div>
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

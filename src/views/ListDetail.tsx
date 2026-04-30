"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import api from "../api/client";
import { useToast } from "../hooks/useToast";
import { useAuth } from "../contexts/AuthContext";
import { getErrorMessage } from "../lib/errors";
import CompanyLogo from "../components/CompanyLogo";
import "./Network.css";

type Lead = {
  _id: string;
  title?: string;
  company?: string;
  location?: string;
  datePosted?: string;
  compensation?: { raw?: string; min?: number; max?: number };
};

type NetworkRunMatch = {
  connection_count: number;
  connection_names: string[];
  connection_urls: string[];
  connection_emails: string[];
};

type UserList = {
  _id: string;
  name: string;
  description?: string;
  leadIds: string[];
  metadata?: {
    type: string;
    run_at: string;
    matches: Record<string, NetworkRunMatch>;
  } | null;
};

type Props = {
  listId: string;
};

const ListDetail = ({ listId }: Props) => {
  const router = useRouter();
  const { showToast, toastElement } = useToast();
  const { preferredRoles } = useAuth();

  const [list, setList] = useState<UserList | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [savedLeads, setSavedLeads] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Filters
  const [selectedTitleChips, setSelectedTitleChips] = useState<Set<string>>(new Set());
  const [filterRemote, setFilterRemote] = useState(false);
  const [filterHybrid, setFilterHybrid] = useState(false);
  const [filterHasEmail, setFilterHasEmail] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [listData, allLeadsData, userLeadsData] = await Promise.all([
        api.userLists.getById(listId) as Promise<UserList>,
        api.leads.getAll({ page: 1, limit: 10000 }) as Promise<{ leads?: Lead[] }>,
        api.userLeads.getAll() as Promise<{ leadId?: string | { _id?: string } }[]>,
      ]);

      setList(listData);

      const leadIdSet = new Set(listData.leadIds || []);
      const listLeads = (allLeadsData.leads || []).filter((l) => leadIdSet.has(l._id));
      setLeads(listLeads);

      const savedIds = new Set(
        userLeadsData
          .map((ul) => (typeof ul.leadId === "string" ? ul.leadId : ul.leadId?._id))
          .filter(Boolean) as string[]
      );
      setSavedLeads(savedIds);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [listId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveLead = async (leadId: string) => {
    try {
      await api.userLeads.save({ leadId });
      setSavedLeads((prev) => new Set([...prev, leadId]));
      showToast("Lead saved!", "success");
    } catch (err) {
      showToast(`Error: ${getErrorMessage(err)}`, "error");
    }
  };

  const isNetworkRun = list?.metadata?.type === "network_run";

  // Title chips: preferred roles that match at least one lead in this list
  const titleChips = useMemo(() => {
    const roles = preferredRoles || [];
    if (!roles.length || !leads.length) return [];
    return roles.filter((role) =>
      leads.some((l) => l.title?.toLowerCase().includes(role.toLowerCase()))
    );
  }, [preferredRoles, leads]);

  const hasActiveFilters =
    selectedTitleChips.size > 0 || filterRemote || filterHybrid || filterHasEmail || search.trim().length > 0;

  function clearFilters() {
    setSelectedTitleChips(new Set());
    setFilterRemote(false);
    setFilterHybrid(false);
    setFilterHasEmail(false);
    setSearch("");
  }

  function toggleTitleChip(role: string) {
    setSelectedTitleChips((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  }

  const filteredLeads = leads.filter((lead) => {
    if (search) {
      const q = search.toLowerCase();
      if (
        !lead.title?.toLowerCase().includes(q) &&
        !lead.company?.toLowerCase().includes(q) &&
        !lead.location?.toLowerCase().includes(q)
      ) return false;
    }
    if (selectedTitleChips.size > 0) {
      if (!Array.from(selectedTitleChips).some((role) =>
        lead.title?.toLowerCase().includes(role.toLowerCase())
      )) return false;
    }
    const locLower = lead.location?.toLowerCase() ?? "";
    if (filterRemote && !locLower.includes("remote")) return false;
    if (filterHybrid && !locLower.includes("hybrid")) return false;
    if (filterHasEmail && isNetworkRun) {
      const match = list!.metadata!.matches[lead._id];
      if (!match?.connection_emails.some((e) => e)) return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="container">
        <div className="main">
          <div className="page-title">Loading list…</div>
        </div>
      </div>
    );
  }

  if (error || !list) {
    return (
      <div className="container">
        <div className="main">
          <Link href="/lists" style={{ fontSize: 13, color: "var(--accent)", textDecoration: "none" }}>← All Lists</Link>
          <div className="page-title">List not found</div>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const showChipsRow = titleChips.length > 0 || isNetworkRun;

  return (
    <div className="container">
      <div className="main">
        <div style={{ marginBottom: 8 }}>
          <Link href="/lists" style={{ fontSize: 13, color: "var(--accent)", textDecoration: "none" }}>
            ← All Lists
          </Link>
        </div>
        <div className="page-title">{list.name}</div>
        {!isNetworkRun && list.description && (() => {
          const chips = list.description
            .replace(/^leads matching:\s*/i, "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          return (
            <div className="leads-chips-row" style={{ marginBottom: 12, pointerEvents: "none" }}>
              {chips.map((chip) => (
                <span key={chip} className="leads-chip leads-chip--active" style={{ opacity: 0.7, cursor: "default" }}>
                  {chip}
                </span>
              ))}
            </div>
          );
        })()}

        <div className="actions">
          <button className="btn" onClick={fetchData}>Refresh</button>
          <Link href="/leads" className="btn">Find more leads</Link>
        </div>

        <div className="search-bar">
          <input
            type="text"
            className="search-input"
            placeholder="Search by position, company, or location…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {showChipsRow && (
          <div className="leads-chips-row">
            {titleChips.map((role) => (
              <button
                key={role}
                type="button"
                className={`leads-chip${selectedTitleChips.has(role) ? " leads-chip--active" : ""}`}
                onClick={() => toggleTitleChip(role)}
              >
                {role}
              </button>
            ))}
            {titleChips.length > 0 && <span className="leads-chips-divider" />}
            <button
              type="button"
              className={`leads-chip leads-chip--location${filterRemote ? " leads-chip--active" : ""}`}
              onClick={() => setFilterRemote((v) => !v)}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 4, flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              Remote
            </button>
            <button
              type="button"
              className={`leads-chip leads-chip--location${filterHybrid ? " leads-chip--active" : ""}`}
              onClick={() => setFilterHybrid((v) => !v)}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 4, flexShrink: 0 }}>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              Hybrid
            </button>
            {isNetworkRun && (
              <button
                type="button"
                className={`leads-chip leads-chip--location${filterHasEmail ? " leads-chip--active" : ""}`}
                onClick={() => setFilterHasEmail((v) => !v)}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 4, flexShrink: 0 }}>
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                </svg>
                Has Email
              </button>
            )}
            {hasActiveFilters && (
              <button type="button" className="leads-chip-clear" onClick={clearFilters}>
                Clear
              </button>
            )}
          </div>
        )}

        <span className="leads-count">{filteredLeads.length} lead{filteredLeads.length !== 1 ? "s" : ""}</span>

        <div className="leads-cards-container">
          {filteredLeads.length > 0 ? (
            filteredLeads.map((lead) => {
              const comp = lead.compensation?.raw ||
                (lead.compensation?.min && lead.compensation?.max
                  ? `$${lead.compensation.min}–$${lead.compensation.max}`
                  : null);
              const locLower = lead.location?.toLowerCase() ?? "";
              const isRemote = locLower.includes("remote");
              const isHybrid = locLower.includes("hybrid");

              return (
                <div
                  key={lead._id}
                  className={`lead-card ${savedLeads.has(lead._id) ? "lead-card--saved" : ""}`}
                  onClick={() => router.push(`/leads/${lead._id}`)}
                >
                  {lead.company && <CompanyLogo company={lead.company} />}

                  <div className="lead-card-body">
                    <div className="lead-card-top">
                      <Link
                        href={`/leads/${lead._id}`}
                        className="lead-card-title"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {lead.title}
                      </Link>
                    </div>

                    {lead.company && (
                      <div className="lead-card-company">{lead.company}</div>
                    )}

                    <div className="lead-card-tags">
                      {lead.location && (
                        <span className={`lead-card-tag lead-card-tag--location ${isRemote ? "lead-card-tag--remote" : ""} ${isHybrid ? "lead-card-tag--hybrid" : ""}`}>
                          {isRemote ? (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                              <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                            </svg>
                          ) : (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                            </svg>
                          )}
                          {lead.location}
                        </span>
                      )}
                      {comp && (
                        <span className="lead-card-tag lead-card-tag--comp">{comp}</span>
                      )}
                      {lead.datePosted && (
                        <span className="lead-card-tag lead-card-tag--date">
                          {new Date(lead.datePosted).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      )}
                    </div>

                    {isNetworkRun && (() => {
                      const match = list!.metadata!.matches[lead._id];
                      if (!match) return null;
                      return (
                        <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
                          <span className="network-match-count">
                            {match.connection_count}
                          </span>
                          {match.connection_names.map((name, i) => {
                            const url = match.connection_urls[i];
                            return url ? (
                              <a
                                key={i}
                                href={url}
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
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  <div className="lead-card-actions" onClick={(e) => e.stopPropagation()}>
                    {savedLeads.has(lead._id) ? (
                      <button className="lead-card-save lead-card-save--saved" disabled>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                        </svg>
                        Saved
                      </button>
                    ) : (
                      <button className="lead-card-save" onClick={() => handleSaveLead(lead._id)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                        </svg>
                        Save
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ textAlign: "center", padding: "2rem" }}>
              {hasActiveFilters ? "No leads match the active filters." : "No leads in this list."}
            </div>
          )}
        </div>
      </div>
      {toastElement}
    </div>
  );
};

export default ListDetail;

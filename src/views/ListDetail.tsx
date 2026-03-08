"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import api, { onboardingAPI } from "../api/client";
import { useToast } from "../hooks/useToast";
import { getErrorMessage } from "../lib/errors";

type Lead = {
  _id: string;
  title?: string;
  company?: string;
  location?: string;
  team?: string;
  industry?: string;
  datePosted?: string;
  compensation?: { raw?: string; min?: number; max?: number };
  contactName?: string;
  contactEmail?: string;
};

type UserLead = {
  _id: string;
  leadId?: string | Lead;
  priority?: "high" | "medium" | "low" | string;
  currentStatus?: string;
};

type UserList = {
  _id: string;
  name: string;
  description?: string;
  leadIds: string[];
};

type Props = {
  listId: string;
};

const ListDetail = ({ listId }: Props) => {
  const router = useRouter();
  const { showToast, toastElement } = useToast();

  const [list, setList] = useState<UserList | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [savedLeads, setSavedLeads] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, any>>({
    companies: new Set<string>(),
    locations: new Set<string>(),
    industries: new Set<string>(),
    teams: new Set<string>(),
    saved: false,
    hideSaved: false,
  });
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    locations: true,
    companies: true,
    industries: true,
    teams: true,
    saved: true,
  });
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const leadsPerPage = 50;

  const toggleCollapse = (category: string) => {
    setCollapsed((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [listData, allLeadsData, userLeadsData] = await Promise.all([
        api.userLists.getById(listId) as Promise<UserList>,
        api.leads.getAll({ page: 1, limit: 10000 }) as Promise<{ leads?: Lead[] }>,
        api.userLeads.getAll() as Promise<UserLead[]>,
      ]);

      setList(listData);

      // Filter all leads to only those in the list
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

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, searchQuery]);

  const handleRefresh = async () => {
    if (!list) return;
    setRefreshing(true);
    try {
      const result = await onboardingAPI.refresh(listId) as { leadCount?: number };
      showToast(`List refreshed — ${result.leadCount ?? 0} leads found`, "success");
      await fetchData();
    } catch (err) {
      showToast(`Error refreshing: ${getErrorMessage(err)}`, "error");
    } finally {
      setRefreshing(false);
    }
  };

  const handleSaveLead = async (leadId: string) => {
    try {
      await api.userLeads.save({ leadId });
      setSavedLeads((prev) => new Set([...prev, leadId]));
      showToast("Lead saved!", "success");
    } catch (err) {
      showToast(`Error saving lead: ${getErrorMessage(err)}`, "error");
    }
  };

  const toggleFilter = (category: string, value: string) => {
    setFilters((prev) => {
      const newFilters = { ...prev };
      const categorySet = new Set(newFilters[category]);
      if (categorySet.has(value)) categorySet.delete(value);
      else categorySet.add(value);
      newFilters[category] = categorySet;
      return newFilters;
    });
  };

  const toggleSavedFilter = () => {
    setFilters((prev) => ({ ...prev, saved: !prev.saved, hideSaved: false }));
  };

  const toggleHideSavedFilter = () => {
    setFilters((prev) => ({ ...prev, hideSaved: !prev.hideSaved, saved: false }));
  };

  const clearAllFilters = () => {
    setFilters({
      companies: new Set<string>(),
      locations: new Set<string>(),
      industries: new Set<string>(),
      teams: new Set<string>(),
      saved: false,
      hideSaved: false,
    });
  };

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
          <div className="page-title">List not found</div>
          <p>{error}</p>
          <button onClick={() => router.back()}>Go back</button>
        </div>
      </div>
    );
  }

  const uniqueCompanies = [...new Set(leads.map((l) => l.company).filter(Boolean))].sort() as string[];
  const uniqueLocations = [...new Set(leads.map((l) => l.location).filter(Boolean))].sort((a, b) => {
    const aR = a!.toLowerCase().includes("remote");
    const bR = b!.toLowerCase().includes("remote");
    if (aR && !bR) return -1;
    if (!aR && bR) return 1;
    return a!.localeCompare(b!);
  }) as string[];
  const uniqueIndustries = [...new Set(leads.map((l) => l.industry).filter(Boolean))].sort() as string[];
  const uniqueTeams = [...new Set(leads.map((l) => l.team).filter(Boolean))].sort() as string[];

  const filteredLeads = leads
    .filter((lead) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (
          !lead.title?.toLowerCase().includes(q) &&
          !lead.company?.toLowerCase().includes(q) &&
          !lead.location?.toLowerCase().includes(q)
        )
          return false;
      }
      if (filters.saved && !savedLeads.has(lead._id)) return false;
      if (filters.hideSaved && savedLeads.has(lead._id)) return false;
      if (filters.companies.size > 0 && !filters.companies.has(lead.company)) return false;
      if (filters.locations.size > 0 && !filters.locations.has(lead.location)) return false;
      if (filters.industries.size > 0 && !filters.industries.has(lead.industry)) return false;
      if (filters.teams.size > 0 && !filters.teams.has(lead.team)) return false;
      return true;
    })
    .sort((a, b) => {
      const aS = savedLeads.has(a._id);
      const bS = savedLeads.has(b._id);
      if (aS && !bS) return -1;
      if (!aS && bS) return 1;
      const aDate = a.datePosted ? new Date(a.datePosted) : new Date(0);
      const bDate = b.datePosted ? new Date(b.datePosted) : new Date(0);
      return bDate.getTime() - aDate.getTime();
    });

  const totalPages = Math.ceil(filteredLeads.length / leadsPerPage);
  const paginated = filteredLeads.slice((currentPage - 1) * leadsPerPage, currentPage * leadsPerPage);

  return (
    <div className="container">
      <div className="main">
        <div style={{ marginBottom: 8 }}>
          <Link href="/lists" style={{ fontSize: 13, color: "var(--accent)", textDecoration: "none" }}>
            ← All Lists
          </Link>
        </div>
        <div className="page-title">{list.name}</div>
        {list.description && <p className="list-description">{list.description}</p>}

        <div className="search-bar">
          <input
            type="text"
            className="search-input"
            placeholder="Search by position, company, or location…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="stats">
          <span>{filteredLeads.length} leads</span>
        </div>

        <div className="actions">
          <button className="btn" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "Refresh List"}
          </button>
        </div>

        <button className="filter-toggle-btn" onClick={() => setFilterDrawerOpen(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </svg>
          Filters
        </button>

        <div className="leads-content">
          <div className={`filter-sidebar ${filterDrawerOpen ? "open" : ""}`}>
            <div className="filter-section">
              <div className="filter-header">
                <div className="filter-title">Filters</div>
                <button className="clear-filters-btn" onClick={clearAllFilters}>Clear All</button>
              </div>

              <div className="filter-group">
                <div className="filter-group-header" onClick={() => toggleCollapse("saved")}>
                  <span className="filter-group-title">Saved</span>
                  <span className="collapse-icon">{collapsed.saved ? "+" : "−"}</span>
                </div>
                {!collapsed.saved && (
                  <div className="filter-group-content">
                    <label className="filter-checkbox">
                      <input type="checkbox" checked={filters.saved} onChange={toggleSavedFilter} />
                      <span>Saved Only</span>
                    </label>
                    <label className="filter-checkbox">
                      <input type="checkbox" checked={filters.hideSaved} onChange={toggleHideSavedFilter} />
                      <span>Hide Saved</span>
                    </label>
                  </div>
                )}
              </div>

              {[
                { key: "teams", label: "Team", values: uniqueTeams },
                { key: "locations", label: "Location", values: uniqueLocations },
                { key: "companies", label: "Company", values: uniqueCompanies },
                { key: "industries", label: "Industry", values: uniqueIndustries },
              ].map(({ key, label, values }) => (
                <div key={key} className="filter-group">
                  <div className="filter-group-header" onClick={() => toggleCollapse(key)}>
                    <span className="filter-group-title">{label}</span>
                    <span className="collapse-icon">{collapsed[key] ? "+" : "−"}</span>
                  </div>
                  {!collapsed[key] && (
                    <div className="filter-group-content">
                      {values.map((v) => (
                        <label key={v} className="filter-checkbox">
                          <input
                            type="checkbox"
                            checked={filters[key].has(v)}
                            onChange={() => toggleFilter(key, v)}
                          />
                          <span>{v}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              <button className="show-results-btn" onClick={() => setFilterDrawerOpen(false)}>
                Show Results ({filteredLeads.length})
              </button>
            </div>
          </div>

          <div className="leads-table-container">
            <table className="leads-table">
              <thead>
                <tr>
                  <th>Position</th>
                  <th>Company</th>
                  <th>Location</th>
                  <th>Team</th>
                  <th>Compensation</th>
                  <th>Date Posted</th>
                  <th>Contact</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((lead) => (
                  <tr
                    key={lead._id}
                    onClick={() => router.push(`/leads/${lead._id}`)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>
                      <Link href={`/leads/${lead._id}`} className="position-link">
                        {lead.title}
                      </Link>
                    </td>
                    <td>{lead.company}</td>
                    <td>{lead.location}</td>
                    <td>{lead.team || "N/A"}</td>
                    <td>
                      <span className="comp">
                        {lead.compensation?.raw ||
                          (lead.compensation?.min && lead.compensation?.max
                            ? `$${lead.compensation.min}–$${lead.compensation.max}`
                            : "N/A")}
                      </span>
                    </td>
                    <td>
                      {lead.datePosted ? new Date(lead.datePosted).toLocaleDateString() : "N/A"}
                    </td>
                    <td>{lead.contactName || "N/A"}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {savedLeads.has(lead._id) ? (
                        <button className="action-btn saved" disabled>Saved</button>
                      ) : (
                        <button className="action-btn" onClick={() => handleSaveLead(lead._id)}>
                          Save
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredLeads.length === 0 && leads.length > 0 && (
              <div style={{ textAlign: "center", padding: "2rem" }}>
                <p>No leads match the selected filters.</p>
              </div>
            )}

            {leads.length === 0 && (
              <div style={{ textAlign: "center", padding: "2rem" }}>
                <p>No leads found for this list. Try refreshing.</p>
                <button className="btn" onClick={handleRefresh} disabled={refreshing}>
                  {refreshing ? "Refreshing…" : "Refresh List"}
                </button>
              </div>
            )}

            {totalPages > 1 && (
              <div className="pagination">
                <button className="pagination-btn" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>First</button>
                <button className="pagination-btn" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</button>
                <span className="pagination-info">Page {currentPage} of {totalPages} ({filteredLeads.length} results)</span>
                <button className="pagination-btn" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</button>
                <button className="pagination-btn" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>Last</button>
              </div>
            )}
          </div>
        </div>
      </div>
      {toastElement}
    </div>
  );
};

export default ListDetail;

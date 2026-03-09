// Updated Leads.jsx component with API integration
// Place this in: src/pages/Leads.jsx

"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { getErrorMessage } from '../lib/errors';
import AddToListModal from '../components/AddToListModal';
import CompanyLogo from '../components/CompanyLogo';

const ROLE_CHIPS = [
  "Solutions Engineer",
  "Sales Engineer",
  "Technical Account Manager",
  "Customer Success Manager",
  "Customer Success Engineer",
  "Solutions Architect",
  "Implementation Specialist",
  "Software Engineer",
  "Product Manager",
  "DevOps / Platform Engineer",
  "Data Engineer",
  "UX / Product Designer",
];

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

const Leads = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showToast, toastElement } = useToast();
  const { preferredRoles } = useAuth();

  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [addToListTarget, setAddToListTarget] = useState<string[] | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [savedLeads, setSavedLeads] = useState<Set<string>>(new Set());
  const [userLeadsMap, setUserLeadsMap] = useState<Map<string, UserLead>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Chip filter state — initialized from preferredRoles once they load
  const [selectedChips, setSelectedChips] = useState<Set<string>>(new Set());
  const chipsInitialized = useRef(false);

  // Saved filter: 'all' | 'saved' | 'unsaved'
  const [savedFilter, setSavedFilter] = useState<'all' | 'saved' | 'unsaved'>('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const leadsPerPage = 50;

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // Initialize chips from preferredRoles once available
  useEffect(() => {
    if (!chipsInitialized.current && preferredRoles.length > 0) {
      const roleSet = new Set([...ROLE_CHIPS, 'Remote', 'Hybrid']);
      setSelectedChips(new Set(preferredRoles.filter(r => roleSet.has(r))));
      chipsInitialized.current = true;
    }
  }, [preferredRoles]);

  // Reset page on filter/search change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedChips, searchQuery, savedFilter]);

  useEffect(() => {
    fetchLeads();
  }, [pathname, searchParams]);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const response = (await api.leads.getAll({ page: 1, limit: 10000 })) as { leads?: Lead[]; totalLeads?: number };
      setLeads(response.leads || []);

      const userLeadsResponse = (await api.userLeads.getAll()) as UserLead[];
      const savedLeadIds = new Set(
        userLeadsResponse
          .map((ul) => typeof ul.leadId === "string" ? ul.leadId : ul.leadId?._id)
          .filter(Boolean) as string[]
      );
      setSavedLeads(savedLeadIds);

      const ulMap = new Map<string, UserLead>();
      userLeadsResponse.forEach((ul) => {
        const leadId = typeof ul.leadId === "string" ? ul.leadId : ul.leadId?._id;
        if (leadId) ulMap.set(leadId, ul);
      });
      setUserLeadsMap(ulMap);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLead = async (leadId: string) => {
    try {
      await api.userLeads.save({ leadId });
      setSavedLeads(prev => new Set([...prev, leadId]));
    } catch (err) {
      showToast(`Error saving lead: ${getErrorMessage(err)}`, 'error');
    }
  };

  // Chips derived from saved preferences
  const allValidChips = new Set([...ROLE_CHIPS, 'Remote', 'Hybrid']);
  const preferredChips = new Set(preferredRoles.filter(r => allValidChips.has(r)));

  const setsEqual = (a: Set<string>, b: Set<string>) =>
    a.size === b.size && [...a].every(v => b.has(v));

  const isAtPreferred = preferredChips.size > 0 && setsEqual(selectedChips, preferredChips);
  const hasPreferred = preferredChips.size > 0;

  const toggleChip = (chip: string) => {
    setSelectedChips(prev => {
      const next = new Set(prev);
      if (next.has(chip)) next.delete(chip);
      else next.add(chip);
      return next;
    });
  };

  const clearChips = () => setSelectedChips(new Set());
  const resetToPreferred = () => setSelectedChips(new Set(preferredChips));

  if (loading) {
    return (
      <div className="container">
        <div className="main">
          <div className="page-title">Loading leads...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="main">
          <div className="page-title">Error loading leads</div>
          <p>{error}</p>
          <button onClick={fetchLeads}>Retry</button>
        </div>
      </div>
    );
  }

  // Filter and sort
  // Chips only apply in "All" tab — Saved/New show everything in that category
  const chipsActive = selectedChips.size > 0 && savedFilter === 'all';

  const filteredAndSortedLeads = [...leads]
    .filter(lead => {
      // Chip filter — role chips filter by title, Remote/Hybrid by location
      if (chipsActive) {
        const title = lead.title?.toLowerCase() ?? '';
        const location = lead.location?.toLowerCase() ?? '';
        const matchesChip = [...selectedChips].some(chip => {
          if (chip === 'Remote') return location.includes('remote');
          if (chip === 'Hybrid') return location.includes('hybrid');
          return title.includes(chip.toLowerCase());
        });
        if (!matchesChip) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          lead.title?.toLowerCase().includes(q) ||
          lead.company?.toLowerCase().includes(q) ||
          lead.location?.toLowerCase().includes(q);
        if (!matches) return false;
      }

      // Saved filter
      if (savedFilter === 'saved' && !savedLeads.has(lead._id)) return false;
      if (savedFilter === 'unsaved' && savedLeads.has(lead._id)) return false;

      return true;
    })
    .sort((a, b) => {
      const aIsSaved = savedLeads.has(a._id);
      const bIsSaved = savedLeads.has(b._id);
      const aUserLead = userLeadsMap.get(a._id);
      const bUserLead = userLeadsMap.get(b._id);

      const priorityValue: Record<string, number> = { high: 3, medium: 2, low: 1 };
      const aPriority = aUserLead?.priority ? (priorityValue[aUserLead.priority] ?? 0) : 0;
      const bPriority = bUserLead?.priority ? (priorityValue[bUserLead.priority] ?? 0) : 0;

      if (aIsSaved && bIsSaved && aPriority > 0 && bPriority > 0) return bPriority - aPriority;
      if (aIsSaved && !bIsSaved) return -1;
      if (!aIsSaved && bIsSaved) return 1;

      const aDate = a.datePosted ? new Date(a.datePosted) : new Date(0);
      const bDate = b.datePosted ? new Date(b.datePosted) : new Date(0);
      return bDate.getTime() - aDate.getTime();
    });

  const hasPriorities = Array.from(userLeadsMap.values()).some(ul => ul.priority);

  const filteredTotalPages = Math.ceil(filteredAndSortedLeads.length / leadsPerPage);
  const startIndex = (currentPage - 1) * leadsPerPage;
  const paginatedLeads = filteredAndSortedLeads.slice(startIndex, startIndex + leadsPerPage);

  return (
    <div className="container">
      <div className="main">
        <div className="page-title">Leads</div>

        <div className="search-bar">
          <input
            type="text"
            className="search-input"
            placeholder="Search by position, company, or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Role + location chips — selected float to front */}
        <div className="leads-chips-row">
          {[...ROLE_CHIPS].sort((a, b) => {
            const aSelected = selectedChips.has(a) ? 0 : 1;
            const bSelected = selectedChips.has(b) ? 0 : 1;
            return aSelected - bSelected;
          }).map(chip => (
            <button
              key={chip}
              type="button"
              className={`leads-chip ${selectedChips.has(chip) ? 'leads-chip--active' : ''}`}
              onClick={() => toggleChip(chip)}
            >
              {chip}
            </button>
          ))}
          <span className="leads-chips-divider" />
          {['Remote', 'Hybrid'].map(chip => (
            <button
              key={chip}
              type="button"
              className={`leads-chip leads-chip--location ${selectedChips.has(chip) ? 'leads-chip--active' : ''}`}
              onClick={() => toggleChip(chip)}
            >
              {chip}
            </button>
          ))}
          {hasPreferred && !isAtPreferred && (
            <button type="button" className="leads-chip-clear" onClick={resetToPreferred}>
              Reset to my roles
            </button>
          )}
          {!hasPreferred && selectedChips.size > 0 && (
            <button type="button" className="leads-chip-clear" onClick={clearChips}>
              Clear
            </button>
          )}
        </div>

        {/* Saved filter toggles + actions */}
        <div className="leads-toolbar">
          <div className="leads-saved-tabs">
            {(['all', 'saved', 'unsaved'] as const).map(opt => (
              <button
                key={opt}
                type="button"
                className={`leads-saved-tab ${savedFilter === opt ? 'leads-saved-tab--active' : ''}`}
                onClick={() => setSavedFilter(opt)}
              >
                {opt === 'all' ? 'All' : opt === 'saved' ? 'Saved' : 'New'}
              </button>
            ))}
          </div>

          <div className="leads-toolbar-actions">
            <span className="leads-count">{filteredAndSortedLeads.length} leads</span>
            <button className="btn" onClick={fetchLeads}>Refresh</button>
            <button
              className="btn"
              onClick={() => setAddToListTarget(filteredAndSortedLeads.map(l => l._id))}
              disabled={filteredAndSortedLeads.length === 0}
            >
              Save to List
            </button>
            <Link href="/leads/new" className="btn-add-lead">Add Lead</Link>
          </div>
        </div>

        <div className="leads-cards-container">
          {/* Select-all row */}
          {paginatedLeads.length > 0 && (
            <div className="leads-select-all-row">
              <label className="leads-select-all-label">
                <input
                  type="checkbox"
                  checked={paginatedLeads.every(l => selectedLeads.has(l._id))}
                  onChange={e => {
                    if (e.target.checked) {
                      setSelectedLeads(prev => new Set([...prev, ...paginatedLeads.map(l => l._id)]));
                    } else {
                      setSelectedLeads(prev => {
                        const next = new Set(prev);
                        paginatedLeads.forEach(l => next.delete(l._id));
                        return next;
                      });
                    }
                  }}
                />
                <span>Select all on page</span>
              </label>
            </div>
          )}


          {paginatedLeads.map(lead => {
            const userLead = userLeadsMap.get(lead._id);
            const comp = lead.compensation?.raw ||
              (lead.compensation?.min && lead.compensation?.max
                ? `$${lead.compensation.min}–$${lead.compensation.max}`
                : null);
            const locLower = lead.location?.toLowerCase() ?? '';
            const isRemote = locLower.includes('remote');
            const isHybrid = locLower.includes('hybrid');

            return (
              <div
                key={lead._id}
                className={`lead-card ${savedLeads.has(lead._id) ? 'lead-card--saved' : ''}`}
                onClick={() => router.push(`/leads/${lead._id}`)}
              >
                {lead.company && <CompanyLogo company={lead.company} />}

                <div className="lead-card-body">
                  <div className="lead-card-top">
                    <Link
                      href={`/leads/${lead._id}`}
                      className="lead-card-title"
                      onClick={e => e.stopPropagation()}
                    >
                      {lead.title}
                    </Link>
                    {hasPriorities && userLead?.priority && (
                      <span className={`priority-badge priority-${userLead.priority}`}>{userLead.priority}</span>
                    )}
                  </div>

                  {lead.company && (
                    <div className="lead-card-company">{lead.company}</div>
                  )}

                  <div className="lead-card-tags">
                    {lead.location && (
                      <span className={`lead-card-tag lead-card-tag--location ${isRemote ? 'lead-card-tag--remote' : ''} ${isHybrid ? 'lead-card-tag--hybrid' : ''}`}>
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
                        {new Date(lead.datePosted).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    )}
                    {lead.contactName && (
                      <span className="lead-card-tag lead-card-tag--contact">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                        </svg>
                        {lead.contactName}
                      </span>
                    )}
                  </div>
                </div>

                <div className="lead-card-actions" onClick={e => e.stopPropagation()}>
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
                  <input
                    type="checkbox"
                    className="lead-card-checkbox"
                    checked={selectedLeads.has(lead._id)}
                    onChange={e => {
                      setSelectedLeads(prev => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(lead._id);
                        else next.delete(lead._id);
                        return next;
                      });
                    }}
                  />
                </div>
              </div>
            );
          })}

          {filteredAndSortedLeads.length === 0 && leads.length > 0 && (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <p>No leads match your current filters.</p>
              {selectedChips.size > 0 && (
                <button className="btn" onClick={clearChips} style={{ marginTop: 8 }}>Clear role filters</button>
              )}
            </div>
          )}

          {leads.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <p>No leads found. Import your CSV to get started!</p>
            </div>
          )}

          {filteredTotalPages > 1 && (
            <div className="pagination">
              <button className="pagination-btn" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>First</button>
              <button className="pagination-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</button>
              <span className="pagination-info">Page {currentPage} of {filteredTotalPages} ({filteredAndSortedLeads.length} results)</span>
              <button className="pagination-btn" onClick={() => setCurrentPage(p => Math.min(filteredTotalPages, p + 1))} disabled={currentPage === filteredTotalPages}>Next</button>
              <button className="pagination-btn" onClick={() => setCurrentPage(filteredTotalPages)} disabled={currentPage === filteredTotalPages}>Last</button>
            </div>
          )}
        </div>
      </div>

      {selectedLeads.size > 0 && (
        <div className="leads-action-bar">
          <span className="leads-action-bar-count">{selectedLeads.size} selected</span>
          <button className="leads-action-bar-btn" onClick={() => setAddToListTarget([...selectedLeads])}>
            Add to List
          </button>
          <button className="leads-action-bar-clear" onClick={() => setSelectedLeads(new Set())}>
            Clear
          </button>
        </div>
      )}

      {addToListTarget && (
        <AddToListModal
          leadIds={addToListTarget}
          onDismiss={() => setAddToListTarget(null)}
          onSuccess={msg => {
            showToast(msg, 'success');
            setAddToListTarget(null);
            setSelectedLeads(new Set());
          }}
        />
      )}

      {toastElement}
    </div>
  );
};

export default Leads;

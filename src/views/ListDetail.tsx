"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import api from "../api/client";
import { useToast } from "../hooks/useToast";
import { getErrorMessage } from "../lib/errors";
import CompanyLogo from "../components/CompanyLogo";

type Lead = {
  _id: string;
  title?: string;
  company?: string;
  location?: string;
  datePosted?: string;
  compensation?: { raw?: string; min?: number; max?: number };
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
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

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

  const filteredLeads = leads.filter((lead) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      lead.title?.toLowerCase().includes(q) ||
      lead.company?.toLowerCase().includes(q) ||
      lead.location?.toLowerCase().includes(q)
    );
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

  return (
    <div className="container">
      <div className="main">
        <div style={{ marginBottom: 8 }}>
          <Link href="/lists" style={{ fontSize: 13, color: "var(--accent)", textDecoration: "none" }}>
            ← All Lists
          </Link>
        </div>
        <div className="page-title">{list.name}</div>
        {list.description && (
          <p style={{ color: "#888", fontSize: "13px", margin: "0 0 12px" }}>{list.description}</p>
        )}

        <div className="actions">
          <button className="btn" onClick={fetchData}>Refresh</button>
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

        <div className="leads-cards-container">
          {filteredLeads.length > 0 ? (
            filteredLeads.map((lead) => {
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
                    </div>
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
              {search ? `No leads matching "${search}"` : "No leads in this list."}
            </div>
          )}
        </div>
      </div>
      {toastElement}
    </div>
  );
};

export default ListDetail;

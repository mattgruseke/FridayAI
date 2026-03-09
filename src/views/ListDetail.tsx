"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import api from "../api/client";
import { useToast } from "../hooks/useToast";
import { getErrorMessage } from "../lib/errors";

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

        <input
          type="text"
          className="referral-search"
          placeholder="Search by position, company, or location…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="referrals-table-container">
          <table className="referrals-table">
            <thead>
              <tr>
                <th>Position</th>
                <th>Company</th>
                <th>Location</th>
                <th>Compensation</th>
                <th>Date Posted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.length > 0 ? (
                filteredLeads.map((lead) => (
                  <tr
                    key={lead._id}
                    onClick={() => router.push(`/leads/${lead._id}`)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>
                      <Link
                        href={`/leads/${lead._id}`}
                        className="referral-link"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {lead.title}
                      </Link>
                    </td>
                    <td>{lead.company || "N/A"}</td>
                    <td>{lead.location || "N/A"}</td>
                    <td>
                      {lead.compensation?.raw ||
                        (lead.compensation?.min && lead.compensation?.max
                          ? `$${lead.compensation.min}–$${lead.compensation.max}`
                          : "N/A")}
                    </td>
                    <td>
                      {lead.datePosted
                        ? new Date(lead.datePosted).toLocaleDateString()
                        : "N/A"}
                    </td>
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
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "2rem" }}>
                    {search
                      ? `No leads matching "${search}"`
                      : "No leads in this list."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {toastElement}
    </div>
  );
};

export default ListDetail;

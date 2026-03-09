"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import api from "../api/client";
import { useToast } from "../hooks/useToast";
import { getErrorMessage } from "../lib/errors";

type UserList = {
  _id: string;
  name: string;
  description?: string;
  leadIds: string[];
  createdAt?: string;
};

const Lists = () => {
  const router = useRouter();
  const { showToast, toastElement } = useToast();
  const [lists, setLists] = useState<UserList[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filteredLists = lists.filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return l.name.toLowerCase().includes(q) || l.description?.toLowerCase().includes(q);
  });

  const fetchLists = async () => {
    try {
      setLoading(true);
      const data = (await api.userLists.getAll()) as UserList[];
      setLists(data || []);
    } catch (err) {
      showToast(`Error loading lists: ${getErrorMessage(err)}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLists();
  }, []);

  const handleDelete = async (list: UserList) => {
    if (!confirm(`Delete "${list.name}"? This cannot be undone.`)) return;
    setDeletingId(list._id);
    try {
      await api.userLists.delete(list._id);
      setLists((prev) => prev.filter((l) => l._id !== list._id));
      showToast(`"${list.name}" deleted`, "success");
    } catch (err) {
      showToast(`Error deleting list: ${getErrorMessage(err)}`, "error");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="main">
          <div className="page-title">Loading lists...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="main">
        <div className="page-title">Lists</div>

        <div className="actions">
          <button className="btn" onClick={fetchLists}>Refresh</button>
        </div>

        <input
          type="text"
          className="referral-search"
          placeholder="Search lists..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="referrals-table-container">
          <table className="referrals-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Leads</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredLists.length > 0 ? (
                filteredLists.map((list) => (
                  <tr
                    key={list._id}
                    onClick={() => router.push(`/lists/${list._id}`)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>
                      <Link
                        href={`/lists/${list._id}`}
                        className="referral-link"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {list.name}
                      </Link>
                    </td>
                    <td style={{ color: "#999", fontStyle: list.description ? "normal" : "italic" }}>
                      {list.description || "—"}
                    </td>
                    <td>
                      <span className="linked-leads-count">{list.leadIds.length}</span>
                    </td>
                    <td>
                      {list.createdAt
                        ? new Date(list.createdAt).toLocaleDateString()
                        : "—"}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        className="list-delete-btn"
                        onClick={() => handleDelete(list)}
                        disabled={deletingId === list._id}
                        title="Delete list"
                      >
                        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                          <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "2rem" }}>
                    {search
                      ? `No lists matching "${search}"`
                      : 'No lists yet. Go to Leads and use "Save Filtered to List" to get started.'}
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

export default Lists;

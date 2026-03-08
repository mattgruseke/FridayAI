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

  const fetchLists = async () => {
    try {
      setLoading(true);
      const data = await api.userLists.getAll() as UserList[];
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
          <div className="page-title">Lists</div>
          <p style={{ color: "#999" }}>Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="main">
        <div className="page-title">Lists</div>

        {lists.length === 0 ? (
          <div className="lists-empty">
            <p>You don't have any lists yet.</p>
            <p>
              Go to <Link href="/leads">Leads</Link> and use "Save Filtered to List" or select rows to add leads to a list.
            </p>
          </div>
        ) : (
          <div className="lists-grid">
            {lists.map((list) => (
              <div
                key={list._id}
                className="list-card"
                onClick={() => router.push(`/lists/${list._id}`)}
              >
                <div className="list-card-body">
                  <div className="list-card-name">{list.name}</div>
                  {list.description && (
                    <div className="list-card-description">{list.description}</div>
                  )}
                  <div className="list-card-meta">
                    {list.leadIds.length} lead{list.leadIds.length !== 1 ? "s" : ""}
                    {list.createdAt && (
                      <> · Created {new Date(list.createdAt).toLocaleDateString()}</>
                    )}
                  </div>
                </div>
                <div className="list-card-actions">
                  <Link
                    href={`/lists/${list._id}`}
                    className="btn"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View
                  </Link>
                  <button
                    className="list-card-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(list);
                    }}
                    disabled={deletingId === list._id}
                    title="Delete list"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {toastElement}
    </div>
  );
};

export default Lists;

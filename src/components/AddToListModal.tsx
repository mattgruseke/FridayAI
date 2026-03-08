"use client";

import { useState, useEffect } from "react";
import api from "@/api/client";

type UserList = {
  _id: string;
  name: string;
  leadIds: string[];
};

type Props = {
  leadIds: string[];
  onDismiss: () => void;
  onSuccess: (message: string) => void;
};

export default function AddToListModal({ leadIds, onDismiss, onSuccess }: Props) {
  const [lists, setLists] = useState<UserList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [newListName, setNewListName] = useState("");
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    const fetchLists = async () => {
      try {
        const data = await api.userLists.getAll() as UserList[];
        setLists(data || []);
        if (data?.length === 0) setMode("new");
        else if (data?.length > 0) setSelectedListId(data[0]._id);
      } finally {
        setFetching(false);
      }
    };
    fetchLists();
  }, []);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      if (mode === "new") {
        if (!newListName.trim()) return;
        await api.userLists.create({ name: newListName.trim(), leadIds });
        onSuccess(`Added ${leadIds.length} lead${leadIds.length !== 1 ? "s" : ""} to "${newListName.trim()}"`);
      } else {
        const list = lists.find((l) => l._id === selectedListId);
        if (!list) return;
        const merged = [...new Set([...list.leadIds, ...leadIds])];
        await api.userLists.update(selectedListId, { name: list.name, leadIds: merged });
        const added = merged.length - list.leadIds.length;
        onSuccess(`Added ${added} new lead${added !== 1 ? "s" : ""} to "${list.name}"`);
      }
      onDismiss();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content atl-modal">
        <div className="modal-header">
          <h3>Add to List</h3>
          <button className="modal-close" onClick={onDismiss}>
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <p className="modal-instruction">
            {leadIds.length} lead{leadIds.length !== 1 ? "s" : ""} selected
          </p>

          {!fetching && lists.length > 0 && (
            <div className="atl-tabs">
              <button
                className={`atl-tab ${mode === "existing" ? "atl-tab--active" : ""}`}
                onClick={() => setMode("existing")}
              >
                Existing list
              </button>
              <button
                className={`atl-tab ${mode === "new" ? "atl-tab--active" : ""}`}
                onClick={() => setMode("new")}
              >
                New list
              </button>
            </div>
          )}

          {fetching ? (
            <p style={{ color: "#999", fontSize: "14px" }}>Loading lists…</p>
          ) : mode === "existing" && lists.length > 0 ? (
            <select
              className="modal-input"
              value={selectedListId}
              onChange={(e) => setSelectedListId(e.target.value)}
            >
              {lists.map((l) => (
                <option key={l._id} value={l._id}>
                  {l.name} ({l.leadIds.length} leads)
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              className="modal-input"
              placeholder="List name"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              autoFocus
            />
          )}
        </div>

        <div className="modal-footer">
          <button className="modal-cancel-btn" onClick={onDismiss} disabled={loading}>
            Cancel
          </button>
          <button
            className="modal-save-btn"
            onClick={handleConfirm}
            disabled={loading || (mode === "new" && !newListName.trim()) || (mode === "existing" && !selectedListId)}
          >
            {loading ? "Saving…" : "Add to List"}
          </button>
        </div>
      </div>
    </div>
  );
}

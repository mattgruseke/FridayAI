"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import api from "../api/client";
import type { Item } from "../api/client";
import { useToast } from "../hooks/useToast";
import { getErrorMessage } from "../lib/errors";

// Sample feature: a per-user list with create / toggle / delete.
// Use it as the pattern for your own resources (view → api client → route → table).
const Items = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const { showToast, toastElement } = useToast();

  useEffect(() => {
    api.items
      .getAll()
      .then(setItems)
      .catch((err) => showToast(getErrorMessage(err), "error"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const created = await api.items.create(title);
      setItems((prev) => [created, ...prev]);
      setTitle("");
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (item: Item) => {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)));
    try {
      await api.items.update(item.id, { done: !item.done });
    } catch (err) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
      showToast(getErrorMessage(err), "error");
    }
  };

  const handleDelete = async (item: Item) => {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    try {
      await api.items.delete(item.id);
      showToast("Item deleted");
    } catch (err) {
      setItems((prev) => [item, ...prev]);
      showToast(getErrorMessage(err), "error");
    }
  };

  return (
    <div className="container">
      <div className="main">
        <div className="section">
          <div className="section-header">
            <span>Items</span>
            <span className="item-meta">{items.filter((i) => !i.done).length} open</span>
          </div>

          <form className="inline-form" onSubmit={handleAdd}>
            <input
              className="input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add an item..."
              aria-label="New item title"
            />
            <button className="btn" type="submit" disabled={saving || !title.trim()}>
              {saving ? "Adding..." : "Add"}
            </button>
          </form>

          {loading ? (
            <div className="list-item">
              <div className="item-meta">Loading...</div>
            </div>
          ) : items.length === 0 ? (
            <div className="list-item">
              <div className="item-content">
                <div className="item-title muted">No items yet</div>
                <div className="item-meta">Add one above to see the round trip to Supabase.</div>
              </div>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="list-item">
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={() => handleToggle(item)}
                  aria-label={item.done ? "Mark as open" : "Mark as done"}
                />
                <div className="item-content">
                  <div className={`item-title${item.done ? " item-title--done" : ""}`}>
                    {item.title}
                  </div>
                  <div className="item-meta">
                    {new Date(item.created_at).toLocaleDateString()}
                  </div>
                </div>
                <button
                  className="btn-link btn-link--danger"
                  onClick={() => handleDelete(item)}
                >
                  delete
                </button>
              </div>
            ))
          )}
        </div>
      </div>
      {toastElement}
    </div>
  );
};

export default Items;

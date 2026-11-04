"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import api from "../api/client";
import type { Item, ItemCategory } from "../api/client";
import { useToast } from "../hooks/useToast";
import { getErrorMessage } from "../lib/errors";
import Calendar from "../components/Calendar";
import TaskList from "../components/TaskList";
import ViewToggle from "../components/ViewToggle";
import type { View } from "../components/ViewToggle";

// A per-user list of one category's items with create, plus TaskList's
// reorder / toggle / delete.
// Used by the home, entertainment and food pages.
type ItemsProps = {
  category: ItemCategory;
  heading: string;
};

const Items = ({ category, heading }: ItemsProps) => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<View>("list");
  const { showToast, toastElement } = useToast();

  useEffect(() => {
    api.items
      .getAll(category)
      .then(setItems)
      .catch((err) => showToast(getErrorMessage(err), "error"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const handleAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const created = await api.items.create(title, category);
      setItems((prev) => [...prev, created]);
      setTitle("");
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container">
      <div className="main">
        <div className="section">
          <div className="section-header">
            <span>{heading}</span>
            <ViewToggle view={view} onChange={setView} />
          </div>

          {view === "calendar" ? (
            <Calendar />
          ) : (
            <>
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
            ) : (
              <TaskList
                items={items}
                setItems={setItems}
                showToast={showToast}
                emptyHint="Add one above to get started."
              />
            )}
            </>
          )}
        </div>
      </div>
      {toastElement}
    </div>
  );
};

export default Items;

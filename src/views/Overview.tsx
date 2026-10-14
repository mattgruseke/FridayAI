"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import api from "../api/client";
import type { Item } from "../api/client";
import { useToast } from "../hooks/useToast";
import { getErrorMessage } from "../lib/errors";
import Calendar from "../components/Calendar";
import ViewToggle from "../components/ViewToggle";
import type { View } from "../components/ViewToggle";

// Landing page: every item across all areas, each tagged with the area it
// belongs to. Tags link to that area's page.
const Overview = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("list");
  const { showToast, toastElement } = useToast();

  useEffect(() => {
    api.items
      .getAll()
      .then(setItems)
      .catch((err) => showToast(getErrorMessage(err), "error"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="container">
      <div className="main">
        <div className="section">
          <div className="section-header">
            <span>All items</span>
            <ViewToggle view={view} onChange={setView} />
          </div>

          {view === "calendar" ? (
            <Calendar />
          ) : loading ? (
            <div className="list-item">
              <div className="item-meta">Loading...</div>
            </div>
          ) : items.length === 0 ? (
            <div className="list-item">
              <div className="item-content">
                <div className="item-title muted">No items yet</div>
                <div className="item-meta">Add some from the home, entertainment or food tabs.</div>
              </div>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="list-item">
                <div className="item-content">
                  <div className={`item-title${item.done ? " item-title--done" : ""}`}>
                    {item.title}
                  </div>
                  <div className="item-meta">
                    {new Date(item.created_at).toLocaleDateString()}
                  </div>
                </div>
                <Link href={`/${item.category}`} className="area-tag">
                  {item.category}
                </Link>
              </div>
            ))
          )}
        </div>
      </div>
      {toastElement}
    </div>
  );
};

export default Overview;

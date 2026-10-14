"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import api from "../api/client";
import type { Item } from "../api/client";

// Signed-in landing page. Replace with your app's dashboard.
const Home = () => {
  const { user, fullName } = useAuth();
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    api.items.getAll().then(setItems).catch(() => setItems([]));
  }, []);

  const name = fullName || user?.email?.split("@")[0] || "there";
  const openCount = items?.filter((i) => !i.done).length ?? 0;

  return (
    <div className="container">
      <div className="main">
        <div className="section">
          <div className="section-header">
            <span>Welcome, {name}</span>
          </div>
          <div className="section-body">
            <p>
              You&apos;re signed in. This page lives in{" "}
              <code>src/views/Home.tsx</code> — swap it for your own dashboard.
            </p>
          </div>
        </div>

        <div className="section">
          <div className="section-header">
            <span>Items</span>
            <Link href="/items">view all</Link>
          </div>
          <div className="list-item">
            <div className="item-content">
              <div className="item-title">
                {items === null
                  ? "Loading..."
                  : `${openCount} open of ${items.length} item${items.length !== 1 ? "s" : ""}`}
              </div>
              <div className="item-meta">
                A sample per-user CRUD feature backed by the <code>items</code> table.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;

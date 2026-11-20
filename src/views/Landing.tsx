"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import api from "../api/client";
import type { Item } from "../api/client";
import { useToast } from "../hooks/useToast";

// The Dashboard, and the signed-in landing page for now: greeting, ask bar, and
// "On your radar" — open tasks, highest priority first.

const RADAR_LIMIT = 4;

const greetingFor = (hour: number) =>
  hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

const Landing = () => {
  const { user, fullName } = useAuth();
  const [items, setItems] = useState<Item[] | null>(null);
  const [question, setQuestion] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { showToast, toastElement } = useToast();

  useEffect(() => {
    api.items
      .getAll()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  const name = fullName.split(" ")[0] || user?.email?.split("@")[0] || "there";
  const open = (items ?? []).filter((i) => !i.done);
  const radar = open.slice(0, RADAR_LIMIT);

  const handleAsk = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!question.trim()) return;
    showToast("Friday can't answer questions yet — coming soon.", "info");
  };

  const prefill = (text: string) => {
    setQuestion(text);
    inputRef.current?.focus();
  };

  return (
    <div className="landing">
      <h1 className="greeting">
        {greetingFor(new Date().getHours())}, {name}.
      </h1>
      <p className="greeting-sub">Here&apos;s what&apos;s on deck for today.</p>

      <form className="ask-bar" onSubmit={handleAsk}>
        <input
          ref={inputRef}
          type="text"
          placeholder="What do you need?"
          aria-label="Ask Friday"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button type="submit" className="ask-btn" aria-label="Ask">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="2" width="6" height="12" rx="3" />
            <path d="M5 10v1a7 7 0 0 0 14 0v-1" />
            <line x1="12" y1="18" x2="12" y2="22" />
          </svg>
        </button>
      </form>

      <div className="chip-row">
        <Link href="/today" className="chip">
          Show me today
        </Link>
        <button type="button" className="chip" onClick={() => prefill("Help me plan ")}>
          Help me plan
        </button>
        <Link href="/intake" className="chip">
          Teach you something
        </Link>
      </div>

      <div className="radar-label">On your radar</div>
      {items === null ? (
        <p className="radar-empty">Loading…</p>
      ) : radar.length === 0 ? (
        <p className="radar-empty">
          Nothing on your radar yet.{" "}
          <Link href="/intake">Start with the home intake →</Link>
        </p>
      ) : (
        <div className="feed">
          {radar.map((item) => (
            <Link key={item.id} href={`/tasks#task-${item.id}`} className="feed-item">
              <span className="feed-marker" />
              <span className="feed-body">
                <span className="feed-agent">Task</span>
                <span className="feed-title">{item.title}</span>
                <span className="feed-sub">
                  Added {new Date(item.created_at).toLocaleDateString(undefined, { month: "long", day: "numeric" })}
                </span>
                <span className="feed-cta">Open task →</span>
              </span>
            </Link>
          ))}
        </div>
      )}

      {open.length > RADAR_LIMIT && (
        <Link href="/tasks" className="radar-more">
          + {open.length - RADAR_LIMIT} more tasks →
        </Link>
      )}

      {toastElement}
    </div>
  );
};

export default Landing;

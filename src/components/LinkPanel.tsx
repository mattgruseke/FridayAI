"use client";

import { useEffect, useMemo, useState } from "react";
import api from "../api/client";
import type { DumpItem, Entry, Item, Link, LinkType } from "../api/client";
import { findTarget } from "../config/lists";
import { getErrorMessage } from "../lib/errors";

const MAX_RESULTS = 8;

// The links on one thing: what it's linked to, and a search for linking something
// else. Links go both ways, so each side shows the other.
const LinkPanel = ({ type, id }: { type: LinkType; id: string }) => {
  const [links, setLinks] = useState<Link[] | null>(null);
  const [tasks, setTasks] = useState<Item[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [dumps, setDumps] = useState<DumpItem[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.lists.links.getAll(), api.items.getAll(), api.lists.entries.getAll(), api.lists.dump.getAll()])
      .then(([loadedLinks, loadedTasks, loadedEntries, loadedDumps]) => {
        setLinks(loadedLinks);
        setTasks(loadedTasks);
        setEntries(loadedEntries);
        setDumps(loadedDumps);
      })
      .catch((err) => setError(getErrorMessage(err)));
  }, []);

  const sources = { tasks, entries, dumps };

  const linked = (links ?? []).flatMap((link) => {
    const isA = link.a_type === type && link.a_id === id;
    const isB = link.b_type === type && link.b_id === id;
    if (!isA && !isB) return [];
    const target = isA ? findTarget(link.b_type, link.b_id, sources) : findTarget(link.a_type, link.a_id, sources);
    return target ? [{ link, target }] : [];
  });

  const results = useMemo(() => {
    const words = query.trim().toLowerCase();
    if (!words) return [];
    const taken = new Set(linked.map(({ target }) => `${target.type}:${target.id}`));
    const candidates = [
      ...tasks.map((t) => findTarget("task", t.id, sources)),
      ...entries.map((e) => findTarget("entry", e.id, sources)),
    ];
    return candidates
      .filter((c) => c !== null)
      .filter((c) => !(c.type === type && c.id === id) && !taken.has(`${c.type}:${c.id}`))
      .filter((c) => c.title.toLowerCase().includes(words))
      .slice(0, MAX_RESULTS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, tasks, entries, links]);

  const add = async (target: { type: LinkType; id: string }) => {
    try {
      const created = await api.lists.links.create({ a_type: type, a_id: id, b_type: target.type, b_id: target.id });
      setLinks((prev) => [...(prev ?? []), created]);
      setQuery("");
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const remove = async (link: Link) => {
    setLinks((prev) => (prev ?? []).filter((l) => l.id !== link.id));
    try {
      await api.lists.links.delete(link.id);
    } catch (err) {
      setLinks((prev) => [...(prev ?? []), link]);
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="link-panel">
      <span className="task-field-label">Linked</span>
      {links === null && !error && <span className="item-meta">Loading...</span>}
      {links !== null && linked.length === 0 && <span className="item-meta">Nothing linked yet.</span>}
      {linked.length > 0 && (
        <ul className="link-list">
          {linked.map(({ link, target }) => (
            <li key={link.id} className="link-item">
              {/* A plain link, so jumping to another item on the same page opens it. */}
              <a className={`link-chip${target.faded ? " link-chip--faded" : ""}`} href={target.href}>
                <span className="link-kind">{target.label}</span>
                <span className="link-title">{target.title}</span>
              </a>
              <button type="button" className="btn-link" aria-label={`Unlink ${target.title}`} onClick={() => remove(link)}>
                unlink
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        className="input link-search"
        type="text"
        value={query}
        placeholder="Link to a task, goal, idea or note..."
        aria-label="Find something to link"
        onChange={(e) => setQuery(e.target.value)}
      />
      {query.trim() && (
        <ul className="link-results" aria-label="Things you can link">
          {results.length === 0 ? (
            <li className="item-meta">No matches</li>
          ) : (
            results.map((target) => (
              <li key={`${target.type}:${target.id}`}>
                <button type="button" className="link-result" onClick={() => add(target)}>
                  <span className="link-kind">{target.label}</span> {target.title}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
      {error && <span className="fc-gap-text item-meta">{error}</span>}
    </div>
  );
};

export default LinkPanel;

"use client";

import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import api from "../api/client";
import type { MediaMatch, WatchItem, WatchItemInput } from "../api/client";
import {
  ALL_PLATFORMS,
  MEDIA_KINDS,
  mediaKind,
  platformsFor,
  UNKNOWN_PLATFORM,
  VIBES,
} from "../config/entertainment";
import type { MediaKind, Vibe } from "../config/entertainment";
import { useToast } from "../hooks/useToast";
import { getErrorMessage } from "../lib/errors";
import { Field } from "./HomeRecordFields";
import "../components/TaskList.css";
import "./Entertainment.css";

type KindFilter = MediaKind | "all" | "unsorted";

// Everything the API needs to save an entry, from the entry plus what changed.
const inputOf = ({ id: _id, created_at: _created, ...rest }: WatchItem): WatchItemInput => rest;

const kindOf = (item: WatchItem) => item.media_kind ?? null;
const platformOf = (item: WatchItem) => item.platform ?? null;
const vibesOf = (item: WatchItem) => item.vibes ?? [];

// Matches the title, notes, type, platform and vibes, so "light netflix" finds light
// things on Netflix: every word has to match something.
const matchesSearch = (item: WatchItem, search: string) => {
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const kind = mediaKind(kindOf(item));
  const haystack = [
    item.title,
    item.notes ?? "",
    kind ? `${kind.label} ${kind.plural}` : "",
    platformOf(item) ?? UNKNOWN_PLATFORM,
    ...vibesOf(item),
  ]
    .join(" ")
    .toLowerCase();
  return words.every((w) => haystack.includes(w));
};

// The platform options for a kind, keeping one already saved that isn't on its list.
const platformOptions = (kind: MediaKind | null, current: string | null) => {
  const options = platformsFor(kind);
  return current && !options.includes(current) ? [current, ...options] : options;
};

const PlatformSelect = ({
  kind,
  value,
  onChange,
  label,
}: {
  kind: MediaKind | null;
  value: string | null;
  onChange: (platform: string | null) => void;
  label?: string;
}) => (
  <select
    className="input"
    aria-label={label}
    value={value ?? ""}
    onChange={(e) => onChange(e.target.value || null)}
  >
    <option value="">{label ? `${label}: unknown` : UNKNOWN_PLATFORM}</option>
    {platformOptions(kind, value).map((p) => (
      <option key={p} value={p}>
        {p}
      </option>
    ))}
  </select>
);

const KindSelect = ({
  value,
  onChange,
  label,
}: {
  value: MediaKind | null;
  onChange: (kind: MediaKind | null) => void;
  label?: string;
}) => (
  <select
    className="input"
    aria-label={label}
    value={value ?? ""}
    onChange={(e) => onChange((e.target.value || null) as MediaKind | null)}
  >
    <option value="">{label ? `${label}?` : "Not sure"}</option>
    {MEDIA_KINDS.map((k) => (
      <option key={k.id} value={k.id}>
        {k.label}
      </option>
    ))}
  </select>
);

const VibePicker = ({ value, onChange }: { value: Vibe[]; onChange: (vibes: Vibe[]) => void }) => (
  <div className="ent-vibes" role="group" aria-label="Vibes">
    {VIBES.map((vibe) => {
      const on = value.includes(vibe);
      return (
        <button
          key={vibe}
          type="button"
          className="task-status ent-chip"
          aria-pressed={on}
          onClick={() => onChange(on ? value.filter((v) => v !== vibe) : [...value, vibe])}
        >
          {vibe}
        </button>
      );
    })}
  </div>
);

const EntryForm = ({
  item,
  onSave,
  onDelete,
  onCancel,
}: {
  item: WatchItem;
  onSave: (changes: Partial<WatchItem>) => Promise<boolean>;
  onDelete: () => void;
  onCancel: () => void;
}) => {
  const [title, setTitle] = useState(item.title);
  const [kind, setKind] = useState<MediaKind | null>(kindOf(item));
  const [platform, setPlatform] = useState<string | null>(platformOf(item));
  const [vibes, setVibes] = useState<Vibe[]>(vibesOf(item));
  const [notes, setNotes] = useState(item.notes ?? "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const saved = await onSave({
      title: title.trim(),
      media_kind: kind,
      platform,
      vibes,
      notes: notes.trim() || null,
    });
    if (!saved) setSaving(false);
  };

  return (
    <form className="record-form ent-form" onSubmit={handleSubmit}>
      <Field label="Title" wide>
        <input
          className="input"
          type="text"
          required
          autoFocus
          maxLength={500}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>
      <Field label="Type">
        <KindSelect value={kind} onChange={setKind} />
      </Field>
      <Field label="Where to find it">
        <PlatformSelect kind={kind} value={platform} onChange={setPlatform} />
      </Field>
      <div className="record-field record-field--wide">
        <span className="record-label">Vibe</span>
        <VibePicker value={vibes} onChange={setVibes} />
      </div>
      <Field label="Notes" wide>
        <textarea
          className="input record-textarea"
          rows={2}
          maxLength={5000}
          value={notes}
          placeholder="Who recommended it, which season you're on..."
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>
      <div className="record-actions">
        <button className="btn" type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </button>
        <button type="button" className="btn-link" onClick={onCancel}>
          cancel
        </button>
        <button type="button" className="btn-link btn-link--danger record-delete" onClick={onDelete}>
          delete
        </button>
      </div>
    </form>
  );
};

const EntryRow = ({
  item,
  isOpen,
  onOpen,
  onToggle,
  form,
}: {
  item: WatchItem;
  isOpen: boolean;
  onOpen: () => void;
  onToggle: () => void;
  form: ReactNode;
}) => {
  const kind = mediaKind(kindOf(item));
  return (
    <div id={`watch-${item.id}`} className={`ent-row${isOpen ? " ent-row--open" : ""}`}>
      <div className="list-item ent-line">
        <input
          type="checkbox"
          checked={item.done}
          onChange={onToggle}
          aria-label={item.done ? `Put ${item.title} back on the list` : `Mark ${item.title} as ${kind?.doneLabel.toLowerCase() ?? "done"}`}
        />
        {item.image_url && (
          // eslint-disable-next-line @next/next/no-img-element -- posters come from several outside hosts
          <img className="ent-thumb" src={item.image_url} alt="" loading="lazy" />
        )}
        <div className="item-content">
          <button type="button" className="ent-title" aria-expanded={isOpen} onClick={onOpen}>
            <span className={`item-title${item.done ? " item-title--done" : ""}`}>{item.title}</span>
          </button>
          <div className="ent-tags">
            <span className={`ent-tag${kind ? "" : " ent-tag--missing"}`}>{kind?.label ?? "Type?"}</span>
            {vibesOf(item).map((v) => (
              <span key={v} className="ent-tag ent-tag--vibe">
                {v}
              </span>
            ))}
            {item.notes && <span className="ent-note" title={item.notes}>{item.notes}</span>}
          </div>
        </div>
      </div>
      {isOpen && form}
    </div>
  );
};

// Movies, TV, books and podcasts to get to, grouped by where to find them.
const Entertainment = () => {
  const [items, setItems] = useState<WatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [newKind, setNewKind] = useState<MediaKind | null>(null);
  const [newPlatform, setNewPlatform] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lookups, setLookups] = useState<MediaMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [vibeFilter, setVibeFilter] = useState<Vibe[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const { showToast, toastElement } = useToast();

  useEffect(() => {
    api.watchlist
      .getAll()
      .then((loaded) => {
        setItems(loaded);
        // A link from the Brain Dump (#watch-<id>) opens that entry.
        const target = window.location.hash.match(/^#watch-(.+)$/)?.[1];
        const linked = target ? loaded.find((i) => i.id === target) : undefined;
        if (linked) {
          if (linked.done) setShowDone(true);
          setOpenId(linked.id);
          requestAnimationFrame(() =>
            document.getElementById(`watch-${linked.id}`)?.scrollIntoView({ block: "center" })
          );
        }
      })
      .catch((err) => showToast(getErrorMessage(err), "error"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Matches for what's being typed, a moment after typing stops. A newer search
  // cancels the one before, so results never arrive out of order.
  useEffect(() => {
    const query = title.trim();
    if (query.length < 3) {
      setLookups([]);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearching(true);
      api.media
        .search(query, newKind, controller.signal)
        .then(setLookups)
        .catch(() => {
          // Search is a convenience; typing a title and pressing Add still works.
          if (!controller.signal.aborted) setLookups([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [title, newKind]);

  const addItem = async (name: string, media: Partial<WatchItemInput>) => {
    setSaving(true);
    try {
      const created = await api.watchlist.create({
        title: name,
        media_kind: null,
        platform: null,
        vibes: [],
        image_url: null,
        notes: null,
        done: false,
        done_at: null,
        ...media,
      });
      setItems((prev) => [...prev, created]);
      setTitle("");
      setLookups([]);
      setNewPlatform(null);
      // Show it, even if a filter would have hidden it.
      setKindFilter("all");
      setVibeFilter([]);
      setSearch("");
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim()) return;
    addItem(title.trim(), { media_kind: newKind, platform: newPlatform });
  };

  // A picked match brings its own type, poster and platform. A platform picked by hand wins.
  const handlePick = (match: MediaMatch) =>
    addItem(match.title, {
      media_kind: match.kind,
      platform: newPlatform ?? match.platform,
      image_url: match.image_url,
    });

  const save = async (item: WatchItem, changes: Partial<WatchItem>) => {
    try {
      const updated = await api.watchlist.update(item.id, inputOf({ ...item, ...changes }));
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
      return true;
    } catch (err) {
      showToast(getErrorMessage(err), "error");
      return false;
    }
  };

  const handleDelete = async (item: WatchItem) => {
    if (!window.confirm(`Delete "${item.title}"?`)) return;
    try {
      await api.watchlist.delete(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setOpenId(null);
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    }
  };

  const matches = (item: WatchItem) =>
    (kindFilter === "all" ||
      (kindFilter === "unsorted" ? kindOf(item) === null : kindOf(item) === kindFilter)) &&
    vibeFilter.every((v) => vibesOf(item).includes(v)) &&
    matchesSearch(item, search);

  const open = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);
  const visible = open.filter(matches);
  const filtered = kindFilter !== "all" || vibeFilter.length > 0 || search.trim() !== "";

  const platforms = [...ALL_PLATFORMS, ...new Set(open.map(platformOf).filter((p): p is string => !!p))];
  const groups = [...new Set(platforms)]
    .map((platform) => ({ platform, rows: visible.filter((i) => platformOf(i) === platform) }))
    .concat([{ platform: UNKNOWN_PLATFORM, rows: visible.filter((i) => !platformOf(i)) }])
    .filter((g) => g.rows.length > 0);

  const kindCount = (filter: KindFilter) =>
    open.filter((i) => (filter === "unsorted" ? kindOf(i) === null : kindOf(i) === filter)).length;

  const row = (item: WatchItem) => (
    <EntryRow
      key={item.id}
      item={item}
      isOpen={openId === item.id}
      onOpen={() => setOpenId(openId === item.id ? null : item.id)}
      onToggle={() => save(item, { done: !item.done, done_at: item.done ? null : new Date().toISOString() })}
      form={
        <EntryForm
          item={item}
          onSave={async (changes) => {
            const ok = await save(item, changes);
            if (ok) setOpenId(null);
            return ok;
          }}
          onDelete={() => handleDelete(item)}
          onCancel={() => setOpenId(null)}
        />
      }
    />
  );

  return (
    <div className="container">
      <div className="main">
        <div className="section">
          <div className="section-header">
            <span>Entertainment</span>
          </div>

          <form className="inline-form ent-add" onSubmit={handleAdd}>
            <input
              className="input"
              type="text"
              value={title}
              maxLength={500}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add a movie, show, book or podcast..."
              aria-label="New title"
            />
            <KindSelect value={newKind} onChange={setNewKind} label="Type" />
            <PlatformSelect kind={newKind} value={newPlatform} onChange={setNewPlatform} label="Platform" />
            <button className="btn" type="submit" disabled={saving || !title.trim()}>
              {saving ? "Adding..." : "Add"}
            </button>
          </form>

          {title.trim().length >= 3 && (lookups.length > 0 || searching) && (
            <div className="ent-matches" aria-live="polite">
              <div className="record-label">
                {searching && lookups.length === 0
                  ? "Looking it up..."
                  : `Pick one to add it${newKind ? "" : " (choose a Type to search books or podcasts)"}, or press Add to use what you typed`}
              </div>
              <div className="ent-match-row">
                {lookups.map((m) => {
                  const kind = mediaKind(m.kind);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className="ent-match"
                      disabled={saving}
                      onClick={() => handlePick(m)}
                    >
                      {m.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element -- posters come from several outside hosts
                        <img className="ent-match-poster" src={m.image_url} alt="" loading="lazy" />
                      ) : (
                        <span className="ent-match-poster ent-match-poster--none">{kind?.label}</span>
                      )}
                      <span className="ent-match-title">{m.title}</span>
                      <span className="ent-match-meta">
                        {[kind?.label, m.year].filter(Boolean).join(" · ")}
                      </span>
                      {m.byline && <span className="ent-match-meta">{m.byline}</span>}
                      <span className={`ent-tag${m.platform ? " ent-tag--vibe" : " ent-tag--missing"}`}>
                        {m.platform ?? "Platform unknown"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {open.length > 0 && (
            <div className="ent-filters">
              <input
                className="input ent-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder='Search, like "light netflix"'
                aria-label="Search the list"
              />
              <div className="ent-chip-row" role="group" aria-label="Filter by type">
                <button
                  type="button"
                  className="task-status ent-chip"
                  aria-pressed={kindFilter === "all"}
                  onClick={() => setKindFilter("all")}
                >
                  All <span className="task-filter-count">{open.length}</span>
                </button>
                {MEDIA_KINDS.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    className="task-status ent-chip"
                    aria-pressed={kindFilter === k.id}
                    onClick={() => setKindFilter(kindFilter === k.id ? "all" : k.id)}
                  >
                    {k.plural} <span className="task-filter-count">{kindCount(k.id)}</span>
                  </button>
                ))}
                {kindCount("unsorted") > 0 && (
                  <button
                    type="button"
                    className="task-status ent-chip"
                    aria-pressed={kindFilter === "unsorted"}
                    onClick={() => setKindFilter(kindFilter === "unsorted" ? "all" : "unsorted")}
                  >
                    Type not set <span className="task-filter-count">{kindCount("unsorted")}</span>
                  </button>
                )}
              </div>
              <div className="ent-chip-row" role="group" aria-label="Filter by vibe">
                <span className="record-label">In the mood for</span>
                {VIBES.map((vibe) => {
                  const on = vibeFilter.includes(vibe);
                  return (
                    <button
                      key={vibe}
                      type="button"
                      className="task-status ent-chip"
                      aria-pressed={on}
                      onClick={() => setVibeFilter(on ? vibeFilter.filter((v) => v !== vibe) : [...vibeFilter, vibe])}
                    >
                      {vibe}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {loading ? (
            <div className="list-item">
              <div className="item-meta">Loading...</div>
            </div>
          ) : open.length === 0 ? (
            <div className="list-item">
              <div className="item-content">
                <div className="item-title muted">Nothing on the list</div>
                <div className="item-meta">Add something above, with where to watch, read or listen if you know it.</div>
              </div>
            </div>
          ) : groups.length === 0 ? (
            <div className="list-item">
              <div className="item-content">
                <div className="item-title muted">Nothing matches</div>
                {filtered && (
                  <button
                    type="button"
                    className="btn-link ent-reset"
                    onClick={() => {
                      setKindFilter("all");
                      setVibeFilter([]);
                      setSearch("");
                    }}
                  >
                    clear filters
                  </button>
                )}
              </div>
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.platform}>
                <div className={`ent-group-head${g.platform === UNKNOWN_PLATFORM ? " ent-group-head--unknown" : ""}`}>
                  {g.platform === UNKNOWN_PLATFORM ? "Platform unknown" : g.platform}{" "}
                  <span className="task-count">{g.rows.length}</span>
                </div>
                {g.rows.map(row)}
              </div>
            ))
          )}

          <button
            type="button"
            className="task-heading task-heading--toggle"
            aria-expanded={showDone}
            onClick={() => setShowDone((prev) => !prev)}
          >
            <span className={`task-chevron${showDone ? " task-chevron--open" : ""}`} aria-hidden="true">
              ›
            </span>
            Finished <span className="task-count">{done.length}</span>
          </button>
          {showDone &&
            (done.length === 0 ? (
              <div className="list-item">
                <div className="item-meta">Nothing finished yet.</div>
              </div>
            ) : (
              done.map(row)
            ))}
        </div>
      </div>
      {toastElement}
    </div>
  );
};

export default Entertainment;

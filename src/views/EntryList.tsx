"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import api, { ENTRY_KINDS } from "../api/client";
import type { Entry, EntryInput, EntryKind } from "../api/client";
import LinkPanel from "../components/LinkPanel";
import { LIST_INFO } from "../config/lists";
import { useToast } from "../hooks/useToast";
import { getErrorMessage } from "../lib/errors";
import "../components/TaskList.css";

const inputOf = ({ kind, title, details, archived }: Entry): EntryInput => ({ kind, title, details, archived });

const newestFirst = (a: Entry, b: Entry) => b.created_at.localeCompare(a.created_at);

const EntryDetails = ({
  entry,
  onSave,
  onDelete,
  onClose,
}: {
  entry: Entry;
  onSave: (entry: Entry, changes: Partial<Entry>) => void;
  onDelete: (entry: Entry) => void;
  onClose: () => void;
}) => {
  const [title, setTitle] = useState(entry.title);
  const [details, setDetails] = useState(entry.details ?? "");
  return (
    <div className="task-details entry-details">
      <label className="task-field">
        <span className="task-field-label">{LIST_INFO[entry.kind].label}</span>
        <input
          className="input"
          type="text"
          maxLength={500}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            const trimmed = title.trim();
            if (!trimmed) setTitle(entry.title);
            else if (trimmed !== entry.title) onSave(entry, { title: trimmed });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
      </label>
      <label className="task-field">
        <span className="task-field-label">Details</span>
        <textarea
          className="input task-notes"
          rows={4}
          maxLength={10000}
          value={details}
          placeholder="Why it matters, what you know so far..."
          onChange={(e) => setDetails(e.target.value)}
          onBlur={() => {
            const trimmed = details.trim() || null;
            if (trimmed !== entry.details) onSave(entry, { details: trimmed });
          }}
        />
      </label>
      <LinkPanel type="entry" id={entry.id} />
      <div className="entry-actions">
        <button type="button" className="btn-link" onClick={onClose}>
          close
        </button>
        <button type="button" className="btn-link btn-link--danger" onClick={() => onDelete(entry)}>
          delete
        </button>
      </div>
    </div>
  );
};

// The Goals, Ideas or Notes page. They share one list, so moving something between
// them only changes its kind, and its links stay put.
const EntryList = ({ kind }: { kind: EntryKind }) => {
  const info = LIST_INFO[kind];
  const [entries, setEntries] = useState<Entry[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const { showToast, toastElement } = useToast();

  useEffect(() => {
    api.lists.entries
      .getAll()
      .then((loaded) => {
        setEntries(loaded);
        setStatus("ready");
      })
      .catch((err) => {
        setStatus("failed");
        showToast(getErrorMessage(err), "error");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A link to one entry (#entry-<id>) opens it.
  useEffect(() => {
    if (status !== "ready") return;
    const open = () => {
      const id = window.location.hash.match(/^#entry-(.+)$/)?.[1];
      const entry = id ? entries.find((e) => e.id === id && e.kind === kind) : undefined;
      if (!entry) return;
      setExpanded(entry.id);
      if (entry.archived) setShowArchived(true);
      requestAnimationFrame(() => document.getElementById(`entry-${entry.id}`)?.scrollIntoView({ block: "center" }));
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const mine = entries.filter((e) => e.kind === kind);
  const active = mine.filter((e) => !e.archived).sort(newestFirst);
  const archived = mine.filter((e) => e.archived).sort(newestFirst);

  const replace = (next: Entry) => setEntries((prev) => prev.map((e) => (e.id === next.id ? next : e)));

  const save = async (entry: Entry, changes: Partial<Entry>, message?: string) => {
    replace({ ...entry, ...changes });
    try {
      replace(await api.lists.entries.update(entry.id, inputOf({ ...entry, ...changes })));
      if (message) showToast(message);
    } catch (err) {
      replace(entry);
      showToast(getErrorMessage(err), "error");
    }
  };

  const handleAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim()) return;
    setAdding(true);
    try {
      const created = await api.lists.entries.create({ kind, title: title.trim(), details: null, archived: false });
      setEntries((prev) => [created, ...prev]);
      setTitle("");
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setAdding(false);
    }
  };

  const remove = async (entry: Entry) => {
    if (!window.confirm(`Delete "${entry.title}"? Archive keeps it instead.`)) return;
    setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    try {
      await api.lists.entries.delete(entry.id);
      showToast("Deleted");
    } catch (err) {
      setEntries((prev) => [...prev, entry]);
      showToast(getErrorMessage(err), "error");
    }
  };

  const row = (entry: Entry) => (
    <div key={entry.id} id={`entry-${entry.id}`} className="list-item task-row entry-row">
      <div className="item-content">
        <button
          type="button"
          className="task-open"
          aria-expanded={expanded === entry.id}
          onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
        >
          <span className={`item-title${entry.archived ? " muted" : ""}`}>
            <span>{entry.title}</span>
          </span>
          <span className="item-meta">
            {new Date(entry.created_at).toLocaleDateString()}
            {entry.details && <span className="entry-snippet"> · {entry.details.slice(0, 120)}</span>}
          </span>
        </button>
      </div>
      {entry.archived ? (
        <button type="button" className="btn-link" onClick={() => save(entry, { archived: false }, "Restored")}>
          restore
        </button>
      ) : (
        <>
          <select
            className="task-box-select"
            aria-label={`Move ${entry.title}`}
            value={entry.kind}
            onChange={(e) => {
              const next = e.target.value as EntryKind;
              if (expanded === entry.id) setExpanded(null);
              save(entry, { kind: next }, `Moved to ${LIST_INFO[next].title}`);
            }}
          >
            {ENTRY_KINDS.map((k) => (
              <option key={k} value={k}>
                {LIST_INFO[k].title}
              </option>
            ))}
          </select>
          <button type="button" className="btn-link" onClick={() => save(entry, { archived: true }, "Archived")}>
            archive
          </button>
        </>
      )}
      {expanded === entry.id && (
        <EntryDetails key={entry.id} entry={entry} onSave={save} onDelete={remove} onClose={() => setExpanded(null)} />
      )}
    </div>
  );

  return (
    <div className="container">
      <div className="main">
        <div className="section">
          <div className="section-header">
            <span>{info.title}</span>
          </div>
          <p className="item-meta entry-blurb">{info.blurb}</p>

          <form className="inline-form" onSubmit={handleAdd}>
            <input
              className="input"
              type="text"
              value={title}
              maxLength={500}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`Add ${info.label.toLowerCase() === "idea" ? "an" : "a"} ${info.label.toLowerCase()}...`}
              aria-label={`New ${info.label.toLowerCase()}`}
            />
            <button className="btn" type="submit" disabled={adding || !title.trim()}>
              {adding ? "Adding..." : "Add"}
            </button>
          </form>

          {status === "loading" && (
            <div className="list-item">
              <div className="item-meta">Loading...</div>
            </div>
          )}

          {status === "failed" && (
            <div className="list-item">
              <div className="item-content">
                <div className="item-title muted">Couldn&apos;t load {info.title.toLowerCase()}</div>
                <div className="item-meta">Refresh the page to try again.</div>
              </div>
            </div>
          )}

          {status === "ready" && (
            <>
              {active.length === 0 ? (
                <div className="list-item">
                  <div className="item-content">
                    <div className="item-title muted">No {info.title.toLowerCase()} yet</div>
                    <div className="item-meta">Add one above, or sort one in from the Brain Dump.</div>
                  </div>
                </div>
              ) : (
                active.map(row)
              )}

              <button
                type="button"
                className="task-heading task-heading--toggle"
                aria-expanded={showArchived}
                onClick={() => setShowArchived((s) => !s)}
              >
                <span className={`task-chevron${showArchived ? " task-chevron--open" : ""}`} aria-hidden="true">
                  ›
                </span>
                Archived <span className="task-count">{archived.length}</span>
              </button>
              {showArchived &&
                (archived.length === 0 ? (
                  <div className="list-item">
                    <div className="item-meta">Nothing archived.</div>
                  </div>
                ) : (
                  archived.map(row)
                ))}
            </>
          )}
        </div>
      </div>
      {toastElement}
    </div>
  );
};

export default EntryList;

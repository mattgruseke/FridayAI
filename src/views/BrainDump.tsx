"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import api, { SORT_TARGETS } from "../api/client";
import type { DumpItem, DumpItemInput, Entry, Item, SortTarget, WatchItem } from "../api/client";
import LinkPanel from "../components/LinkPanel";
import { COUNTS_EVENT, findTarget, LIST_INFO } from "../config/lists";
import { useToast } from "../hooks/useToast";
import { getErrorMessage } from "../lib/errors";
import "../components/TaskList.css";

const inputOf = ({ text, state, sorted_as, sorted_id, sorted_at }: DumpItem): DumpItemInput => ({
  text,
  state,
  sorted_as,
  sorted_id,
  sorted_at,
});

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const newestFirst = (a: DumpItem, b: DumpItem) => b.created_at.localeCompare(a.created_at);

// The editable view of one open item: its wording, and what it's linked to.
const DumpDetails = ({
  item,
  onSave,
  onClose,
}: {
  item: DumpItem;
  onSave: (item: DumpItem, text: string) => void;
  onClose: () => void;
}) => {
  const [value, setValue] = useState(item.text);
  return (
    <div className="task-details dump-details">
      <label className="task-field">
        <span className="task-field-label">What&apos;s on your mind</span>
        <textarea
          className="input task-notes"
          rows={3}
          maxLength={5000}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => {
            const trimmed = value.trim();
            if (!trimmed) setValue(item.text);
            else if (trimmed !== item.text) onSave(item, trimmed);
          }}
        />
      </label>
      <LinkPanel type="dump" id={item.id} />
      <button type="button" className="btn-link" onClick={onClose}>
        close
      </button>
    </div>
  );
};

// Everything goes in here first, with nothing to decide. Then each item gets sorted
// into Tasks, Goals, Ideas or Notes until it's empty.
const BrainDump = () => {
  const [items, setItems] = useState<DumpItem[]>([]);
  const [tasks, setTasks] = useState<Item[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [watching, setWatching] = useState<WatchItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [text, setText] = useState("");
  const [adding, setAdding] = useState(false);
  const [sorting, setSorting] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showSorted, setShowSorted] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const { showToast, toastElement } = useToast();

  useEffect(() => {
    Promise.all([
      api.lists.dump.getAll(),
      api.items.getAll(),
      api.lists.entries.getAll(),
      api.watchlist.getAll().catch(() => [] as WatchItem[]),
    ])
      .then(([loaded, loadedTasks, loadedEntries, loadedWatching]) => {
        setItems(loaded);
        setTasks(loadedTasks);
        setEntries(loadedEntries);
        setWatching(loadedWatching);
        setStatus("ready");
      })
      .catch((err) => {
        setStatus("failed");
        showToast(getErrorMessage(err), "error");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A link to one item (#dump-<id>) opens it.
  useEffect(() => {
    if (status !== "ready") return;
    const open = () => {
      const id = window.location.hash.match(/^#dump-(.+)$/)?.[1];
      const item = id ? items.find((i) => i.id === id) : undefined;
      if (!item) return;
      if (item.state === "open") setExpanded(item.id);
      if (item.state === "sorted") setShowSorted(true);
      if (item.state === "archived") setShowArchived(true);
      requestAnimationFrame(() => document.getElementById(`dump-${item.id}`)?.scrollIntoView({ block: "center" }));
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const countsChanged = () => window.dispatchEvent(new Event(COUNTS_EVENT));

  const open = items.filter((i) => i.state === "open").sort(newestFirst);
  const sorted = items
    .filter((i) => i.state === "sorted")
    .sort((a, b) => (b.sorted_at ?? "").localeCompare(a.sorted_at ?? ""));
  const archived = items.filter((i) => i.state === "archived").sort(newestFirst);

  const replace = (next: DumpItem) => setItems((prev) => prev.map((i) => (i.id === next.id ? next : i)));

  const handleAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!text.trim()) return;
    setAdding(true);
    try {
      const created = await api.lists.dump.create({
        text: text.trim(),
        state: "open",
        sorted_as: null,
        sorted_id: null,
        sorted_at: null,
      });
      setItems((prev) => [created, ...prev]);
      setText("");
      countsChanged();
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setAdding(false);
    }
  };

  const update = async (item: DumpItem, changes: Partial<DumpItem>) => {
    replace({ ...item, ...changes });
    try {
      replace(await api.lists.dump.update(item.id, inputOf({ ...item, ...changes })));
      countsChanged();
    } catch (err) {
      replace(item);
      showToast(getErrorMessage(err), "error");
    }
  };

  const sortInto = async (item: DumpItem, as: SortTarget) => {
    setSorting(item.id);
    try {
      const { item: done, target } = await api.lists.dump.sort(item.id, as);
      replace(done);
      if (as === "task") setTasks((prev) => [...prev, target as Item]);
      else if (as === "watch") setWatching((prev) => [...prev, target as WatchItem]);
      else setEntries((prev) => [...prev, target as Entry]);
      if (expanded === item.id) setExpanded(null);
      showToast(`Sorted into ${LIST_INFO[as].title}`);
      countsChanged();
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setSorting(null);
    }
  };

  const remove = async (item: DumpItem) => {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    try {
      await api.lists.dump.delete(item.id);
      showToast("Deleted");
      countsChanged();
    } catch (err) {
      setItems((prev) => [...prev, item]);
      showToast(getErrorMessage(err), "error");
    }
  };

  const sortedTo = (item: DumpItem) => {
    if (!item.sorted_as || !item.sorted_id) return null;
    if (item.sorted_as === "watch") {
      const watch = watching.find((w) => w.id === item.sorted_id);
      return {
        label: LIST_INFO.watch.label,
        target: watch ? { title: watch.title, href: `${LIST_INFO.watch.path}#watch-${watch.id}` } : null,
      };
    }
    const target = findTarget(item.sorted_as === "task" ? "task" : "entry", item.sorted_id, {
      tasks,
      entries,
      dumps: [],
    });
    return { label: LIST_INFO[item.sorted_as].label, target };
  };

  const section = (
    label: string,
    count: number,
    shown: boolean,
    toggle: () => void
  ) => (
    <button type="button" className="task-heading task-heading--toggle" aria-expanded={shown} onClick={toggle}>
      <span className={`task-chevron${shown ? " task-chevron--open" : ""}`} aria-hidden="true">
        ›
      </span>
      {label} <span className="task-count">{count}</span>
    </button>
  );

  return (
    <div className="container">
      <div className="main">
        <div className="section">
          <div className="section-header">
            <span>Brain Dump</span>
          </div>

          <form className="inline-form" onSubmit={handleAdd}>
            <input
              className="input"
              type="text"
              value={text}
              maxLength={5000}
              autoFocus
              onChange={(e) => setText(e.target.value)}
              placeholder="What's on your mind?"
              aria-label="Add to the Brain Dump"
            />
            <button className="btn" type="submit" disabled={adding || !text.trim()}>
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
                <div className="item-title muted">Couldn&apos;t load the Brain Dump</div>
                <div className="item-meta">Refresh the page to try again.</div>
              </div>
            </div>
          )}

          {status === "ready" && (
            <>
              <div className="task-heading">
                To sort <span className="task-count">{open.length}</span>
              </div>
              {open.length === 0 ? (
                <div className="list-item">
                  <div className="item-content">
                    <div className="item-title muted">{items.length === 0 ? "Nothing here yet" : "All sorted"}</div>
                    <div className="item-meta">
                      {items.length === 0
                        ? "Add anything on your mind above. Sort each one into Tasks, Goals, Ideas or Notes later."
                        : "Everything's been sorted into your lists."}
                    </div>
                  </div>
                </div>
              ) : (
                open.map((item) => (
                  <div key={item.id} id={`dump-${item.id}`} className="list-item task-row dump-row">
                    <div className="item-content">
                      <button
                        type="button"
                        className="task-open"
                        aria-expanded={expanded === item.id}
                        onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                      >
                        <span className="item-title">
                          <span className="dump-text">{item.text}</span>
                        </span>
                        <span className="item-meta">{formatWhen(item.created_at)}</span>
                      </button>
                    </div>
                    <select
                      className="task-box-select"
                      aria-label={`Sort ${item.text}`}
                      value=""
                      disabled={sorting === item.id}
                      onChange={(e) => {
                        if (e.target.value) sortInto(item, e.target.value as SortTarget);
                      }}
                    >
                      <option value="">{sorting === item.id ? "Sorting..." : "Sort into..."}</option>
                      {SORT_TARGETS.map((target) => (
                        <option key={target} value={target}>
                          {LIST_INFO[target].title}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="btn-link" onClick={() => update(item, { state: "archived" })}>
                      archive
                    </button>
                    <button type="button" className="btn-link btn-link--danger" onClick={() => remove(item)}>
                      delete
                    </button>
                    {expanded === item.id && (
                      <DumpDetails
                        key={item.id}
                        item={item}
                        onSave={(it, value) => update(it, { text: value })}
                        onClose={() => setExpanded(null)}
                      />
                    )}
                  </div>
                ))
              )}

              {section("Sorted", sorted.length, showSorted, () => setShowSorted((s) => !s))}
              {showSorted &&
                (sorted.length === 0 ? (
                  <div className="list-item">
                    <div className="item-meta">Nothing sorted yet.</div>
                  </div>
                ) : (
                  sorted.map((item) => {
                    const where = sortedTo(item);
                    return (
                      <div key={item.id} id={`dump-${item.id}`} className="list-item dump-row dump-row--sorted">
                        <div className="item-content">
                          <div className="item-title muted dump-text">{item.text}</div>
                          <div className="item-meta">
                            {where?.target ? (
                              <a className="dump-sorted-link" href={where.target.href}>
                                {where.label}: {where.target.title}
                              </a>
                            ) : (
                              <span>{where ? `${where.label} (since deleted)` : "Sorted"}</span>
                            )}
                            {item.sorted_at && <span> · {formatWhen(item.sorted_at)}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ))}

              {section("Archived", archived.length, showArchived, () => setShowArchived((s) => !s))}
              {showArchived &&
                (archived.length === 0 ? (
                  <div className="list-item">
                    <div className="item-meta">Nothing archived. Archive keeps something without sorting it.</div>
                  </div>
                ) : (
                  archived.map((item) => (
                    <div key={item.id} id={`dump-${item.id}`} className="list-item dump-row">
                      <div className="item-content">
                        <div className="item-title muted dump-text">{item.text}</div>
                        <div className="item-meta">{formatWhen(item.created_at)}</div>
                      </div>
                      <button type="button" className="btn-link" onClick={() => update(item, { state: "open" })}>
                        restore
                      </button>
                      <button type="button" className="btn-link btn-link--danger" onClick={() => remove(item)}>
                        delete
                      </button>
                    </div>
                  ))
                ))}
            </>
          )}
        </div>
      </div>
      {toastElement}
    </div>
  );
};

export default BrainDump;

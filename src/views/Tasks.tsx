"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import api, { ITEM_STATUSES } from "../api/client";
import type { Item, ItemBox, ItemFlag, ItemStatus } from "../api/client";
import TaskList from "../components/TaskList";
import { formatScheduled } from "../config/familyCalendar";
import {
  BOXES,
  boxFor,
  boxLabel,
  FLAGS,
  flagForBox,
  flagLabel,
  needsSorting,
  NOT_CATEGORIZED,
  SORTING_EVENT,
  STATUS_COLUMNS,
  STATUS_LABELS,
} from "../config/tasks";
import { useToast } from "../hooks/useToast";
import { getErrorMessage } from "../lib/errors";
import "../components/TaskList.css";
import "../views/FamilyCalendar.css";
import "../views/HomeRecords.css";
import "./Tasks.css";

const VIEWS = [
  { id: "list", label: "List" },
  { id: "boxes", label: "Boxes" },
  { id: "board", label: "Board" },
] as const;

type View = (typeof VIEWS)[number]["id"];

const VIEW_KEY = "friday.tasks.view";
const NO_FLAG = "none";

// ─── Cards and the zones they're dropped on ────────────────────────────────

const TaskCard = ({
  item,
  children,
  onToggle,
  onOpen,
}: {
  item: Item;
  children: ReactNode; // the control for moving it without dragging
  onToggle: (item: Item) => void;
  onOpen: (item: Item) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id });
  return (
    <div
      ref={setNodeRef}
      className={`task-card${isDragging ? " task-card--dragging" : ""}`}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      {...attributes}
      {...listeners}
      role="group"
      aria-label={item.title}
      tabIndex={undefined}
    >
      <div className="task-card-top">
        <input
          type="checkbox"
          checked={item.done}
          aria-label={`Mark ${item.title} as done`}
          onChange={() => onToggle(item)}
        />
        <button type="button" className="task-card-title" onClick={() => onOpen(item)}>
          {item.title}
        </button>
      </div>
      {item.scheduled_on && (
        <div className="task-card-meta">
          <span className="task-when">{formatScheduled(item.scheduled_on, item.scheduled_time)}</span>
        </div>
      )}
      {children}
    </div>
  );
};

const DropZone = ({
  id,
  className,
  title,
  hint,
  count,
  empty,
  children,
}: {
  id: string;
  className?: string;
  title: string;
  hint: string;
  count: number;
  empty: string;
  children: ReactNode;
}) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section
      ref={setNodeRef}
      className={`task-zone${isOver ? " task-zone--over" : ""}${className ? ` ${className}` : ""}`}
      aria-label={title}
    >
      <div className="task-zone-head">
        <span className="task-zone-title">
          {title} <span className="task-count">{count}</span>
        </span>
        <span className="task-zone-hint">{hint}</span>
      </div>
      <div className="task-zone-cards">{count === 0 ? <div className="task-zone-empty">{empty}</div> : children}</div>
    </section>
  );
};

const FlagSelect = ({ item, onChange }: { item: Item; onChange: (flag: ItemFlag | null) => void }) => (
  <select
    className="task-card-select"
    aria-label={`Flag for ${item.title}`}
    value={item.flag ?? NO_FLAG}
    onChange={(e) => onChange(e.target.value === NO_FLAG ? null : (e.target.value as ItemFlag))}
  >
    <option value={NO_FLAG}>No flag</option>
    {FLAGS.map((f) => (
      <option key={f.id} value={f.id}>
        {f.label}
      </option>
    ))}
  </select>
);

const StatusSelect = ({ item, onChange }: { item: Item; onChange: (status: ItemStatus) => void }) => (
  <select
    className="task-card-select"
    aria-label={`Status of ${item.title}`}
    value={item.status}
    onChange={(e) => onChange(e.target.value as ItemStatus)}
  >
    {ITEM_STATUSES.map((s) => (
      <option key={s} value={s}>
        {STATUS_LABELS[s]}
      </option>
    ))}
  </select>
);

// ─── The page ──────────────────────────────────────────────────────────────

// Every task as a list, the four boxes, or a status board. Only to-dos live here:
// entertainment has its own list, and a meal becomes a task only when you add it as one.
const Tasks = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [view, setView] = useState<View>("list");
  const [title, setTitle] = useState("");
  const [newFlag, setNewFlag] = useState<string>(NO_FLAG);
  const [adding, setAdding] = useState(false);
  const [showFinished, setShowFinished] = useState(false);
  const [askDate, setAskDate] = useState<Item | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const { showToast, toastElement } = useToast();

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // A press and hold on a phone, so swiping still scrolls the page.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } })
  );

  useEffect(() => {
    // A link to one task (#task-<id>) opens in the list, where its details are.
    const saved = window.localStorage.getItem(VIEW_KEY);
    if (!window.location.hash && VIEWS.some((v) => v.id === saved)) setView(saved as View);

    api.items
      .getAll()
      .then((loaded) => {
        setItems(loaded);
        setStatus("ready");
      })
      .catch((err) => {
        setStatus("failed");
        showToast(getErrorMessage(err), "error");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const toList = () => {
      if (window.location.hash.startsWith("#task-")) setView("list");
    };
    window.addEventListener("hashchange", toList);
    return () => window.removeEventListener("hashchange", toList);
  }, []);

  useEffect(() => {
    if (status === "ready") window.dispatchEvent(new CustomEvent(SORTING_EVENT, { detail: needsSorting(items) }));
  }, [items, status]);

  const chooseView = (next: View) => {
    setView(next);
    setAskDate(null);
    window.localStorage.setItem(VIEW_KEY, next);
  };

  const open = useMemo(() => items.filter((i) => !i.done).sort((a, b) => a.sort_order - b.sort_order), [items]);
  const finished = items.filter((i) => i.done);

  // Shows the change right away, and puts it back if it doesn't save.
  const patch = async (item: Item, changes: Partial<Item>, payload: Parameters<typeof api.items.update>[1]) => {
    const pick = (source: Item) =>
      Object.fromEntries(Object.keys(changes).map((key) => [key, source[key as keyof Item]])) as Partial<Item>;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...changes } : i)));
    try {
      const updated = await api.items.update(item.id, payload);
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...pick(updated) } : i)));
    } catch (err) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...pick(item) } : i)));
      showToast(getErrorMessage(err), "error");
    }
  };

  const setFlag = (item: Item, flag: ItemFlag | null) => {
    if ((item.flag ?? null) !== flag) patch(item, { flag }, { flag });
  };

  // Dropping into a box sets the flag that leads there. "Urgent, not important" also
  // needs a due date within a week, so say so if it won't land there yet.
  const moveToBox = (item: Item, box: ItemBox | null) => {
    const flag = flagForBox(box);
    setFlag(item, flag);
    const lands = boxFor({ ...item, flag });
    if (box && lands !== box) {
      showToast(`Flagged ${flagLabel(flag)}. A due date in the next week makes it urgent.`, "info");
    }
  };

  // Scheduled needs a date to reach the calendar, so ask for one first.
  const moveToStatus = (item: Item, next: ItemStatus) => {
    if (next === item.status) return;
    if (next === "scheduled" && !item.scheduled_on) {
      setAskDate(item);
      setDate("");
      setTime("");
      return;
    }
    patch(item, { status: next }, { status: next });
  };

  const saveDate = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!askDate || !date) return;
    const changes = { status: "scheduled" as const, scheduled_on: date, scheduled_time: time || null };
    patch(askDate, changes, changes);
    setAskDate(null);
  };

  const toggleDone = (item: Item) => {
    const done = !item.done;
    patch(item, { done, completed_at: done ? new Date().toISOString() : null }, { done });
  };

  const openInList = (item: Item) => {
    window.history.replaceState(null, "", `#task-${item.id}`);
    chooseView("list");
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const item = items.find((i) => i.id === active.id);
    const target = over ? String(over.id) : "";
    if (!item || !target) return;
    if (target.startsWith("box:")) {
      const box = target.slice(4);
      moveToBox(item, box === NO_FLAG ? null : (box as ItemBox));
    } else if (target.startsWith("status:")) {
      moveToStatus(item, target.slice(7) as ItemStatus);
    }
  };

  const handleAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim()) return;
    setAdding(true);
    try {
      const created = await api.items.create(title, { flag: newFlag === NO_FLAG ? null : (newFlag as ItemFlag) });
      setItems((prev) => [...prev, created]);
      setTitle("");
      setNewFlag(NO_FLAG);
      showToast(created.flag ? `Added as ${flagLabel(created.flag)}` : "Added. Flag it when you know how much it matters.");
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setAdding(false);
    }
  };

  const boxCard = (item: Item) => (
    <TaskCard key={item.id} item={item} onToggle={toggleDone} onOpen={openInList}>
      <FlagSelect item={item} onChange={(flag) => setFlag(item, flag)} />
      <div className="task-card-status">{STATUS_LABELS[item.status]}</div>
    </TaskCard>
  );

  const finishedList = (
    <>
      <button
        type="button"
        className="task-heading task-heading--toggle"
        aria-expanded={showFinished}
        onClick={() => setShowFinished((prev) => !prev)}
      >
        <span className={`task-chevron${showFinished ? " task-chevron--open" : ""}`} aria-hidden="true">
          ›
        </span>
        Finished Tasks <span className="task-count">{finished.length}</span>
      </button>
      {showFinished &&
        (finished.length === 0 ? (
          <div className="list-item">
            <div className="item-meta">Nothing finished yet.</div>
          </div>
        ) : (
          finished.map((item) => (
            <div key={item.id} className="list-item">
              <input
                type="checkbox"
                checked
                aria-label={`Reopen ${item.title}`}
                onChange={() => toggleDone(item)}
              />
              <div className="item-content">
                <div className="item-title item-title--done">{item.title}</div>
              </div>
            </div>
          ))
        ))}
    </>
  );

  return (
    <div className="container">
      <div className="main">
        <div className="section">
          <div className="section-header">
            <span>Tasks</span>
            <div className="view-toggle" role="group" aria-label="Task view">
              {VIEWS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={view === v.id ? "view-toggle--active" : undefined}
                  aria-pressed={view === v.id}
                  onClick={() => chooseView(v.id)}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          <form className="inline-form tasks-add" onSubmit={handleAdd}>
            <input
              className="input"
              type="text"
              value={title}
              maxLength={500}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add a task..."
              aria-label="New task"
            />
            <select className="input tasks-add-select" aria-label="Flag" value={newFlag} onChange={(e) => setNewFlag(e.target.value)}>
              <option value={NO_FLAG}>Flag...</option>
              {FLAGS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
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
                <div className="item-title muted">Couldn&apos;t load your tasks</div>
                <div className="item-meta">Refresh the page to try again.</div>
              </div>
            </div>
          )}

          {status === "ready" && askDate && (
            <form className="fc-editor tasks-ask-date" onSubmit={saveDate}>
              <div className="fc-subhead">When is {askDate.title} scheduled?</div>
              <div className="wp-times">
                <label className="record-field">
                  <span className="record-label">Date</span>
                  <input className="input" type="date" required autoFocus value={date} onChange={(e) => setDate(e.target.value)} />
                </label>
                <label className="record-field">
                  <span className="record-label">Time (optional)</span>
                  <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                </label>
              </div>
              <div className="record-actions">
                <button className="btn" type="submit" disabled={!date}>
                  Put it on the calendar
                </button>
                <button type="button" className="btn-link" onClick={() => setAskDate(null)}>
                  cancel
                </button>
              </div>
            </form>
          )}

          {status === "ready" && view === "list" && (
            <TaskList
              items={items}
              setItems={setItems}
              showToast={showToast}
              emptyHint="Add one above to get started."
            />
          )}

          {status === "ready" && view === "boxes" && (
            <>
              <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                <div className="task-boxes">
                  {BOXES.map((b) => {
                    const cards = open.filter((i) => boxFor(i) === b.id);
                    return (
                      <DropZone key={b.id} id={`box:${b.id}`} title={b.label} hint={b.hint} count={cards.length} empty="Nothing here">
                        {cards.map(boxCard)}
                      </DropZone>
                    );
                  })}
                  <DropZone
                    id={`box:${NO_FLAG}`}
                    className="task-zone--unsorted"
                    title={NOT_CATEGORIZED}
                    hint="Flag each one, or drag it into a box"
                    count={open.filter((i) => !boxFor(i)).length}
                    empty="All flagged"
                  >
                    {open.filter((i) => !boxFor(i)).map(boxCard)}
                  </DropZone>
                </div>
              </DndContext>
              {finishedList}
            </>
          )}

          {status === "ready" && view === "board" && (
            <>
              <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                <div className="task-board">
                  {STATUS_COLUMNS.map((c) => {
                    const cards = open.filter((i) => i.status === c.id);
                    return (
                      <DropZone key={c.id} id={`status:${c.id}`} title={c.label} hint={c.hint} count={cards.length} empty="Nothing here">
                        {cards.map((item) => (
                          <TaskCard key={item.id} item={item} onToggle={toggleDone} onOpen={openInList}>
                            <StatusSelect item={item} onChange={(next) => moveToStatus(item, next)} />
                            <div className={`task-card-status${item.flag ? "" : " task-card-status--unsorted"}`}>
                              {item.flag ? `${flagLabel(item.flag)} · ${boxLabel(boxFor(item))}` : "No flag yet"}
                            </div>
                          </TaskCard>
                        ))}
                      </DropZone>
                    );
                  })}
                </div>
              </DndContext>
              {finishedList}
            </>
          )}
        </div>
      </div>
      {toastElement}
    </div>
  );
};

export default Tasks;

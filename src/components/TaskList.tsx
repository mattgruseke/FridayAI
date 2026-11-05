"use client";

import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import Link from "next/link";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent, Modifier } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import api from "../api/client";
import type { Item, ItemStatus } from "../api/client";
import { formatScheduled, normalizeTime, statusForSchedule } from "../config/familyCalendar";
import { getErrorMessage } from "../lib/errors";
import "./TaskList.css";

const STATUS_LABELS: Record<ItemStatus, string> = {
  needs_research: "Needs research",
  not_started: "Not started",
  in_progress: "In progress",
  scheduled: "Scheduled",
};

const STATUSES = Object.keys(STATUS_LABELS) as ItemStatus[];

type StatusFilter = ItemStatus | "all";

const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

// Where a row at `index` ends up if the drag were dropped right now, so the
// priority numbers update while dragging rather than only on drop.
const liveIndex = (index: number, activeIndex: number, overIndex: number) => {
  if (activeIndex < 0 || overIndex < 0) return index;
  if (index === activeIndex) return overIndex;
  if (activeIndex < index && index <= overIndex) return index - 1;
  if (overIndex <= index && index < activeIndex) return index + 1;
  return index;
};

const completedTime = (item: Item) =>
  item.completed_at ? new Date(item.completed_at).getTime() : 0;

const formatCompleted = (completedAt: string | null) =>
  completedAt
    ? `Finished ${new Date(completedAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })}`
    : "Finished (date not recorded)";

type ItemEdit = Pick<Item, "title" | "notes">;

type RowActions = {
  onToggle: (item: Item) => void;
  onStatus: (item: Item, status: ItemStatus) => void;
  onEdit: (item: Item, edit: Partial<ItemEdit>) => void;
  onSchedule: (item: Item, date: string | null, time: string | null) => void;
  onDelete: (item: Item) => void;
  onExpand: (id: string | null) => void;
  expandedId: string | null;
  showArea: boolean;
};

type RowBodyProps = RowActions & {
  item: Item;
  meta: string;
};

// The opened view of a task. Each field saves when it loses focus.
const TaskDetails = ({
  item,
  onEdit,
  onSchedule,
  onClose,
}: {
  item: Item;
  onEdit: RowActions["onEdit"];
  onSchedule: RowActions["onSchedule"];
  onClose: () => void;
}) => {
  const savedTime = item.scheduled_time ? normalizeTime(item.scheduled_time) : "";
  const [title, setTitle] = useState(item.title);
  const [notes, setNotes] = useState(item.notes ?? "");
  const [date, setDate] = useState(item.scheduled_on ?? "");
  const [time, setTime] = useState(savedTime);

  const saveTitle = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setTitle(item.title);
    } else if (trimmed !== item.title) {
      onEdit(item, { title: trimmed });
    }
  };

  const saveNotes = () => {
    const trimmed = notes.trim() || null;
    if (trimmed !== item.notes) onEdit(item, { notes: trimmed });
  };

  const saveSchedule = () => {
    if (date === (item.scheduled_on ?? "") && (!date || time === savedTime)) return;
    onSchedule(item, date || null, date ? time || null : null);
  };

  const clearSchedule = () => {
    setDate("");
    setTime("");
    onSchedule(item, null, null);
  };

  return (
    <div className="task-details">
      <label className="task-field">
        <span className="task-field-label">Task name</span>
        <input
          className="input"
          type="text"
          value={title}
          maxLength={500}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
      </label>
      <div className="task-schedule">
        <label className="task-field">
          <span className="task-field-label">Scheduled for</span>
          <input
            className="input"
            type="date"
            value={date}
            autoFocus={item.status === "scheduled" && !item.scheduled_on && !item.done}
            onChange={(e) => setDate(e.target.value)}
            onBlur={saveSchedule}
          />
        </label>
        <label className="task-field">
          <span className="task-field-label">Time (optional)</span>
          <input
            className="input"
            type="time"
            value={time}
            disabled={!date}
            onChange={(e) => setTime(e.target.value)}
            onBlur={saveSchedule}
          />
        </label>
        {item.scheduled_on && (
          <button type="button" className="btn-link" onClick={clearSchedule}>
            take off calendar
          </button>
        )}
      </div>
      <label className="task-field">
        <span className="task-field-label">Notes</span>
        <textarea
          className="input task-notes"
          value={notes}
          rows={4}
          maxLength={5000}
          placeholder="Add details, reminders, phone numbers..."
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
        />
      </label>
      <button type="button" className="btn-link" onClick={onClose}>
        close
      </button>
    </div>
  );
};

const RowBody = ({
  item,
  meta,
  onToggle,
  onStatus,
  onEdit,
  onSchedule,
  onDelete,
  onExpand,
  expandedId,
  showArea,
}: RowBodyProps) => (
  <>
    <input
      type="checkbox"
      checked={item.done}
      onChange={() => onToggle(item)}
      aria-label={item.done ? "Mark as open" : "Mark as done"}
    />
    <div className="item-content">
      <button
        type="button"
        className="task-open"
        aria-expanded={expandedId === item.id}
        onClick={() => onExpand(expandedId === item.id ? null : item.id)}
      >
        <span className={`item-title${item.done ? " item-title--done" : ""}`}>
          <span>{item.title}</span>
          {item.notes && (
            <svg
              className="task-note-flag"
              width="13"
              height="13"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              role="img"
              aria-label="Has notes"
            >
              <title>Has notes</title>
              <path d="M3 1.5h7l3 3v10H3z" />
              <path d="M5.5 7h5M5.5 10h5" />
            </svg>
          )}
        </span>
        <span className="item-meta">
          {meta}
          {item.scheduled_on && (
            <span className="task-when"> · Scheduled {formatScheduled(item.scheduled_on, item.scheduled_time)}</span>
          )}
        </span>
      </button>
    </div>
    {showArea && (
      <Link href={`/${item.category}`} className="area-tag">
        {item.category}
      </Link>
    )}
    <button className="btn-link btn-link--danger" onClick={() => onDelete(item)}>
      delete
    </button>
    <div className="task-statuses" role="group" aria-label={`Status of ${item.title}`}>
      {STATUSES.map((status) => {
        const active = !item.done && item.status === status;
        return (
          <button
            key={status}
            type="button"
            className={`task-status task-status--${status}`}
            aria-pressed={active}
            onClick={() => {
              if (!active) onStatus(item, status);
              // Scheduled needs a date to reach the calendar, so ask for one.
              if (status === "scheduled" && !item.scheduled_on) onExpand(item.id);
            }}
          >
            {STATUS_LABELS[status]}
          </button>
        );
      })}
      <button
        type="button"
        className="task-status task-status--done"
        aria-pressed={item.done}
        onClick={() => {
          if (!item.done) onToggle(item);
        }}
      >
        Done
      </button>
    </div>
    {expandedId === item.id && (
      <TaskDetails item={item} onEdit={onEdit} onSchedule={onSchedule} onClose={() => onExpand(null)} />
    )}
  </>
);

// `priorities` holds the number shown at each position in the current list. With
// a filter on, they're the rows' places among all open items, not 1, 2, 3.
const OpenRow = ({
  item,
  priorities,
  ...actions
}: RowActions & { item: Item; priorities: number[] }) => {
  const {
    activeIndex,
    attributes,
    index,
    isDragging,
    listeners,
    overIndex,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: item.id });

  return (
    <div
      ref={setNodeRef}
      id={`task-${item.id}`}
      className={`list-item task-row${isDragging ? " task-row--dragging" : ""}`}
      style={{
        transform: transform ? `translate3d(0, ${transform.y}px, 0)` : undefined,
        transition,
      }}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="task-handle"
        aria-label={`Reorder ${item.title}`}
        {...attributes}
        {...listeners}
      >
        <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
          <circle cx="2" cy="2" r="1.5" />
          <circle cx="8" cy="2" r="1.5" />
          <circle cx="2" cy="8" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="2" cy="14" r="1.5" />
          <circle cx="8" cy="14" r="1.5" />
        </svg>
      </button>
      <span className="task-priority" title="Priority">
        {priorities[liveIndex(index, activeIndex, overIndex)]}
      </span>
      <RowBody
        item={item}
        meta={new Date(item.created_at).toLocaleDateString()}
        {...actions}
      />
    </div>
  );
};

type TaskListProps = {
  items: Item[];
  setItems: Dispatch<SetStateAction<Item[]>>;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
  emptyHint: string; // shown when there are no items at all
  showArea?: boolean; // tag each row with its category
};

// Open items, in priority order and drag-to-reorder, above a collapsible list
// of finished ones. Used by the Items and Overview pages, which own the data.
const TaskList = ({ items, setItems, showToast, emptyHint, showArea = false }: TaskListProps) => {
  const [showFinished, setShowFinished] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // The calendar links to a task as #task-<id>: open it and bring it into view.
  useEffect(() => {
    const target = window.location.hash.match(/^#task-(.+)$/)?.[1];
    const item = target ? items.find((i) => i.id === target) : undefined;
    if (!item) return;
    setExpandedId(item.id);
    if (item.done) setShowFinished(true);
    requestAnimationFrame(() =>
      document.getElementById(`task-${item.id}`)?.scrollIntoView({ block: "center" })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = items.filter((i) => !i.done).sort((a, b) => a.sort_order - b.sort_order);
  const finished = items.filter((i) => i.done).sort((a, b) => completedTime(b) - completedTime(a));

  // An opened task stays put when its status changes, so picking Scheduled while
  // filtered to something else can still ask for a date.
  const visible = open.filter(
    (i) => filter === "all" || i.status === filter || i.id === expandedId
  );
  const priorities = visible.map((i) => open.indexOf(i) + 1);

  // A new task might not match the filter, which would look like it never saved.
  const itemCount = useRef(items.length);
  useEffect(() => {
    if (items.length > itemCount.current) setFilter("all");
    itemCount.current = items.length;
  }, [items.length]);

  // Pressing the active filter again turns it off.
  const handleFilter = (next: StatusFilter) => {
    setFilter(next === filter ? "all" : next);
    setExpandedId(null);
  };

  // Saves `changes` optimistically. Only those fields are touched afterwards, so
  // saves that overlap (editing a note, then clicking a status) can't undo each other.
  const saveChanges = async (
    item: Item,
    changes: Partial<Item>,
    payload: Parameters<typeof api.items.update>[1]
  ) => {
    const pick = (source: Item) =>
      Object.fromEntries(
        Object.keys(changes).map((key) => [key, source[key as keyof Item]])
      ) as Partial<Item>;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...changes } : i)));
    try {
      const updated = await api.items.update(item.id, payload);
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...pick(updated) } : i)));
    } catch (err) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...pick(item) } : i)));
      showToast(getErrorMessage(err), "error");
    }
  };

  const handleToggle = (item: Item) => {
    const done = !item.done;
    const completed_at = done ? new Date().toISOString() : null;
    saveChanges(item, { done, completed_at }, { done });
  };

  // Picking a status on a finished item also reopens it.
  const handleStatus = (item: Item, status: ItemStatus) =>
    saveChanges(item, { status, done: false, completed_at: null }, { status, done: false });

  const handleEdit = (item: Item, edit: Partial<ItemEdit>) => saveChanges(item, edit, edit);

  const handleSchedule = (item: Item, date: string | null, time: string | null) => {
    const changes = {
      scheduled_on: date,
      scheduled_time: time,
      status: statusForSchedule(item, date),
    };
    saveChanges(item, changes, changes);
  };

  const handleDelete = async (item: Item) => {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    try {
      await api.items.delete(item.id);
      showToast("Item deleted");
    } catch (err) {
      setItems((prev) => [...prev, item]);
      showToast(getErrorMessage(err), "error");
    }
  };

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = visible.findIndex((i) => i.id === active.id);
    const to = visible.findIndex((i) => i.id === over.id);
    const reordered = arrayMove(visible, from, to);

    // Same swap the API makes: these items trade the sort_order values they hold,
    // so tasks hidden by the filter keep their places.
    const newOrder = new Map(reordered.map((item, i) => [item.id, visible[i].sort_order]));
    const previous = items;
    setItems((prev) =>
      prev.map((i) => {
        const sort_order = newOrder.get(i.id);
        return sort_order === undefined ? i : { ...i, sort_order };
      })
    );
    try {
      await api.items.reorder(reordered.map((i) => i.id));
    } catch (err) {
      setItems(previous);
      showToast(getErrorMessage(err), "error");
    }
  };

  const actions = {
    onToggle: handleToggle,
    onStatus: handleStatus,
    onEdit: handleEdit,
    onSchedule: handleSchedule,
    onDelete: handleDelete,
    onExpand: setExpandedId,
    expandedId,
    showArea,
  };

  return (
    <>
      <div className="task-heading">
        Open Items <span className="task-count">{open.length}</span>
        {open.length > 0 && (
          <div className="task-filters" role="group" aria-label="Filter open items">
            <button
              type="button"
              className="task-status task-filter"
              aria-pressed={filter === "all"}
              onClick={() => handleFilter("all")}
            >
              All
            </button>
            {STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                className={`task-status task-filter task-status--${status}`}
                aria-pressed={filter === status}
                onClick={() => handleFilter(status)}
              >
                {STATUS_LABELS[status]}{" "}
                <span className="task-filter-count">
                  {open.filter((i) => i.status === status).length}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      {open.length === 0 ? (
        <div className="list-item">
          <div className="item-content">
            <div className="item-title muted">
              {items.length === 0 ? "No items yet" : "No open items"}
            </div>
            {items.length === 0 && <div className="item-meta">{emptyHint}</div>}
          </div>
        </div>
      ) : visible.length === 0 ? (
        <div className="list-item">
          <div className="item-content">
            <div className="item-title muted">No open items match this filter</div>
          </div>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[verticalOnly]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={visible.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div>
              {visible.map((item) => (
                <OpenRow key={item.id} item={item} priorities={priorities} {...actions} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

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
          <div>
            {finished.map((item) => (
              <div key={item.id} id={`task-${item.id}`} className="list-item task-row task-row--finished">
                <RowBody item={item} meta={formatCompleted(item.completed_at)} {...actions} />
              </div>
            ))}
          </div>
        ))}
    </>
  );
};

export default TaskList;

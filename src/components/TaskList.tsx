"use client";

import { useState } from "react";
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
import { getErrorMessage } from "../lib/errors";
import "./TaskList.css";

const STATUS_LABELS: Record<ItemStatus, string> = {
  needs_research: "Needs research",
  not_started: "Not started",
  in_progress: "In progress",
  scheduled: "Scheduled",
};

const STATUSES = Object.keys(STATUS_LABELS) as ItemStatus[];

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
  onClose,
}: {
  item: Item;
  onEdit: RowActions["onEdit"];
  onClose: () => void;
}) => {
  const [title, setTitle] = useState(item.title);
  const [notes, setNotes] = useState(item.notes ?? "");

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
        <span className="item-meta">{meta}</span>
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
      <TaskDetails item={item} onEdit={onEdit} onClose={() => onExpand(null)} />
    )}
  </>
);

const OpenRow = ({ item, ...actions }: RowActions & { item: Item }) => {
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
        {liveIndex(index, activeIndex, overIndex) + 1}
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
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const open = items.filter((i) => !i.done).sort((a, b) => a.sort_order - b.sort_order);
  const finished = items.filter((i) => i.done).sort((a, b) => completedTime(b) - completedTime(a));

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
    const from = open.findIndex((i) => i.id === active.id);
    const to = open.findIndex((i) => i.id === over.id);
    const reordered = arrayMove(open, from, to);

    // Same swap the API makes: these items trade the sort_order values they hold.
    const newOrder = new Map(reordered.map((item, i) => [item.id, open[i].sort_order]));
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
    onDelete: handleDelete,
    onExpand: setExpandedId,
    expandedId,
    showArea,
  };

  return (
    <>
      <div className="task-heading">
        Open Items <span className="task-count">{open.length}</span>
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
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[verticalOnly]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={open.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div>
              {open.map((item) => (
                <OpenRow key={item.id} item={item} {...actions} />
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
              <div key={item.id} className="list-item task-row task-row--finished">
                <RowBody item={item} meta={formatCompleted(item.completed_at)} {...actions} />
              </div>
            ))}
          </div>
        ))}
    </>
  );
};

export default TaskList;

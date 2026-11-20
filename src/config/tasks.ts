// Labels and rules for the Tasks page: flags, the Eisenhower boxes they lead to, due
// date urgency, and statuses.

import type { Item, ItemBox, ItemFlag, ItemStatus } from "@/api/client";
import { fromDateString, today } from "./homeRecords";

export const BOXES: { id: ItemBox; label: string; hint: string }[] = [
  { id: "urgent_important", label: "Urgent & important", hint: "Deal with these first" },
  { id: "important", label: "Important, not urgent", hint: "What matters if you zoom out" },
  { id: "urgent", label: "Urgent, not important", hint: "Has a deadline, low stakes if it slips" },
  { id: "backlog", label: "Backlog", hint: "Keep track of it, don't think about it now" },
];

export const NOT_CATEGORIZED = "Not flagged";

export const boxLabel = (box: ItemBox | null | undefined) =>
  BOXES.find((b) => b.id === box)?.label ?? NOT_CATEGORIZED;

// ─── Flags ─────────────────────────────────────────────────────────────────
// You say how much a task matters; the due date says how soon. Together they put it in
// a box, which updates on its own as dates come closer or move.

export const FLAGS: { id: ItemFlag; label: string; hint: string }[] = [
  { id: "must", label: "Must do", hint: "Has to happen" },
  { id: "nice", label: "Nice to do", hint: "Worth doing, no rush unless it's due" },
  { id: "someday", label: "One day", hint: "Sometime, if ever" },
];

export const flagLabel = (flag: ItemFlag | null | undefined) => FLAGS.find((f) => f.id === flag)?.label ?? null;

// Days until the due date: 0 is today, negative is overdue, null is no date.
export const daysUntilDue = (item: Pick<Item, "due_on">, now = today()) => {
  if (!item.due_on) return null;
  return Math.round((fromDateString(item.due_on).getTime() - fromDateString(now).getTime()) / 86_400_000);
};

// Due within a week (or overdue) makes a task urgent.
export const URGENT_WITHIN_DAYS = 7;
// Due within 3 days (or overdue) makes it stand out in bold.
export const PRESSING_WITHIN_DAYS = 3;

export const isUrgent = (item: Pick<Item, "due_on" | "done">) => {
  const days = daysUntilDue(item);
  return !item.done && days !== null && days <= URGENT_WITHIN_DAYS;
};

export const isPressing = (item: Pick<Item, "due_on" | "done">) => {
  const days = daysUntilDue(item);
  return !item.done && days !== null && days <= PRESSING_WITHIN_DAYS;
};

// Must do: always urgent and important.
// Nice to do: important; urgent too once it's due within a week.
// One day: not important; urgent once it's due within a week, backlog otherwise.
// A task with no flag has no box, except old tasks given one by hand before flags.
export const boxFor = (item: Pick<Item, "flag" | "due_on" | "done" | "box">): ItemBox | null => {
  const flag = item.flag ?? null;
  if (flag === "must") return "urgent_important";
  if (flag === "nice") return isUrgent(item) ? "urgent_important" : "important";
  if (flag === "someday") return isUrgent(item) ? "urgent" : "backlog";
  return item.flag === undefined ? (item.box ?? null) : null;
};

// The flag that puts a task in a box: used for dropping a card into a box, and for
// turning boxes picked before flags existed into flags.
export const flagForBox = (box: ItemBox | null | undefined): ItemFlag | null =>
  box === "urgent_important" ? "must" : box === "important" ? "nice" : box ? "someday" : null;

// ─── Statuses ──────────────────────────────────────────────────────────────

export const STATUS_LABELS: Record<ItemStatus, string> = {
  needs_research: "Needs research",
  not_started: "Not started",
  in_progress: "In progress",
  scheduled: "Scheduled",
};

export const STATUS_COLUMNS: { id: ItemStatus; label: string; hint: string }[] = [
  { id: "needs_research", label: STATUS_LABELS.needs_research, hint: "Who do I call?" },
  { id: "not_started", label: STATUS_LABELS.not_started, hint: "Know who, haven't done it" },
  { id: "in_progress", label: STATUS_LABELS.in_progress, hint: "Reached out, no date yet" },
  { id: "scheduled", label: STATUS_LABELS.scheduled, hint: "It's on the calendar" },
];

// Open tasks still to flag; the sidebar shows the count.
export const needsSorting = (items: Item[]) => items.filter((i) => !i.done && !i.flag).length;

// Fired when the count changes, so the sidebar's badge keeps up without reloading.
export const SORTING_EVENT = "friday:tasks-to-sort";

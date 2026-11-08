// Labels for the Tasks page: its Eisenhower boxes, statuses and areas.

import type { Item, ItemBox, ItemCategory, ItemStatus } from "@/api/client";

export const BOXES: { id: ItemBox; label: string; hint: string }[] = [
  { id: "urgent_important", label: "Urgent & important", hint: "Deal with these first" },
  { id: "important", label: "Important, not urgent", hint: "What matters if you zoom out" },
  { id: "urgent", label: "Urgent, not important", hint: "Has a deadline, low stakes if it slips" },
  { id: "backlog", label: "Backlog", hint: "Keep track of it, don't think about it now" },
];

export const NOT_CATEGORIZED = "Not categorized";

export const boxLabel = (box: ItemBox | null | undefined) =>
  BOXES.find((b) => b.id === box)?.label ?? NOT_CATEGORIZED;

// List view's order: anything without a box stays on top until it's been sorted.
export const BOX_SECTIONS: { id: ItemBox | null; label: string }[] = [
  { id: null, label: NOT_CATEGORIZED },
  ...BOXES.map(({ id, label }) => ({ id, label })),
];

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

export const AREA_LABELS: Record<ItemCategory, string> = {
  home: "Home",
  food: "Food",
  entertainment: "Entertainment",
  none: "No area",
};

export const AREAS = Object.keys(AREA_LABELS) as ItemCategory[];

export const needsSorting = (items: Item[]) => items.filter((i) => !i.done && !i.box).length;

// Fired when the count changes, so the sidebar's badge keeps up without reloading.
export const SORTING_EVENT = "friday:tasks-to-sort";

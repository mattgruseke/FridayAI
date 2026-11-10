// Labels and links for the Brain Dump and the Goals, Ideas and Notes lists.

import type { DumpItem, Entry, EntryKind, Item, LinkType, SortTarget } from "@/api/client";

export const LIST_INFO: Record<SortTarget, { label: string; title: string; path: string; blurb: string }> = {
  task: { label: "Task", title: "Tasks", path: "/tasks", blurb: "" },
  goal: {
    label: "Goal",
    title: "Goals",
    path: "/goals",
    blurb: "Things you've committed to that have a finish line and take many steps.",
  },
  idea: {
    label: "Idea",
    title: "Ideas",
    path: "/ideas",
    blurb: "Things that interest you but you haven't committed to. Move one to Goals when you do.",
  },
  note: {
    label: "Note",
    title: "Notes",
    path: "/notes",
    blurb: "Things to keep with nothing to do, including principles you want to hold on to.",
  },
  watch: { label: "Entertainment", title: "Entertainment", path: "/entertainment", blurb: "" },
};

// Long or multi-line Brain Dump text keeps a short title, with the whole thing as details.
export const splitDumpText = (value: string) => {
  const full = value.trim();
  if (full.length <= 200 && !full.includes("\n")) return { title: full, details: null };
  const firstLine = full.split("\n")[0].trim();
  return { title: (firstLine || full).slice(0, 200), details: full };
};

export type LinkTarget = { type: LinkType; id: string; label: string; title: string; href: string; faded: boolean };

// What a link points at, or null if it's been deleted.
export const findTarget = (
  type: LinkType,
  id: string,
  { tasks, entries, dumps }: { tasks: Item[]; entries: Entry[]; dumps: DumpItem[] }
): LinkTarget | null => {
  if (type === "task") {
    const task = tasks.find((t) => t.id === id);
    return task
      ? { type, id, label: "Task", title: task.title, href: `/tasks#task-${id}`, faded: task.done }
      : null;
  }
  if (type === "entry") {
    const entry = entries.find((e) => e.id === id);
    return entry
      ? {
          type,
          id,
          label: LIST_INFO[entry.kind].label,
          title: entry.title,
          href: `${LIST_INFO[entry.kind].path}#entry-${id}`,
          faded: entry.archived,
        }
      : null;
  }
  const dump = dumps.find((d) => d.id === id);
  return dump ? { type, id, label: "Brain Dump", title: dump.text, href: `/brain-dump#dump-${id}`, faded: false } : null;
};

export const ENTRY_KIND_ORDER: EntryKind[] = ["goal", "idea", "note"];

// Fired after something changes the sidebar's counts, so it can fetch them again.
export const COUNTS_EVENT = "friday:counts-changed";

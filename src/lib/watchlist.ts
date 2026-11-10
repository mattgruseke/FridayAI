// Server-side storage for the Entertainment list: things to watch, read or listen to.
// It's its own list, never a task. In local mode it's written to
// .local-data/watchlist.json, so it survives restarts.

import type { Item, WatchItem, WatchItemInput } from "@/api/client";
import { ALL_PLATFORMS, isMediaKind, isPosterUrl, isVibe } from "@/config/entertainment";
import type { MediaKind, Vibe } from "@/config/entertainment";
import { removeLinksFor } from "@/lib/listRecords";
import { searchMedia } from "@/lib/mediaSearch";
import { recordRoutes, recordStore, text } from "@/lib/recordStore";
import type { ParseResult } from "@/lib/recordStore";
import { deleteTask, listTasks } from "@/lib/taskStore";

export const watchStore = recordStore<WatchItem, WatchItemInput>("watchlist", "watchlist");

const parseWatchItem = async (body: Record<string, unknown>): Promise<ParseResult<WatchItemInput>> => {
  const title = text(body.title, 500);
  if (!title) return { ok: false, error: "Title is required" };
  const media_kind = body.media_kind ?? null;
  if (media_kind !== null && !isMediaKind(media_kind)) return { ok: false, error: "Invalid type" };
  const platform = body.platform ?? null;
  if (platform !== null && !ALL_PLATFORMS.includes(platform as string)) return { ok: false, error: "Invalid platform" };
  const vibes = body.vibes ?? [];
  if (!Array.isArray(vibes) || !vibes.every(isVibe)) return { ok: false, error: "Invalid vibes" };
  const image_url = body.image_url ?? null;
  if (image_url !== null && !isPosterUrl(image_url)) return { ok: false, error: "Invalid poster" };
  const done = body.done === true;
  const doneAt = typeof body.done_at === "string" && !Number.isNaN(Date.parse(body.done_at)) ? body.done_at : null;

  return {
    ok: true,
    data: {
      title,
      media_kind: media_kind as MediaKind | null,
      platform: platform as string | null,
      vibes: [...new Set(vibes as Vibe[])],
      image_url: image_url as string | null,
      notes: text(body.notes, 5000),
      done,
      done_at: done ? (doneAt ?? new Date().toISOString()) : null,
    },
  };
};

export const watchRoutes = recordRoutes(watchStore, parseWatchItem);

// ─── Moving entertainment out of Tasks ─────────────────────────────────────
// Entertainment used to be saved as tasks in an "entertainment" area. The first time
// either list loads, those move here with their type, platform, vibes and poster, and
// leave Tasks. Older rows may carry those fields, so they're read loosely.

type OldEntertainmentTask = Item & {
  media_kind?: unknown;
  platform?: unknown;
  vibes?: unknown;
  image_url?: unknown;
};

const fromOldTask = (task: OldEntertainmentTask): WatchItemInput => ({
  title: task.title,
  media_kind: isMediaKind(task.media_kind) ? task.media_kind : null,
  platform: ALL_PLATFORMS.includes(task.platform as string) ? (task.platform as string) : null,
  vibes: Array.isArray(task.vibes) ? task.vibes.filter(isVibe) : [],
  image_url: isPosterUrl(task.image_url) ? task.image_url : null,
  notes: task.notes,
  done: task.done,
  done_at: task.done ? task.completed_at : null,
});

// One move at a time, so the sidebar and the page loading together can't copy twice.
let moving: Promise<void> | null = null;

export const moveEntertainmentOutOfTasks = (userId: string) => {
  moving ??= (async () => {
    try {
      const old = (await listTasks(userId)).filter((t) => t.category === "entertainment");
      for (const task of old) {
        await watchStore.create(userId, fromOldTask(task as OldEntertainmentTask));
        await removeLinksFor(userId, "task", task.id);
        await deleteTask(userId, task.id);
      }
    } finally {
      moving = null;
    }
  })();
  return moving;
};

// ─── From the Brain Dump ───────────────────────────────────────────────────

// "watch The Witcher" → The Witcher, a guess that it's TV or a movie. "read" means a
// book and "listen to" a podcast.
const LEADS: { pattern: RegExp; kind: MediaKind | null }[] = [
  { pattern: /^(re-?)?read\s+/i, kind: "book" },
  { pattern: /^listen\s+to\s+/i, kind: "podcast" },
  { pattern: /^(re-?)?watch\s+/i, kind: null },
  { pattern: /^(look\s+up|check\s+out|start|finish|try)\s+/i, kind: null },
];

export const titleFromDump = (raw: string) => {
  let title = raw.trim();
  let kind: MediaKind | null = null;
  for (const lead of LEADS) {
    if (lead.pattern.test(title)) {
      title = title.replace(lead.pattern, "");
      kind = lead.kind;
      break;
    }
  }
  // Trailing "on Netflix" names the platform rather than the title.
  const on = title.match(/\s+on\s+(.+)$/i);
  const platform = on ? ALL_PLATFORMS.find((p) => p.toLowerCase() === on[1].trim().toLowerCase()) ?? null : null;
  if (platform) title = title.slice(0, on!.index);
  return { title: title.replace(/[.!]+$/, "").trim() || raw.trim(), kind, platform };
};

const sameTitle = (a: string, b: string) => {
  const norm = (s: string) => s.toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9]+/g, "");
  return norm(a) === norm(b);
};

// Adds a Brain Dump item to the list, filling in the poster, type and platform when a
// search finds that exact title. A near miss isn't used: a wrong poster is worse than none.
export const createFromDump = async (userId: string, raw: string, details: string | null) => {
  const { title, kind, platform } = titleFromDump(raw);
  let match = null;
  try {
    match = (await searchMedia(title, kind)).find((m) => sameTitle(m.title, title)) ?? null;
  } catch {
    // Saved without the extras; they can be filled in by hand.
  }
  return watchStore.create(userId, {
    title: match?.title ?? title,
    media_kind: match?.kind ?? kind,
    platform: platform ?? match?.platform ?? null,
    vibes: [],
    image_url: match?.image_url ?? null,
    notes: details,
    done: false,
    done_at: null,
  });
};

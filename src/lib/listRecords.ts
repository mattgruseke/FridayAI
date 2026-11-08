// Server-side validation and tables for the Brain Dump, the Goals, Ideas and Notes
// lists, and the links between things. In local mode they're written to
// .local-data/lists.json, so they survive restarts.

import {
  DUMP_STATES,
  ENTRY_KINDS,
  LINK_TYPES,
  SORT_TARGETS,
  type DumpItem,
  type DumpItemInput,
  type DumpState,
  type Entry,
  type EntryInput,
  type EntryKind,
  type Link,
  type LinkInput,
  type LinkType,
  type SortTarget,
} from "@/api/client";
import { recordRoutes, recordStore, text } from "@/lib/recordStore";
import type { ParseResult } from "@/lib/recordStore";

const LOCAL_FILE = "lists";

export const dumpStore = recordStore<DumpItem, DumpItemInput>(LOCAL_FILE, "brain_dump");
export const entryStore = recordStore<Entry, EntryInput>(LOCAL_FILE, "entries");
export const linkStore = recordStore<Link, LinkInput>(LOCAL_FILE, "links");

const isLinkType = (value: unknown): value is LinkType => LINK_TYPES.includes(value as LinkType);

const touches = (link: Link, type: LinkType, id: string) =>
  (link.a_type === type && link.a_id === id) || (link.b_type === type && link.b_id === id);

// Something's gone, so nothing should still point at it.
export const removeLinksFor = async (userId: string, type: LinkType, id: string) => {
  for (const link of await linkStore.list(userId)) {
    if (touches(link, type, id)) await linkStore.remove(userId, link.id);
  }
};

// A Brain Dump item became a task or an entry: its links come along.
export const moveLinks = async (userId: string, from: { type: LinkType; id: string }, to: { type: LinkType; id: string }) => {
  for (const link of await linkStore.list(userId)) {
    if (!touches(link, from.type, from.id)) continue;
    const aMoves = link.a_type === from.type && link.a_id === from.id;
    await linkStore.update(userId, link.id, {
      a_type: aMoves ? to.type : link.a_type,
      a_id: aMoves ? to.id : link.a_id,
      b_type: aMoves ? link.b_type : to.type,
      b_id: aMoves ? link.b_id : to.id,
    });
  }
};

const parseDump = async (body: Record<string, unknown>): Promise<ParseResult<DumpItemInput>> => {
  const itemText = text(body.text, 5000);
  if (!itemText) return { ok: false, error: "Write something first" };
  const state = (body.state ?? "open") as DumpState;
  if (!DUMP_STATES.includes(state)) return { ok: false, error: "Invalid state" };
  const sorted_as = (body.sorted_as ?? null) as SortTarget | null;
  if (sorted_as !== null && !SORT_TARGETS.includes(sorted_as)) return { ok: false, error: "Invalid list" };
  const sorted_at = body.sorted_at ?? null;
  if (sorted_at !== null && (typeof sorted_at !== "string" || Number.isNaN(Date.parse(sorted_at)))) {
    return { ok: false, error: "Invalid date" };
  }
  return {
    ok: true,
    data: { text: itemText, state, sorted_as, sorted_id: text(body.sorted_id, 80), sorted_at: sorted_at as string | null },
  };
};

const parseEntry = async (body: Record<string, unknown>): Promise<ParseResult<EntryInput>> => {
  if (!ENTRY_KINDS.includes(body.kind as EntryKind)) return { ok: false, error: "Invalid list" };
  const title = text(body.title, 500);
  if (!title) return { ok: false, error: "Write something first" };
  return {
    ok: true,
    data: { kind: body.kind as EntryKind, title, details: text(body.details, 10000), archived: body.archived === true },
  };
};

const parseLink = async (body: Record<string, unknown>, userId: string): Promise<ParseResult<LinkInput>> => {
  if (!isLinkType(body.a_type) || !isLinkType(body.b_type)) return { ok: false, error: "Invalid link" };
  const a_id = text(body.a_id, 80);
  const b_id = text(body.b_id, 80);
  if (!a_id || !b_id) return { ok: false, error: "Invalid link" };
  if (body.a_type === body.b_type && a_id === b_id) return { ok: false, error: "Something can't link to itself" };
  const existing = await linkStore.list(userId);
  const same = (l: Link) =>
    (l.a_type === body.a_type && l.a_id === a_id && l.b_type === body.b_type && l.b_id === b_id) ||
    (l.a_type === body.b_type && l.a_id === b_id && l.b_type === body.a_type && l.b_id === a_id);
  if (existing.some(same)) return { ok: false, error: "Those are already linked" };
  return { ok: true, data: { a_type: body.a_type, a_id, b_type: body.b_type, b_id } };
};

export const dumpRoutes = recordRoutes(dumpStore, parseDump, (userId, id) => removeLinksFor(userId, "dump", id));
export const entryRoutes = recordRoutes(entryStore, parseEntry, (userId, id) => removeLinksFor(userId, "entry", id));
export const linkRoutes = recordRoutes(linkStore, parseLink);

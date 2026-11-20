// Server-side validation and tables for /api/calendar and /api/childcare. In local
// mode they're written to .local-data/calendar.json, so they survive restarts.

import { blocksProblem, isValidTime, normalizeTime, PERSON_COLORS } from "@/config/familyCalendar";
import { isRealDate, recordRoutes, recordStore, text } from "@/lib/recordStore";
import type { ParseResult } from "@/lib/recordStore";
import type {
  CalendarEvent,
  CalendarEventInput,
  ChildcareBlock,
  ChildcareOverride,
  ChildcareOverrideInput,
  ChildcarePerson,
  ChildcarePersonInput,
  ChildcareSchedule,
  ChildcareScheduleInput,
} from "@/api/client";

const LOCAL_FILE = "calendar";

const events = recordStore<CalendarEvent, CalendarEventInput>(LOCAL_FILE, "calendar_events");
const people = recordStore<ChildcarePerson, ChildcarePersonInput>(LOCAL_FILE, "childcare_people");
const schedules = recordStore<ChildcareSchedule, ChildcareScheduleInput>(LOCAL_FILE, "childcare_schedules");
const overrides = recordStore<ChildcareOverride, ChildcareOverrideInput>(LOCAL_FILE, "childcare_overrides");

const parseEvent = async (body: Record<string, unknown>): Promise<ParseResult<CalendarEventInput>> => {
  const title = text(body.title, 200);
  if (!title) return { ok: false, error: "Event name is required" };
  if (!isRealDate(body.event_on)) return { ok: false, error: "A valid date is required" };
  const start_time = body.start_time || null;
  if (start_time !== null && !isValidTime(start_time)) return { ok: false, error: "Invalid time" };
  return {
    ok: true,
    data: {
      title,
      event_on: body.event_on,
      start_time,
      location: text(body.location, 200),
      notes: text(body.notes, 5000),
    },
  };
};

const parsePerson = async (body: Record<string, unknown>): Promise<ParseResult<ChildcarePersonInput>> => {
  const name = text(body.name, 80);
  if (!name) return { ok: false, error: "A name is required" };
  if (!PERSON_COLORS.some((c) => c.hex === body.color)) return { ok: false, error: "Invalid color" };
  return { ok: true, data: { name, color: body.color as string, archived: body.archived === true } };
};

const parseBlocks = async (value: unknown, userId: string): Promise<ChildcareBlock[] | string> => {
  if (!Array.isArray(value) || value.length > 200) return "Invalid time blocks";
  const known = (await people.list(userId)).map((p) => p.id);
  if (value.some((b) => !known.includes(b?.person_id))) return "Pick who's covering each time block";
  return value.map((b) => ({ person_id: b.person_id, start: b.start, end: b.end }));
};

const parseSchedule = async (
  body: Record<string, unknown>,
  userId: string
): Promise<ParseResult<ChildcareScheduleInput>> => {
  if (!isRealDate(body.effective_from)) return { ok: false, error: "A valid start date is required" };
  if (!isValidTime(body.coverage_start) || !isValidTime(body.coverage_end)) {
    return { ok: false, error: "Enter the hours that need coverage" };
  }
  if (body.coverage_start >= body.coverage_end) {
    return { ok: false, error: "Coverage hours have to end after they start" };
  }
  const days = body.coverage_days;
  if (!Array.isArray(days) || days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    return { ok: false, error: "Invalid coverage days" };
  }
  const blocks = await parseBlocks(body.blocks, userId);
  if (typeof blocks === "string") return { ok: false, error: blocks };

  const raw = body.blocks as { weekday: unknown }[];
  if (raw.some((b) => !Number.isInteger(b.weekday) || (b.weekday as number) < 0 || (b.weekday as number) > 6)) {
    return { ok: false, error: "Invalid weekday" };
  }
  const withDays = blocks.map((b, i) => ({ ...b, weekday: raw[i].weekday as number }));
  for (let weekday = 0; weekday < 7; weekday++) {
    const problem = blocksProblem(withDays.filter((b) => b.weekday === weekday));
    if (problem) return { ok: false, error: problem };
  }
  return {
    ok: true,
    data: {
      effective_from: body.effective_from,
      coverage_start: normalizeTime(body.coverage_start),
      coverage_end: normalizeTime(body.coverage_end),
      coverage_days: [...new Set(days as number[])].sort(),
      blocks: withDays,
    },
  };
};

const parseOverride = async (
  body: Record<string, unknown>,
  userId: string
): Promise<ParseResult<ChildcareOverrideInput>> => {
  if (!isRealDate(body.on_date)) return { ok: false, error: "A valid date is required" };
  const blocks = await parseBlocks(body.blocks, userId);
  if (typeof blocks === "string") return { ok: false, error: blocks };
  const problem = blocksProblem(blocks);
  if (problem) return { ok: false, error: problem };
  return { ok: true, data: { on_date: body.on_date, blocks, note: text(body.note, 500) } };
};

export const eventRoutes = recordRoutes(events, parseEvent);
export const personRoutes = recordRoutes(people, parsePerson);
export const scheduleRoutes = recordRoutes(schedules, parseSchedule);
export const overrideRoutes = recordRoutes(overrides, parseOverride);

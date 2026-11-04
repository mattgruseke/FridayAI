// Shared options and date logic for the family calendar page.

import type {
  ChildcareBlock,
  ChildcareOverride,
  ChildcarePerson,
  ChildcareSchedule,
  Item,
  ItemStatus,
} from "@/api/client";
import { fromDateString, toDateString } from "./homeRecords";

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// `ink` is the text color that reads on top of the swatch.
export const PERSON_COLORS = [
  { hex: "#C4A063", ink: "#201705" },
  { hex: "#3B6AA8", ink: "#FFFFFF" },
  { hex: "#4E8A64", ink: "#FFFFFF" },
  { hex: "#7D5BA6", ink: "#FFFFFF" },
  { hex: "#B5597A", ink: "#FFFFFF" },
  { hex: "#2F8291", ink: "#FFFFFF" },
  { hex: "#B9682F", ink: "#FFFFFF" },
  { hex: "#64748B", ink: "#FFFFFF" },
];

export const inkFor = (hex: string) => PERSON_COLORS.find((c) => c.hex === hex)?.ink ?? "#FFFFFF";

export const SUGGESTED_PEOPLE = ["Georgia", "Me", "Both of us", "Nanny", "Preschool", "My mom", "Mother-in-law"];

export const DEFAULT_COVERAGE = { start: "07:00", end: "18:00", days: [1, 2, 3, 4, 5] };

// ─── Dates and times ───────────────────────────────────────────────────────

export const addDays = (date: string, days: number) => {
  const d = fromDateString(date);
  d.setDate(d.getDate() + days);
  return toDateString(d);
};

export const weekdayOf = (date: string) => fromDateString(date).getDay();

export const startOfWeek = (date: string) => addDays(date, -weekdayOf(date));

export const startOfMonth = (date: string) => `${date.slice(0, 7)}-01`;

export const addMonthsToMonth = (monthStart: string, months: number) => {
  const d = fromDateString(monthStart);
  return toDateString(new Date(d.getFullYear(), d.getMonth() + months, 1));
};

export const datesInMonth = (monthStart: string) => {
  const nextMonth = addMonthsToMonth(monthStart, 1);
  const dates: string[] = [];
  for (let d = monthStart; d < nextMonth; d = addDays(d, 1)) dates.push(d);
  return dates;
};

// Whole weeks, Sunday first, that cover the month.
export const monthGrid = (monthStart: string) => {
  const last = addDays(addMonthsToMonth(monthStart, 1), -1);
  const dates: string[] = [];
  for (let d = startOfWeek(monthStart); d <= addDays(startOfWeek(last), 6); d = addDays(d, 1)) dates.push(d);
  return dates;
};

export const formatMonth = (monthStart: string) =>
  fromDateString(monthStart).toLocaleDateString(undefined, { month: "long", year: "numeric" });

export const formatDay = (date: string) =>
  fromDateString(date).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

export const isValidTime = (value: unknown): value is string =>
  typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

// Postgres time columns come back as HH:MM:SS.
export const normalizeTime = (value: string) => value.slice(0, 5);

export const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

export const fromMinutes = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

export const formatTime = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
};

// "Thu, Nov 5, 8:00 AM"
export const formatScheduled = (date: string, time: string | null) => {
  const day = fromDateString(date).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return time ? `${day}, ${formatTime(normalizeTime(time))}` : day;
};

// Booking a task marks it Scheduled, and taking the booking off undoes that. Moving
// an existing booking leaves the status alone, since it may have been set on purpose.
export const statusForSchedule = (item: Item, date: string | null): ItemStatus => {
  if (date && !item.scheduled_on) return "scheduled";
  if (!date && item.status === "scheduled") return "not_started";
  return item.status;
};

export const formatHours = (minutes: number) => {
  const hours = Math.round((minutes / 60) * 100) / 100;
  return `${hours} ${hours === 1 ? "hr" : "hrs"}`;
};

// "in 3 weeks", "tomorrow", "today"
export const formatCountdown = (date: string, now: string) => {
  const days = Math.round((fromDateString(date).getTime() - fromDateString(now).getTime()) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 7) return `in ${days} days`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? "in 1 week" : `in ${weeks} weeks`;
};

// ─── US holidays ───────────────────────────────────────────────────────────

const nthWeekday = (year: number, month: number, weekday: number, n: number) => {
  const first = new Date(year, month, 1).getDay();
  return toDateString(new Date(year, month, 1 + ((weekday - first + 7) % 7) + (n - 1) * 7));
};

const lastWeekday = (year: number, month: number, weekday: number) => {
  const last = new Date(year, month + 1, 0);
  return toDateString(new Date(year, month, last.getDate() - ((last.getDay() - weekday + 7) % 7)));
};

// The Gregorian computus.
const easter = (year: number) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return toDateString(new Date(year, month - 1, day));
};

const holidayCache = new Map<number, { date: string; title: string }[]>();

export const holidaysInYear = (year: number) => {
  const cached = holidayCache.get(year);
  if (cached) return cached;
  const fixed = (month: number, day: number) => toDateString(new Date(year, month, day));
  const holidays = [
    { date: fixed(0, 1), title: "New Year's Day" },
    { date: nthWeekday(year, 0, 1, 3), title: "Martin Luther King Jr. Day" },
    { date: fixed(1, 14), title: "Valentine's Day" },
    { date: nthWeekday(year, 1, 1, 3), title: "Presidents' Day" },
    { date: easter(year), title: "Easter" },
    { date: nthWeekday(year, 4, 0, 2), title: "Mother's Day" },
    { date: lastWeekday(year, 4, 1), title: "Memorial Day" },
    { date: nthWeekday(year, 5, 0, 3), title: "Father's Day" },
    { date: fixed(5, 19), title: "Juneteenth" },
    { date: fixed(6, 4), title: "Independence Day" },
    { date: nthWeekday(year, 8, 1, 1), title: "Labor Day" },
    { date: nthWeekday(year, 9, 1, 2), title: "Columbus Day" },
    { date: fixed(9, 31), title: "Halloween" },
    { date: fixed(10, 11), title: "Veterans Day" },
    { date: nthWeekday(year, 10, 4, 4), title: "Thanksgiving" },
    { date: fixed(11, 24), title: "Christmas Eve" },
    { date: fixed(11, 25), title: "Christmas Day" },
    { date: fixed(11, 31), title: "New Year's Eve" },
  ];
  holidayCache.set(year, holidays);
  return holidays;
};

export const holidaysOn = (date: string) =>
  holidaysInYear(Number(date.slice(0, 4)))
    .filter((h) => h.date === date)
    .map((h) => h.title);

// ─── Childcare ─────────────────────────────────────────────────────────────

// Why a list of blocks can't be saved, or null if it's fine.
export const blocksProblem = (blocks: ChildcareBlock[]) => {
  const sorted = [...blocks].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  for (const [i, block] of sorted.entries()) {
    if (!block.person_id) return "Pick who's covering each time block";
    if (!isValidTime(block.start) || !isValidTime(block.end)) return "Enter a start and end time for each block";
    if (toMinutes(block.start) >= toMinutes(block.end)) return "Each block has to end after it starts";
    if (i > 0 && toMinutes(block.start) < toMinutes(sorted[i - 1].end)) return "Time blocks can't overlap";
  }
  return null;
};

export type DayPlan = {
  blocks: ChildcareBlock[];
  // The hours that need someone, or null when the day doesn't count toward gaps.
  coverage: { start: number; end: number } | null;
  override: ChildcareOverride | null;
};

export const scheduleOn = (date: string, schedules: ChildcareSchedule[]) =>
  schedules.reduce<ChildcareSchedule | null>(
    (latest, s) =>
      s.effective_from <= date && (!latest || s.effective_from > latest.effective_from) ? s : latest,
    null
  );

export const planFor = (
  date: string,
  schedules: ChildcareSchedule[],
  overrides: ChildcareOverride[]
): DayPlan => {
  const weekday = weekdayOf(date);
  const schedule = scheduleOn(date, schedules);
  const override = overrides.find((o) => o.on_date === date) ?? null;
  const blocks = override
    ? override.blocks
    : (schedule?.blocks.filter((b) => b.weekday === weekday) ?? []).map(({ person_id, start, end }) => ({
        person_id,
        start,
        end,
      }));
  return {
    blocks: [...blocks].sort((a, b) => toMinutes(a.start) - toMinutes(b.start)),
    coverage:
      schedule && schedule.coverage_days.includes(weekday)
        ? { start: toMinutes(schedule.coverage_start), end: toMinutes(schedule.coverage_end) }
        : null,
    override,
  };
};

export type Gap = { start: number; end: number };

// The stretches of a day's coverage hours that nobody's assigned to.
export const gapsIn = ({ blocks, coverage }: DayPlan): Gap[] => {
  if (!coverage) return [];
  const gaps: Gap[] = [];
  let cursor = coverage.start;
  for (const block of blocks) {
    const start = toMinutes(block.start);
    const end = toMinutes(block.end);
    if (start > cursor) gaps.push({ start: cursor, end: Math.min(start, coverage.end) });
    cursor = Math.max(cursor, end);
    if (cursor >= coverage.end) break;
  }
  if (cursor < coverage.end) gaps.push({ start: cursor, end: coverage.end });
  return gaps.filter((g) => g.end > g.start);
};

export const gapMinutes = (gaps: Gap[]) => gaps.reduce((sum, g) => sum + g.end - g.start, 0);

// Minutes per person over a set of days.
export const minutesByPerson = (plans: DayPlan[]) => {
  const totals = new Map<string, number>();
  for (const { blocks } of plans) {
    for (const block of blocks) {
      const minutes = toMinutes(block.end) - toMinutes(block.start);
      totals.set(block.person_id, (totals.get(block.person_id) ?? 0) + minutes);
    }
  }
  return totals;
};

export const nextPersonColor = (people: ChildcarePerson[]) => {
  const used = people.filter((p) => !p.archived).map((p) => p.color);
  return (PERSON_COLORS.find((c) => !used.includes(c.hex)) ?? PERSON_COLORS[people.length % PERSON_COLORS.length]).hex;
};

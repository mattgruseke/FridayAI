// Options and rules for the weekly plan: what a day needs, and what to flag.

import { PARENT_IDS } from "@/api/client";
import type {
  ChildcarePerson,
  ChildcareSchedule,
  DinnerPlan,
  LocationKind,
  ParentId,
  PlanDay,
  PlannerDinner,
  PlannerLocation,
  PlannerSettingsInput,
  PlannerStandardDay,
  PlannerWork,
} from "@/api/client";
import {
  DEFAULT_COVERAGE,
  formatTime,
  fromMinutes,
  gapsIn,
  scheduleOn,
  toMinutes,
  weekdayOf,
} from "./familyCalendar";
import type { DayPlan } from "./familyCalendar";

export const DEFAULT_PLANNER_SETTINGS: PlannerSettingsInput = {
  parents: [
    { id: "parent_1", name: "Matt" },
    { id: "parent_2", name: "Georgia" },
  ],
  locations: [
    { id: "new-york", name: "New York", kind: "commute", color: "#3B6AA8", archived: false },
    { id: "stamford", name: "Stamford", kind: "commute", color: "#7D5BA6", archived: false },
    { id: "work-from-home", name: "Work from home", kind: "home", color: "#4E8A64", archived: false },
    { id: "off", name: "Off", kind: "off", color: "#64748B", archived: false },
  ],
  standard_days: [],
};

export const LOCATION_KIND_LABELS: Record<LocationKind, string> = {
  commute: "Commute and work hours",
  home: "Work hours only",
  off: "Not working",
};

export const DINNER_PLAN_LABELS: Record<DinnerPlan, string> = {
  cook: "Cook",
  leftovers: "Leftovers",
  pickup: "Pick up",
  delivery: "Delivery",
  eat_out: "Eat out",
  undecided: "Undecided",
};

// Dinners that fall to someone. Leftovers and eating out don't need a named owner.
const NEEDS_OWNER: DinnerPlan[] = ["cook", "pickup", "delivery"];
// Dinners that someone has to be around to handle.
const OWNER_MUST_BE_HOME: DinnerPlan[] = ["cook"];

export const emptyDinner = (): PlannerDinner => ({ plan: null, meal: null, meal_id: null, owner: null, home: {} });

export const emptyWork = (): PlannerWork => ({
  location_id: null,
  commute: null,
  leave_at: null,
  start: null,
  end: null,
  home_at: null,
});

export const rangeLabel = (start: number, end: number) =>
  `${formatTime(fromMinutes(start))}–${formatTime(fromMinutes(end))}`;

// Drops the times a location doesn't use, so switching from an office to working
// from home doesn't leave a stale commute behind.
export const cleanWork = (work: PlannerWork, locations: PlannerLocation[]): PlannerWork => {
  const kind = locations.find((l) => l.id === work.location_id)?.kind;
  const location_id = work.location_id ?? null;
  if (!kind || kind === "off") return { ...emptyWork(), location_id };
  const hours = { start: work.start || null, end: work.end || null };
  return kind === "home"
    ? { ...emptyWork(), location_id, ...hours }
    : {
        location_id,
        commute: work.commute?.trim() || null,
        leave_at: work.leave_at || null,
        ...hours,
        home_at: work.home_at || null,
      };
};

// Why a day's work times can't be saved, or null if they're fine.
export const workProblem = ({ leave_at, start, end, home_at }: PlannerWork) => {
  const times = [leave_at, start, end, home_at].filter((t): t is string => Boolean(t));
  return times.some((t, i) => i > 0 && toMinutes(t) < toMinutes(times[i - 1]))
    ? "Times have to run in order: leave, start work, finish work, back home"
    : null;
};

// The standard days a parent can fill in from, leaving out removed locations.
export const standardDaysFor = (parent: ParentId, settings: PlannerSettingsInput) =>
  settings.standard_days.filter(
    (s) =>
      s.parent_id === parent && settings.locations.some((l) => l.id === s.work.location_id && !l.archived)
  );

// "New York, 7:22 train"
export const standardDayLabel = (day: PlannerStandardDay, locations: PlannerLocation[]) => {
  const location = locations.find((l) => l.id === day.work.location_id)?.name ?? "Unknown";
  return day.work.commute ? `${location}, ${day.work.commute}` : location;
};

// The lines shown under a location: "7:22 train", "Leave 6:30 AM", "Work 8:00 AM–5:00 PM", "Home 6:30 PM"
export const workLines = ({ commute, leave_at, start, end, home_at }: PlannerWork) => {
  const lines: string[] = [];
  if (commute) lines.push(commute);
  if (leave_at) lines.push(`Leave ${formatTime(leave_at)}`);
  if (start && end) lines.push(`Work ${rangeLabel(toMinutes(start), toMinutes(end))}`);
  else if (start) lines.push(`Work from ${formatTime(start)}`);
  else if (end) lines.push(`Work until ${formatTime(end)}`);
  if (home_at) lines.push(`Home ${formatTime(home_at)}`);
  return lines;
};

const workIssues = (
  name: string,
  work: PlannerWork | undefined,
  location: PlannerLocation | undefined
): string[] => {
  if (!work || !location) return [`${name}'s work isn't planned`];
  if (location.kind === "commute" && !(work.leave_at && work.home_at)) {
    return [`${name}'s commute times aren't set`];
  }
  if (location.kind === "home" && !(work.start && work.end)) return [`${name}'s work hours aren't set`];
  return [];
};

// No childcare schedule covers this weekday, so nobody's been asked to cover it.
export const childcareUnplanned = (date: string, care: DayPlan, schedules: ChildcareSchedule[]) =>
  !care.override && !scheduleOn(date, schedules) && DEFAULT_COVERAGE.days.includes(weekdayOf(date));

const childcareIssues = (
  date: string,
  day: PlanDay | undefined,
  care: DayPlan,
  schedules: ChildcareSchedule[],
  people: ChildcarePerson[],
  parentName: (id: ParentId) => string,
  locationOf: (id: string | null | undefined) => PlannerLocation | undefined
): string[] => {
  const issues: string[] = [];
  if (childcareUnplanned(date, care, schedules)) issues.push("Childcare isn't planned");
  for (const gap of gapsIn(care)) issues.push(`Childcare gap ${rangeLabel(gap.start, gap.end)}`);

  // A parent down for childcare while they're out at an office.
  for (const parent of PARENT_IDS) {
    const name = parentName(parent);
    const work = day?.work[parent];
    const location = locationOf(work?.location_id);
    const away = work?.leave_at ?? work?.start;
    const back = work?.home_at ?? work?.end;
    if (location?.kind !== "commute" || !away || !back) continue;
    for (const block of care.blocks) {
      const person = people.find((p) => p.id === block.person_id);
      if (person?.name.trim().toLowerCase() !== name.trim().toLowerCase()) continue;
      const [start, end] = [toMinutes(block.start), toMinutes(block.end)];
      if (start < toMinutes(back) && end > toMinutes(away)) {
        issues.push(`${name} is down for childcare ${rangeLabel(start, end)} but is in ${location.name}`);
      }
    }
  }
  return issues;
};

const dinnerIssues = (day: PlanDay | undefined, parentName: (id: ParentId) => string): string[] => {
  const dinner = day?.dinner;
  if (!dinner?.plan) return ["Dinner isn't planned"];
  if (dinner.plan === "undecided") return ["Dinner is undecided"];

  const issues: string[] = [];
  if (!dinner.owner && NEEDS_OWNER.includes(dinner.plan)) issues.push("Nobody's handling dinner");
  if (dinner.owner && dinner.home[dinner.owner] === false && OWNER_MUST_BE_HOME.includes(dinner.plan)) {
    issues.push(`${parentName(dinner.owner)} is cooking but won't be home`);
  }
  if (PARENT_IDS.some((id) => dinner.home[id] === undefined)) issues.push("Who's home for dinner isn't answered");
  else if (PARENT_IDS.every((id) => dinner.home[id] === false)) issues.push("Neither parent is home for dinner");
  return issues;
};

// Everything about a day that's missing or doesn't add up.
export const dayIssues = ({
  date,
  day,
  settings,
  care,
  schedules,
  people,
}: {
  date: string;
  day: PlanDay | undefined;
  settings: PlannerSettingsInput;
  care: DayPlan;
  schedules: ChildcareSchedule[];
  people: ChildcarePerson[];
}): string[] => {
  const parentName = (id: ParentId) => settings.parents.find((p) => p.id === id)?.name ?? "Parent";
  const locationOf = (id: string | null | undefined) => settings.locations.find((l) => l.id === id);
  return [
    ...PARENT_IDS.flatMap((id) => workIssues(parentName(id), day?.work[id], locationOf(day?.work[id]?.location_id))),
    ...childcareIssues(date, day, care, schedules, people, parentName, locationOf),
    ...dinnerIssues(day, parentName),
  ];
};

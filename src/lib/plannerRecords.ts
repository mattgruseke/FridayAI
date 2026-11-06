// Server-side validation and tables for /api/planner. In local mode they're written
// to .local-data/planner.json, so they survive restarts.

import {
  DINNER_PLANS,
  LOCATION_KINDS,
  PARENT_IDS,
  type DinnerPlan,
  type LocationKind,
  type ParentId,
  type PlanDay,
  type PlanDayInput,
  type PlannerLocation,
  type PlannerSettings,
  type PlannerSettingsInput,
  type PlannerWork,
} from "@/api/client";
import { isValidTime, PERSON_COLORS } from "@/config/familyCalendar";
import { cleanWork, DEFAULT_PLANNER_SETTINGS, workProblem } from "@/config/weeklyPlan";
import { isRealDate, recordRoutes, recordStore, text } from "@/lib/recordStore";
import type { ParseResult } from "@/lib/recordStore";

const LOCAL_FILE = "planner";
const MAX_LOCATIONS = 30;
const MAX_STANDARD_DAYS = 40;
const MAX_DISHES = 20;

const days = recordStore<PlanDay, PlanDayInput>(LOCAL_FILE, "planner_days");
const settings = recordStore<PlannerSettings, PlannerSettingsInput>(LOCAL_FILE, "planner_settings");

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isParent = (value: unknown): value is ParentId => PARENT_IDS.includes(value as ParentId);

// One parent's work for a day, cleaned up, or why it can't be saved.
const parseWork = (raw: Record<string, unknown>, locations: PlannerLocation[]): PlannerWork | string => {
  const times = [raw.leave_at, raw.start, raw.end, raw.home_at];
  if (times.some((t) => t != null && !isValidTime(t))) return "Invalid time";
  if (raw.location_id != null && !locations.some((l) => l.id === raw.location_id)) {
    return "Unknown work location";
  }
  const entry = cleanWork(
    { ...(raw as unknown as PlannerWork), commute: text(raw.commute, 80) },
    locations
  );
  return workProblem(entry) ?? entry;
};

const parseDay = async (body: Record<string, unknown>, userId: string): Promise<ParseResult<PlanDayInput>> => {
  if (!isRealDate(body.plan_on)) return { ok: false, error: "A valid date is required" };

  const { locations } = (await settings.list(userId))[0] ?? DEFAULT_PLANNER_SETTINGS;
  const rawWork = isObject(body.work) ? body.work : {};
  const work: PlanDayInput["work"] = {};
  for (const parent of PARENT_IDS) {
    const raw = rawWork[parent];
    if (raw === undefined) continue;
    if (!isObject(raw)) return { ok: false, error: "Invalid work plan" };
    const entry = parseWork(raw, locations);
    if (typeof entry === "string") return { ok: false, error: entry };
    work[parent] = entry;
  }

  const rawDinner = isObject(body.dinner) ? body.dinner : {};
  if (rawDinner.plan != null && !DINNER_PLANS.includes(rawDinner.plan as DinnerPlan)) {
    return { ok: false, error: "Invalid dinner plan" };
  }
  if (rawDinner.owner != null && !isParent(rawDinner.owner)) {
    return { ok: false, error: "Invalid dinner owner" };
  }
  const rawHome = isObject(rawDinner.home) ? rawDinner.home : {};
  const home: PlanDayInput["dinner"]["home"] = {};
  for (const parent of PARENT_IDS) {
    if (typeof rawHome[parent] === "boolean") home[parent] = rawHome[parent] as boolean;
  }

  const rawDishes = Array.isArray(body.dishes) ? body.dishes : [];
  if (rawDishes.length > MAX_DISHES) return { ok: false, error: "Too many dishes on one day" };
  const dishes: PlanDayInput["dishes"] = [];
  for (const raw of rawDishes) {
    const name = text(raw?.name, 120);
    const id = text(raw?.id, 80);
    const meal_id = text(raw?.meal_id, 80);
    if (!name || !id || !meal_id) return { ok: false, error: "Invalid dish" };
    dishes.push({ id, meal_id, name, occasion: text(raw.occasion, 200) });
  }

  return {
    ok: true,
    data: {
      plan_on: body.plan_on,
      work,
      dishes,
      dinner: {
        plan: (rawDinner.plan as DinnerPlan | null | undefined) ?? null,
        meal: text(rawDinner.meal, 200),
        meal_id: text(rawDinner.meal_id, 80),
        owner: (rawDinner.owner as ParentId | null | undefined) ?? null,
        home,
      },
      note: text(body.note, 2000),
    },
  };
};

const parseSettings = async (body: Record<string, unknown>): Promise<ParseResult<PlannerSettingsInput>> => {
  const rawParents = Array.isArray(body.parents) ? body.parents : [];
  const parents: PlannerSettingsInput["parents"] = [];
  for (const id of PARENT_IDS) {
    const name = text(rawParents.find((p) => p?.id === id)?.name, 80);
    if (!name) return { ok: false, error: "Enter a name for both parents" };
    parents.push({ id, name });
  }

  const rawLocations = body.locations;
  if (!Array.isArray(rawLocations) || rawLocations.length > MAX_LOCATIONS) {
    return { ok: false, error: "Invalid locations" };
  }
  const locations: PlannerSettingsInput["locations"] = [];
  for (const raw of rawLocations) {
    const name = text(raw?.name, 80);
    if (!name) return { ok: false, error: "Enter a name for each location" };
    if (typeof raw.id !== "string" || !raw.id || raw.id.length > 80) return { ok: false, error: "Invalid location" };
    if (locations.some((l) => l.id === raw.id)) return { ok: false, error: "Invalid location" };
    if (!LOCATION_KINDS.includes(raw.kind as LocationKind)) return { ok: false, error: "Invalid location type" };
    if (!PERSON_COLORS.some((c) => c.hex === raw.color)) return { ok: false, error: "Invalid color" };
    locations.push({ id: raw.id, name, kind: raw.kind, color: raw.color, archived: raw.archived === true });
  }

  const rawStandard = body.standard_days ?? [];
  if (!Array.isArray(rawStandard) || rawStandard.length > MAX_STANDARD_DAYS) {
    return { ok: false, error: "Invalid standard days" };
  }
  const standard_days: PlannerSettingsInput["standard_days"] = [];
  for (const raw of rawStandard) {
    if (typeof raw?.id !== "string" || !raw.id || raw.id.length > 80) return { ok: false, error: "Invalid standard day" };
    if (standard_days.some((s) => s.id === raw.id)) return { ok: false, error: "Invalid standard day" };
    if (!isParent(raw.parent_id) || !isObject(raw.work)) return { ok: false, error: "Invalid standard day" };
    if (!raw.work.location_id) return { ok: false, error: "Pick a location for each standard day" };
    const work = parseWork(raw.work, locations);
    if (typeof work === "string") return { ok: false, error: work };
    // One standard per parent: the first one marked wins.
    const is_default = raw.is_default === true && !standard_days.some((s) => s.parent_id === raw.parent_id && s.is_default);
    standard_days.push({ id: raw.id, parent_id: raw.parent_id, is_default, work });
  }
  return { ok: true, data: { parents, locations, standard_days } };
};

export const planDayRoutes = recordRoutes(days, parseDay);
export const plannerSettingsRoutes = recordRoutes(settings, parseSettings);

// Options and logic for meals, and the grocery list and dinner suggestions built from them.
// Shared by the UI and /api/meals and /api/groceries.

import type { GroceryWeekDraft, Meal, MealInput, PlanDay, PlannerSettingsInput } from "@/api/client";
import { PARENT_IDS } from "@/api/client";
import { formatTime, fromMinutes, toMinutes } from "./familyCalendar";
import { formatDate, fromDateString } from "./homeRecords";

export const MEAL_METHODS = [
  { id: "crockpot", label: "Crock pot" },
  { id: "night_before", label: "Prep the night before" },
  { id: "grill", label: "Grilling" },
  { id: "stovetop", label: "Stovetop" },
  { id: "oven", label: "Oven" },
  { id: "no_cook", label: "No cook" },
] as const;

export const MEAL_CUISINES = [
  { id: "american", label: "American" },
  { id: "italian", label: "Italian" },
  { id: "mexican", label: "Mexican" },
  { id: "asian", label: "Asian" },
  { id: "mediterranean", label: "Mediterranean" },
  { id: "indian", label: "Indian" },
  { id: "other", label: "Other" },
] as const;

export const TIME_FILTERS = [
  { id: "under30", label: "Under 30 min" },
  { id: "30to60", label: "30 to 60 min" },
  { id: "over60", label: "Over an hour" },
] as const;

// The first groups are what you shop for; pantry staples and spices are assumed to be
// on hand, and only go on the order if you say you're out.
export const INGREDIENT_GROUPS = [
  { id: "produce", label: "Produce" },
  { id: "meat", label: "Meat & seafood" },
  { id: "dairy", label: "Dairy & eggs" },
  { id: "grocery", label: "Other groceries" },
  { id: "pantry", label: "Pantry" },
  { id: "spices", label: "Spices" },
] as const;

export type MealMethod = (typeof MEAL_METHODS)[number]["id"];
export type MealCuisine = (typeof MEAL_CUISINES)[number]["id"];
export type TimeFilter = (typeof TIME_FILTERS)[number]["id"];
export type IngredientGroup = (typeof INGREDIENT_GROUPS)[number]["id"];

export const MEAL_METHOD_IDS = MEAL_METHODS.map((m) => m.id) as MealMethod[];
export const MEAL_CUISINE_IDS = MEAL_CUISINES.map((c) => c.id) as MealCuisine[];
export const INGREDIENT_GROUP_IDS = INGREDIENT_GROUPS.map((g) => g.id) as IngredientGroup[];

const labelOf = (list: readonly { id: string; label: string }[], id: string) =>
  list.find((x) => x.id === id)?.label ?? id;

export const methodLabel = (id: string) => labelOf(MEAL_METHODS, id);
export const mealCuisineLabel = (id: string) => labelOf(MEAL_CUISINES, id);
export const groupLabel = (id: string) => labelOf(INGREDIENT_GROUPS, id);

export const isOnHandGroup = (group: IngredientGroup) => group === "pantry" || group === "spices";

// ─── Times ─────────────────────────────────────────────────────────────────

// null when neither time has been entered.
export const totalMinutes = (meal: Pick<Meal, "prep_minutes" | "cook_minutes">) =>
  meal.prep_minutes == null && meal.cook_minutes == null ? null : (meal.prep_minutes ?? 0) + (meal.cook_minutes ?? 0);

// "25 min", "6 hrs", "1 hr 30 min"
export const formatMinutes = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  const hourText = `${hours} ${hours === 1 ? "hr" : "hrs"}`;
  return rest ? `${hourText} ${rest} min` : hourText;
};

export const matchesTime = (meal: Meal, filter: TimeFilter) => {
  const total = totalMinutes(meal);
  if (total == null) return false;
  if (filter === "under30") return total < 30;
  if (filter === "30to60") return total >= 30 && total <= 60;
  return total > 60;
};

// "Prep 10 min · Cook 6 hrs"
export const mealTimes = (meal: Meal) =>
  [
    meal.prep_minutes != null ? `Prep ${formatMinutes(meal.prep_minutes)}` : null,
    meal.cook_minutes != null ? `Cook ${formatMinutes(meal.cook_minutes)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

export const sortMeals = (meals: Meal[]) => [...meals].sort((a, b) => a.name.localeCompare(b.name));

// ─── Grocery list ──────────────────────────────────────────────────────────

export type GroceryItem = {
  key: string;
  name: string;
  group: IngredientGroup;
  quantities: string[];
  meals: string[];
  extraId?: string; // added by hand rather than coming from a meal
};

export type GroceryList = {
  dinners: { date: string; meal: Meal }[];
  toBuy: GroceryItem[];
  onHand: GroceryItem[];
  // What actually needs ordering, once "already have it" and "I'm out" are applied.
  needed: GroceryItem[];
  addedSinceOrder: GroceryItem[];
  status: "empty" | "to_order" | "ordered" | "changed";
};

export const groceryKey = (name: string) => name.trim().toLowerCase();

export const emptyGroceryWeek = (weekOf: string): GroceryWeekDraft => ({
  week_of: weekOf,
  have: [],
  need: [],
  extras: [],
  ordered_at: null,
  ordered_keys: [],
});

// Built fresh from the week's planned dinners, so changing a dinner changes the list.
// Dinners already behind you don't need shopping for.
export const buildGroceryList = ({
  dates,
  days,
  meals,
  week,
  now,
}: {
  dates: string[];
  days: PlanDay[];
  meals: Meal[];
  week: GroceryWeekDraft | undefined;
  now: string;
}): GroceryList => {
  const dinners = dates
    .filter((date) => date >= now)
    .flatMap((date) => {
      const mealId = days.find((d) => d.plan_on === date)?.dinner?.meal_id;
      const meal = mealId ? meals.find((m) => m.id === mealId) : undefined;
      return meal ? [{ date, meal }] : [];
    });

  const items = new Map<string, GroceryItem>();
  for (const { meal } of dinners) {
    for (const ingredient of meal.ingredients) {
      const key = groceryKey(ingredient.name);
      const item = items.get(key) ?? {
        key,
        name: ingredient.name.trim(),
        group: ingredient.group,
        quantities: [],
        meals: [],
      };
      if (ingredient.quantity) item.quantities.push(ingredient.quantity);
      if (!item.meals.includes(meal.name)) item.meals.push(meal.name);
      // Something one meal buys and another keeps in the pantry still needs buying.
      if (isOnHandGroup(item.group) && !isOnHandGroup(ingredient.group)) item.group = ingredient.group;
      items.set(key, item);
    }
  }

  const byName = (a: GroceryItem, b: GroceryItem) => a.name.localeCompare(b.name);
  const fromMeals = [...items.values()];
  const extras: GroceryItem[] = (week?.extras ?? []).map((extra) => ({
    key: `extra:${extra.id}`,
    name: extra.name,
    group: extra.group,
    quantities: extra.quantity ? [extra.quantity] : [],
    meals: [],
    extraId: extra.id,
  }));
  const toBuy = [...fromMeals.filter((i) => !isOnHandGroup(i.group)), ...extras].sort(byName);
  const onHand = fromMeals.filter((i) => isOnHandGroup(i.group)).sort(byName);

  const needed = [
    ...toBuy.filter((i) => !week?.have.includes(i.key)),
    ...onHand.filter((i) => week?.need.includes(i.key)),
  ];
  const addedSinceOrder = week?.ordered_at ? needed.filter((i) => !week.ordered_keys.includes(i.key)) : [];
  const status = week?.ordered_at
    ? addedSinceOrder.length > 0
      ? "changed"
      : "ordered"
    : needed.length > 0
      ? "to_order"
      : "empty";

  return { dinners, toBuy, onHand, needed, addedSinceOrder, status };
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

// "14 items for 3 dinners"
export const grocerySummary = (list: GroceryList) =>
  `${plural(list.needed.length, "item")} for ${plural(list.dinners.length, "dinner")}`;

export const itemAmount = (item: GroceryItem) => item.quantities.join(" + ");

// Plain text to paste into a shopping site or a message.
export const groceryText = (list: GroceryList, weekOf: string) => {
  const lines = [`Groceries, week of ${formatDate(weekOf)}`];
  for (const group of INGREDIENT_GROUPS) {
    const items = list.needed.filter((i) => i.group === group.id);
    if (items.length === 0) continue;
    lines.push("", group.label);
    for (const item of items) lines.push(`- ${item.name}${item.quantities.length ? ` (${itemAmount(item)})` : ""}`);
  }
  return lines.join("\n");
};

// ─── Dinner suggestions ────────────────────────────────────────────────────

const LATE_HOME = 17 * 60 + 30; // home at 5:30 or later leaves little time to cook
const LONG_MEAL = 45;
const RECENT_DAYS = 7;
const A_WHILE_DAYS = 21;

type DayPlanLike = Pick<PlanDay, "work" | "dinner"> | undefined;

// The earliest anyone's home to get dinner going, or null if that isn't known yet.
export const homeBy = (day: DayPlanLike, settings: PlannerSettingsInput) => {
  const times = PARENT_IDS.flatMap((id) => {
    if (day?.dinner?.home?.[id] === false) return [];
    const work = day?.work?.[id];
    const location = settings.locations.find((l) => l.id === work?.location_id);
    if (!work || !location) return [];
    if (location.kind === "off") return [0];
    const back = location.kind === "commute" ? (work.home_at ?? work.end) : work.end;
    return back ? [toMinutes(back)] : [];
  });
  return times.length > 0 ? Math.min(...times) : null;
};

export type DinnerSuggestion = { meal: Meal; reason: string };

// Meals that suit this evening, best first. These are simple rules: fit the time you'll
// have, and don't repeat what you've just had. excludeIds skips meals already on this week.
export const suggestDinners = ({
  date,
  day,
  settings,
  meals,
  days,
  excludeIds = [],
}: {
  date: string;
  day: DayPlanLike;
  settings: PlannerSettingsInput;
  meals: Meal[];
  days: PlanDay[];
  excludeIds?: string[];
}): DinnerSuggestion[] => {
  const home = homeBy(day, settings);
  const lateNight = home != null && home >= LATE_HOME;
  const dayNumber = (d: string) => fromDateString(d).getTime() / 86400000;

  return meals
    .filter((meal) => !excludeIds.includes(meal.id))
    .map((meal) => {
      const total = totalMinutes(meal);
      const gaps = days
        .filter((d) => d.dinner?.meal_id === meal.id && d.plan_on !== date)
        .map((d) => Math.abs(Math.round(dayNumber(d.plan_on) - dayNumber(date))));
      const closest = gaps.length > 0 ? Math.min(...gaps) : null;

      let score = 0;
      let reason: string | null = null;
      if (lateNight) {
        if (meal.methods.includes("crockpot")) {
          score += 3;
          reason = "Crock pot: set it in the morning";
        } else if (meal.methods.includes("night_before")) {
          score += 3;
          reason = "Prep it the night before";
        } else if (total != null && total <= 30) {
          score += 3;
          reason = `Quick: home at ${formatTime(fromMinutes(home))}`;
        } else if (total == null || total > LONG_MEAL) {
          score -= 3;
        }
      }
      if (closest == null) {
        score += 1;
        reason ??= "Haven't made it yet";
      } else if (closest >= A_WHILE_DAYS) {
        score += 2;
        reason ??= "Haven't had it in a while";
      } else if (closest < RECENT_DAYS) {
        score -= 4;
      }
      reason ??= total != null ? `${formatMinutes(total)} total` : mealCuisineLabel(meal.cuisine);
      return { meal, reason, score };
    })
    .sort((a, b) => b.score - a.score || a.meal.name.localeCompare(b.meal.name))
    .map(({ meal, reason }) => ({ meal, reason }));
};

// ─── Starter meals ─────────────────────────────────────────────────────────

type Row = [IngredientGroup, string, string?];

const starter = (
  name: string,
  cuisine: MealCuisine,
  methods: MealMethod[],
  prep_minutes: number,
  cook_minutes: number,
  servings: number,
  rows: Row[]
): MealInput => ({
  name,
  cuisine,
  methods,
  prep_minutes,
  cook_minutes,
  servings,
  ingredients: rows.map(([group, ingredient, quantity]) => ({ group, name: ingredient, quantity: quantity ?? null })),
  tags: [],
  notes: null,
  recipe_url: null,
});

// Only added when asked for, as a starting point to edit. Amounts are rough estimates.
export const STARTER_MEALS: MealInput[] = [
  starter("Chicken tacos", "mexican", ["stovetop"], 10, 15, 4, [
    ["meat", "Chicken breasts", "2 lb"],
    ["dairy", "Shredded cheese", "8 oz"],
    ["dairy", "Sour cream", "8 oz"],
    ["grocery", "Flour tortillas", "12"],
    ["grocery", "Salsa", "1 jar"],
    ["produce", "Lettuce", "1 head"],
    ["produce", "Limes", "2"],
    ["spices", "Taco seasoning", "1 packet"],
    ["pantry", "Olive oil", "1 tbsp"],
  ]),
  starter("Crock pot chicken", "american", ["crockpot"], 10, 360, 4, [
    ["meat", "Chicken breasts", "2 lb"],
    ["grocery", "Chicken broth", "1 cup"],
    ["produce", "Yellow onion", "1"],
    ["produce", "Garlic", "3 cloves"],
    ["spices", "Paprika", "1 tsp"],
    ["spices", "Salt and pepper"],
  ]),
  starter("French dip", "american", ["crockpot"], 10, 480, 6, [
    ["meat", "Chuck roast", "3 lb"],
    ["grocery", "Hoagie rolls", "6"],
    ["grocery", "Beef broth", "2 cups"],
    ["dairy", "Provolone", "6 slices"],
    ["produce", "Yellow onion", "1"],
    ["pantry", "Worcestershire sauce", "2 tbsp"],
    ["spices", "Salt and pepper"],
  ]),
  starter("Mac and cheese", "american", ["stovetop", "oven"], 10, 25, 6, [
    ["grocery", "Elbow macaroni", "1 lb"],
    ["dairy", "Shredded cheddar", "4 cups"],
    ["dairy", "Milk", "3 cups"],
    ["dairy", "Butter", "4 tbsp"],
    ["pantry", "Flour", "1/4 cup"],
    ["spices", "Mustard powder", "1 tsp"],
    ["spices", "Salt and pepper"],
  ]),
  starter("Spaghetti and meatballs", "italian", ["stovetop"], 15, 30, 4, [
    ["meat", "Ground beef", "1 lb"],
    ["grocery", "Spaghetti", "1 lb"],
    ["grocery", "Marinara sauce", "24 oz jar"],
    ["dairy", "Parmesan", "1/2 cup"],
    ["dairy", "Eggs", "1"],
    ["pantry", "Breadcrumbs", "1/2 cup"],
    ["spices", "Italian seasoning", "1 tsp"],
    ["spices", "Salt and pepper"],
  ]),
];

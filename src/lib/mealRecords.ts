// Server-side validation and tables for /api/meals and /api/groceries. In local mode
// they're written to .local-data/meals.json, so they survive restarts.

import type { GroceryWeek, GroceryWeekInput, Meal, MealInput } from "@/api/client";
import { INGREDIENT_GROUP_IDS, MEAL_CUISINE_IDS, MEAL_METHOD_IDS } from "@/config/meals";
import type { IngredientGroup, MealCuisine, MealMethod } from "@/config/meals";
import { isRealDate, recordRoutes, recordStore, text } from "@/lib/recordStore";
import type { ParseResult } from "@/lib/recordStore";

const LOCAL_FILE = "meals";
const MAX_INGREDIENTS = 100;
const MAX_TAGS = 20;
const MAX_MINUTES = 2880;
const MAX_SERVINGS = 100;
const MAX_KEYS = 500;
const MAX_EXTRAS = 100;

const meals = recordStore<Meal, MealInput>(LOCAL_FILE, "meals");
const groceryWeeks = recordStore<GroceryWeek, GroceryWeekInput>(LOCAL_FILE, "grocery_weeks");

const isGroup = (value: unknown): value is IngredientGroup => INGREDIENT_GROUP_IDS.includes(value as IngredientGroup);

// A whole number from min to max, null for blank, undefined for invalid.
const optionalInt = (value: unknown, min: number, max: number) => {
  if (value == null || value === "") return null;
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max ? (value as number) : undefined;
};

const parseUrl = (value: unknown) => {
  const url = text(value, 500);
  if (!url) return null;
  try {
    return ["http:", "https:"].includes(new URL(url).protocol) ? url : undefined;
  } catch {
    return undefined;
  }
};

const parseMeal = async (body: Record<string, unknown>): Promise<ParseResult<MealInput>> => {
  const name = text(body.name, 120);
  if (!name) return { ok: false, error: "A meal name is required" };
  if (!MEAL_CUISINE_IDS.includes(body.cuisine as MealCuisine)) return { ok: false, error: "Invalid cuisine" };

  const methods = Array.isArray(body.methods) ? body.methods : [];
  if (methods.some((m) => !MEAL_METHOD_IDS.includes(m))) return { ok: false, error: "Invalid cooking style" };

  const prep_minutes = optionalInt(body.prep_minutes, 0, MAX_MINUTES);
  const cook_minutes = optionalInt(body.cook_minutes, 0, MAX_MINUTES);
  if (prep_minutes === undefined || cook_minutes === undefined) {
    return { ok: false, error: `Times have to be whole minutes, up to ${MAX_MINUTES}` };
  }
  const servings = optionalInt(body.servings, 1, MAX_SERVINGS);
  if (servings === undefined) return { ok: false, error: "Invalid number of servings" };

  const rawIngredients = Array.isArray(body.ingredients) ? body.ingredients : [];
  if (rawIngredients.length > MAX_INGREDIENTS) return { ok: false, error: "Too many ingredients" };
  const ingredients: MealInput["ingredients"] = [];
  for (const raw of rawIngredients) {
    const ingredient = text(raw?.name, 120);
    if (!ingredient) return { ok: false, error: "Each ingredient needs a name" };
    if (!isGroup(raw.group)) return { ok: false, error: "Invalid ingredient type" };
    ingredients.push({ name: ingredient, quantity: text(raw.quantity, 60), group: raw.group });
  }

  const recipe_url = parseUrl(body.recipe_url);
  if (recipe_url === undefined) return { ok: false, error: "The recipe link has to be a web address" };

  const tags = (Array.isArray(body.tags) ? body.tags : [])
    .map((tag) => text(tag, 40))
    .filter((tag): tag is string => Boolean(tag))
    .slice(0, MAX_TAGS);

  return {
    ok: true,
    data: {
      name,
      cuisine: body.cuisine as MealCuisine,
      methods: [...new Set(methods as MealMethod[])],
      prep_minutes,
      cook_minutes,
      servings,
      ingredients,
      tags,
      notes: text(body.notes, 10000),
      recipe_url,
    },
  };
};

const parseKeys = (value: unknown): string[] | null =>
  value === undefined
    ? []
    : Array.isArray(value) && value.length <= MAX_KEYS && value.every((k) => typeof k === "string" && k.length <= 200)
      ? [...new Set(value as string[])]
      : null;

const parseWeek = async (body: Record<string, unknown>): Promise<ParseResult<GroceryWeekInput>> => {
  if (!isRealDate(body.week_of)) return { ok: false, error: "A valid week is required" };
  const have = parseKeys(body.have);
  const need = parseKeys(body.need);
  const ordered_keys = parseKeys(body.ordered_keys);
  if (!have || !need || !ordered_keys) return { ok: false, error: "Invalid grocery list" };

  const rawExtras = Array.isArray(body.extras) ? body.extras : [];
  if (rawExtras.length > MAX_EXTRAS) return { ok: false, error: "Too many extra items" };
  const extras: GroceryWeekInput["extras"] = [];
  for (const raw of rawExtras) {
    const name = text(raw?.name, 120);
    if (!name) return { ok: false, error: "Each item needs a name" };
    if (typeof raw.id !== "string" || !raw.id || raw.id.length > 80) return { ok: false, error: "Invalid item" };
    if (!isGroup(raw.group)) return { ok: false, error: "Invalid item type" };
    extras.push({ id: raw.id, name, quantity: text(raw.quantity, 60), group: raw.group });
  }

  const ordered_at = body.ordered_at == null ? null : body.ordered_at;
  if (ordered_at !== null && (typeof ordered_at !== "string" || Number.isNaN(Date.parse(ordered_at)))) {
    return { ok: false, error: "Invalid order date" };
  }

  return { ok: true, data: { week_of: body.week_of, have, need, extras, ordered_at, ordered_keys } };
};

export const mealRoutes = recordRoutes(meals, parseMeal);
export const groceryWeekRoutes = recordRoutes(groceryWeeks, parseWeek);

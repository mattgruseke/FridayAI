// Server-side helpers for /api/restaurants: body validation, rating summaries,
// and the local-mode store. In local mode restaurants are written to
// .local-data/restaurants.json so they survive restarts (like intake answers).

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { CUISINE_IDS, OCCASION_IDS, SERVICE_IDS } from "@/config/restaurants";
import type { Restaurant, RestaurantInput, RestaurantVisit, RestaurantVisitInput } from "@/api/client";

type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

const optionalText = (value: unknown, max = 2000) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed || null;
};

const pickList = <T extends string>(value: unknown, allowed: T[]): T[] =>
  Array.isArray(value) ? allowed.filter((id) => value.includes(id)) : [];

// Validates a create (partial = false) or update (partial = true) body. Only
// known fields are copied; for updates, missing fields are left out.
export const parseRestaurant = (
  body: Record<string, unknown>,
  partial: boolean
): ParseResult<Partial<RestaurantInput>> => {
  const out: Partial<RestaurantInput> = {};
  const has = (key: string) => !partial || key in body;

  if (has("name")) {
    const name = optionalText(body.name, 200);
    if (!name) return { ok: false, error: "Name is required" };
    out.name = name;
  }
  if (has("cuisine")) {
    const cuisine = body.cuisine ?? "other";
    if (!CUISINE_IDS.includes(cuisine as never)) return { ok: false, error: "Invalid cuisine" };
    out.cuisine = cuisine as RestaurantInput["cuisine"];
  }
  if (has("price")) {
    const price = body.price;
    if (price != null && !(Number.isInteger(price) && (price as number) >= 1 && (price as number) <= 4)) {
      return { ok: false, error: "Price must be 1–4" };
    }
    out.price = (price as number | null) ?? null;
  }
  if (has("booking_url")) {
    const url = optionalText(body.booking_url, 1000);
    if (url && !/^https?:\/\//i.test(url)) {
      return { ok: false, error: "Booking link must start with http:// or https://" };
    }
    out.booking_url = url;
  }
  if (has("occasions")) out.occasions = pickList(body.occasions, OCCASION_IDS);
  if (has("services")) out.services = pickList(body.services, SERVICE_IDS);
  if (has("tags")) {
    out.tags = Array.isArray(body.tags)
      ? body.tags
          .filter((t): t is string => typeof t === "string" && !!t.trim())
          .map((t) => t.trim().slice(0, 40))
          .slice(0, 12)
      : [];
  }
  for (const key of ["style", "location", "distance", "note", "usual_order", "booking_label"] as const) {
    if (has(key)) out[key] = optionalText(body[key]);
  }

  return { ok: true, data: out };
};

export const parseVisit = (body: Record<string, unknown>): ParseResult<RestaurantVisitInput> => {
  const rating = body.rating ?? null;
  if (rating !== null && !(Number.isInteger(rating) && (rating as number) >= 1 && (rating as number) <= 10)) {
    return { ok: false, error: "Rating must be 1–10" };
  }
  const visitedOn = typeof body.visited_on === "string" ? body.visited_on : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(visitedOn)) return { ok: false, error: "Invalid visit date" };

  return {
    ok: true,
    data: {
      visited_on: visitedOn,
      rating: rating as number | null,
      rated_by: optionalText(body.rated_by, 80),
      note: optionalText(body.note),
    },
  };
};

// Adds avg_rating / visit_count from the restaurant's visits.
export const withRating = <R extends Omit<Restaurant, "avg_rating" | "visit_count">>(
  restaurant: R,
  visits: Pick<RestaurantVisit, "rating">[]
): R & Pick<Restaurant, "avg_rating" | "visit_count"> => {
  const ratings = visits.map((v) => v.rating).filter((r): r is number => r != null);
  return {
    ...restaurant,
    avg_rating: ratings.length
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null,
    visit_count: visits.length,
  };
};

// Newest visit first.
export const sortVisits = <V extends Pick<RestaurantVisit, "visited_on" | "created_at">>(visits: V[]) =>
  [...visits].sort(
    (a, b) => b.visited_on.localeCompare(a.visited_on) || b.created_at.localeCompare(a.created_at)
  );

// ─── Local mode store ──────────────────────────────────────────────────────

type StoredRestaurant = Omit<Restaurant, "avg_rating" | "visit_count">;
type LocalData = { restaurants: StoredRestaurant[]; visits: RestaurantVisit[] };

const localFile = path.join(process.cwd(), ".local-data", "restaurants.json");

export const readLocal = async (): Promise<LocalData> => {
  try {
    return JSON.parse(await readFile(localFile, "utf8"));
  } catch {
    return { restaurants: [], visits: [] };
  }
};

export const writeLocal = async (data: LocalData) => {
  await mkdir(path.dirname(localFile), { recursive: true });
  await writeFile(localFile, JSON.stringify(data, null, 2) + "\n");
};

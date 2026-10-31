import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isLocalMode } from "@/lib/local";
import { parseRestaurant, readLocal, sortVisits, withRating, writeLocal } from "@/lib/restaurants";
import type { Restaurant, RestaurantInput, RestaurantVisit } from "@/api/client";

// The user's logged restaurants. Row-level security on `restaurants` and
// `restaurant_visits` (supabase/schema.sql) limits queries to the signed-in
// user's rows; the user_id filters below are belt-and-braces.

const jsonResponse = (data: unknown, status = 200) =>
  NextResponse.json(data, { status });

type Row = Record<string, unknown> & { restaurant_visits?: { rating: number | null }[] };

// Supabase returns visits nested under restaurant_visits; flatten into the API shape.
const fromRow = ({ restaurant_visits = [], ...row }: Row): Restaurant =>
  withRating(row as Omit<Restaurant, "avg_rating" | "visit_count">, restaurant_visits);

// GET /api/restaurants — every restaurant, newest first, with avg_rating
// GET /api/restaurants?id=xxx — one restaurant plus its visits
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");

  if (isLocalMode) {
    const { restaurants, visits } = await readLocal();
    if (id) {
      const restaurant = restaurants.find((r) => r.id === id);
      if (!restaurant) return jsonResponse({ message: "Not found" }, 404);
      const own = sortVisits(visits.filter((v) => v.restaurant_id === id));
      return jsonResponse({ ...withRating(restaurant, own), visits: own });
    }
    return jsonResponse(
      restaurants.map((r) => withRating(r, visits.filter((v) => v.restaurant_id === r.id)))
    );
  }

  const supabase = await createClient();
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  if (id) {
    const { data, error } = await supabase
      .from("restaurants")
      .select("*, restaurant_visits(*)")
      .eq("id", id)
      .eq("user_id", user!.id)
      .maybeSingle();

    if (error) return jsonResponse({ message: error.message }, 500);
    if (!data) return jsonResponse({ message: "Not found" }, 404);

    const visits = sortVisits((data.restaurant_visits ?? []) as RestaurantVisit[]);
    return jsonResponse({ ...fromRow(data as Row), visits });
  }

  const { data, error } = await supabase
    .from("restaurants")
    .select("*, restaurant_visits(rating)")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  if (error) return jsonResponse({ message: error.message }, 500);

  return jsonResponse(((data || []) as Row[]).map(fromRow));
}

// POST /api/restaurants
// Body: RestaurantInput (name required)
export async function POST(request: Request) {
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const parsed = parseRestaurant(await request.json(), false);
  if (!parsed.ok) return jsonResponse({ message: parsed.error }, 400);
  const input = parsed.data as RestaurantInput;

  if (isLocalMode) {
    const store = await readLocal();
    const restaurant = { ...input, id: crypto.randomUUID(), created_at: new Date().toISOString() };
    store.restaurants.unshift(restaurant);
    await writeLocal(store);
    return jsonResponse(withRating(restaurant, []), 201);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("restaurants")
    .insert({ ...input, user_id: user!.id })
    .select("*")
    .single();

  if (error) return jsonResponse({ message: error.message }, 500);

  return jsonResponse(withRating(data, []), 201);
}

// PUT /api/restaurants?id=xxx
// Body: Partial<RestaurantInput>
export async function PUT(request: Request) {
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return jsonResponse({ message: "Missing id" }, 400);

  const parsed = parseRestaurant(await request.json(), true);
  if (!parsed.ok) return jsonResponse({ message: parsed.error }, 400);
  const update = parsed.data;
  if (Object.keys(update).length === 0) {
    return jsonResponse({ message: "No valid fields to update" }, 400);
  }

  if (isLocalMode) {
    const store = await readLocal();
    const restaurant = store.restaurants.find((r) => r.id === id);
    if (!restaurant) return jsonResponse({ message: "Not found" }, 404);
    Object.assign(restaurant, update);
    await writeLocal(store);
    return jsonResponse(
      withRating(restaurant, store.visits.filter((v) => v.restaurant_id === id))
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("restaurants")
    .update(update)
    .eq("id", id)
    .eq("user_id", user!.id)
    .select("*, restaurant_visits(rating)")
    .maybeSingle();

  if (error) return jsonResponse({ message: error.message }, 500);
  if (!data) return jsonResponse({ message: "Not found" }, 404);

  return jsonResponse(fromRow(data as Row));
}

// DELETE /api/restaurants?id=xxx — also deletes its visits
export async function DELETE(request: Request) {
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return jsonResponse({ message: "Missing id" }, 400);

  if (isLocalMode) {
    const store = await readLocal();
    store.restaurants = store.restaurants.filter((r) => r.id !== id);
    store.visits = store.visits.filter((v) => v.restaurant_id !== id);
    await writeLocal(store);
    return new NextResponse(null, { status: 204 });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("restaurants")
    .delete()
    .eq("id", id)
    .eq("user_id", user!.id);

  if (error) return jsonResponse({ message: error.message }, 500);

  return new NextResponse(null, { status: 204 });
}

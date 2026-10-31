import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isLocalMode } from "@/lib/local";
import { parseVisit, readLocal, writeLocal } from "@/lib/restaurants";

// Visits / check-ins for a restaurant. A restaurant's rating is the average
// of its visits' ratings (see withRating in src/lib/restaurants.ts).

const jsonResponse = (data: unknown, status = 200) =>
  NextResponse.json(data, { status });

// POST /api/restaurants/visits?restaurant_id=xxx
// Body: { visited_on: "YYYY-MM-DD", rating?: 1–10, rated_by?: string, note?: string }
export async function POST(request: Request) {
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const restaurantId = new URL(request.url).searchParams.get("restaurant_id");
  if (!restaurantId) return jsonResponse({ message: "Missing restaurant_id" }, 400);

  const parsed = parseVisit(await request.json());
  if (!parsed.ok) return jsonResponse({ message: parsed.error }, 400);

  if (isLocalMode) {
    const store = await readLocal();
    if (!store.restaurants.some((r) => r.id === restaurantId)) {
      return jsonResponse({ message: "Not found" }, 404);
    }
    const visit = {
      ...parsed.data,
      id: crypto.randomUUID(),
      restaurant_id: restaurantId,
      created_at: new Date().toISOString(),
    };
    store.visits.push(visit);
    await writeLocal(store);
    return jsonResponse(visit, 201);
  }

  // The insert policy also checks the restaurant belongs to this user.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("restaurant_visits")
    .insert({ ...parsed.data, restaurant_id: restaurantId, user_id: user!.id })
    .select("*")
    .single();

  if (error) return jsonResponse({ message: error.message }, 500);

  return jsonResponse(data, 201);
}

// DELETE /api/restaurants/visits?id=xxx
export async function DELETE(request: Request) {
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return jsonResponse({ message: "Missing id" }, 400);

  if (isLocalMode) {
    const store = await readLocal();
    store.visits = store.visits.filter((v) => v.id !== id);
    await writeLocal(store);
    return new NextResponse(null, { status: 204 });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("restaurant_visits")
    .delete()
    .eq("id", id)
    .eq("user_id", user!.id);

  if (error) return jsonResponse({ message: error.message }, 500);

  return new NextResponse(null, { status: 204 });
}

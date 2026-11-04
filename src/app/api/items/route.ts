import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isLocalMode, localStore } from "@/lib/local";
import { ITEM_CATEGORIES, ITEM_STATUSES, type ItemCategory, type ItemStatus } from "@/api/client";
import { isValidTime, normalizeTime } from "@/config/familyCalendar";
import { isRealDate } from "@/lib/recordStore";

const isCategory = (value: unknown): value is ItemCategory =>
  ITEM_CATEGORIES.includes(value as ItemCategory);

const isStatus = (value: unknown): value is ItemStatus =>
  ITEM_STATUSES.includes(value as ItemStatus);

// Sample resource. Row-level security on `items` (supabase/schema.sql) limits
// every query to the signed-in user's rows; the user_id filters below are
// belt-and-braces.

const jsonResponse = (data: unknown, status = 200) =>
  NextResponse.json(data, { status });

// GET /api/items[?category=xxx] — the current user's items in priority order,
// optionally limited to one category
export async function GET(request: Request) {
  const category = new URL(request.url).searchParams.get("category");
  if (category !== null && !isCategory(category)) {
    return jsonResponse({ message: "Invalid category" }, 400);
  }
  if (isLocalMode) {
    const items = category
      ? localStore.items.filter((i) => i.category === category)
      : localStore.items;
    return jsonResponse([...items].sort((a, b) => a.sort_order - b.sort_order));
  }

  const supabase = await createClient();
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  let query = supabase.from("items").select("*").eq("user_id", user!.id);
  if (category) query = query.eq("category", category);
  const { data, error } = await query.order("sort_order");

  if (error) return jsonResponse({ message: error.message }, 500);

  return jsonResponse(data || []);
}

// POST /api/items
// Body: { title: string, category: ItemCategory }
export async function POST(request: Request) {
  const supabase = await createClient();
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { title, category } = await request.json();
  if (typeof title !== "string" || !title.trim()) {
    return jsonResponse({ message: "Title is required" }, 400);
  }
  if (!isCategory(category)) {
    return jsonResponse({ message: "Invalid category" }, 400);
  }

  if (isLocalMode) {
    const item = {
      id: crypto.randomUUID(),
      title: title.trim(),
      category,
      done: false,
      status: "not_started" as const,
      notes: null,
      scheduled_on: null,
      scheduled_time: null,
      created_at: new Date().toISOString(),
      completed_at: null,
      sort_order: Math.max(0, ...localStore.items.map((i) => i.sort_order)) + 1,
    };
    localStore.items.push(item);
    return jsonResponse(item, 201);
  }

  const { data, error } = await supabase
    .from("items")
    .insert({ user_id: user!.id, title: title.trim(), category })
    .select("*")
    .single();

  if (error) return jsonResponse({ message: error.message }, 500);

  return jsonResponse(data, 201);
}

// PUT /api/items?id=xxx
// Body: { title?: string, done?: boolean, status?: ItemStatus, notes?: string | null,
//         scheduled_on?: string | null, scheduled_time?: string | null }
// scheduled_time is read along with scheduled_on, since a time needs a date.
export async function PUT(request: Request) {
  const supabase = await createClient();
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return jsonResponse({ message: "Missing id" }, 400);

  const payload = await request.json();
  const update: Record<string, unknown> = {};
  if (typeof payload.title === "string" && payload.title.trim()) {
    update.title = payload.title.trim();
  }
  if (typeof payload.done === "boolean") {
    update.done = payload.done;
    update.completed_at = payload.done ? new Date().toISOString() : null;
  }
  if (isStatus(payload.status)) {
    update.status = payload.status;
  }
  if (payload.notes === null || typeof payload.notes === "string") {
    const notes = payload.notes?.trim() || null;
    if (notes && notes.length > 5000) {
      return jsonResponse({ message: "Notes can be at most 5000 characters" }, 400);
    }
    update.notes = notes;
  }
  if ("scheduled_on" in payload) {
    const date = payload.scheduled_on || null;
    const time = (date && payload.scheduled_time) || null;
    if (date && !isRealDate(date)) return jsonResponse({ message: "Invalid date" }, 400);
    if (time && !isValidTime(normalizeTime(String(time)))) {
      return jsonResponse({ message: "Invalid time" }, 400);
    }
    update.scheduled_on = date;
    update.scheduled_time = time && normalizeTime(String(time));
  }
  if (Object.keys(update).length === 0) {
    return jsonResponse({ message: "No valid fields to update" }, 400);
  }

  if (isLocalMode) {
    const item = localStore.items.find((i) => i.id === id);
    if (!item) return jsonResponse({ message: "Not found" }, 404);
    Object.assign(item, update);
    return jsonResponse(item);
  }

  const { data, error } = await supabase
    .from("items")
    .update(update)
    .eq("id", id)
    .eq("user_id", user!.id)
    .select("*")
    .maybeSingle();

  if (error) return jsonResponse({ message: error.message }, 500);
  if (!data) return jsonResponse({ message: "Not found" }, 404);

  return jsonResponse(data);
}

// DELETE /api/items?id=xxx
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return jsonResponse({ message: "Missing id" }, 400);

  if (isLocalMode) {
    localStore.items = localStore.items.filter((i) => i.id !== id);
    return new NextResponse(null, { status: 204 });
  }

  const { error } = await supabase
    .from("items")
    .delete()
    .eq("id", id)
    .eq("user_id", user!.id);

  if (error) return jsonResponse({ message: error.message }, 500);

  return new NextResponse(null, { status: 204 });
}

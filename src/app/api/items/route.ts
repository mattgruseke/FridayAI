import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isLocalMode, localStore } from "@/lib/local";
import { loadLocalTasks, saveLocalTasks } from "@/lib/localTasks";
import { removeLinksFor } from "@/lib/listRecords";
import { providerExists } from "@/lib/homeRecords";
import { createTask } from "@/lib/taskStore";
import { ITEM_BOXES, ITEM_CATEGORIES, ITEM_STATUSES, type ItemBox, type ItemCategory, type ItemStatus } from "@/api/client";
import { isValidTime, normalizeTime } from "@/config/familyCalendar";
import { isRealDate } from "@/lib/recordStore";

const isCategory = (value: unknown): value is ItemCategory =>
  ITEM_CATEGORIES.includes(value as ItemCategory);

const isStatus = (value: unknown): value is ItemStatus =>
  ITEM_STATUSES.includes(value as ItemStatus);

const isBox = (value: unknown): value is ItemBox => ITEM_BOXES.includes(value as ItemBox);

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
    await loadLocalTasks();
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

  const { title, category, box = null } = await request.json();
  if (typeof title !== "string" || !title.trim()) {
    return jsonResponse({ message: "Title is required" }, 400);
  }
  if (!isCategory(category)) {
    return jsonResponse({ message: "Invalid category" }, 400);
  }
  if (box !== null && !isBox(box)) {
    return jsonResponse({ message: "Invalid box" }, 400);
  }

  try {
    return jsonResponse(await createTask(user!.id, { title: title.trim(), category, box, notes: null }), 201);
  } catch (err) {
    return jsonResponse({ message: (err as { message?: string })?.message || "Couldn't add the task" }, 500);
  }
}

// PUT /api/items?id=xxx
// Body: { title?: string, done?: boolean, status?: ItemStatus, notes?: string | null,
//         scheduled_on?: string | null, scheduled_time?: string | null,
//         provider_id?: string | null }
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
  if ("box" in payload) {
    if (payload.box !== null && !isBox(payload.box)) {
      return jsonResponse({ message: "Invalid box" }, 400);
    }
    update.box = payload.box;
  }
  if ("category" in payload) {
    if (!isCategory(payload.category)) return jsonResponse({ message: "Invalid category" }, 400);
    update.category = payload.category;
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
  if ("provider_id" in payload) {
    const providerId = payload.provider_id || null;
    if (providerId !== null && !(await providerExists(user!.id, providerId))) {
      return jsonResponse({ message: "Unknown service provider" }, 400);
    }
    update.provider_id = providerId;
  }
  if (Object.keys(update).length === 0) {
    return jsonResponse({ message: "No valid fields to update" }, 400);
  }

  if (isLocalMode) {
    await loadLocalTasks();
    const item = localStore.items.find((i) => i.id === id);
    if (!item) return jsonResponse({ message: "Not found" }, 404);
    Object.assign(item, update);
    await saveLocalTasks();
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

  await removeLinksFor(user!.id, "task", id);

  if (isLocalMode) {
    await loadLocalTasks();
    localStore.items = localStore.items.filter((i) => i.id !== id);
    await saveLocalTasks();
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

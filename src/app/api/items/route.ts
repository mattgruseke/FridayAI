import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isLocalMode, localStore } from "@/lib/local";
import { ITEM_CATEGORIES, type ItemCategory } from "@/api/client";

const isCategory = (value: unknown): value is ItemCategory =>
  ITEM_CATEGORIES.includes(value as ItemCategory);

// Sample resource. Row-level security on `items` (supabase/schema.sql) limits
// every query to the signed-in user's rows; the user_id filters below are
// belt-and-braces.

const jsonResponse = (data: unknown, status = 200) =>
  NextResponse.json(data, { status });

// GET /api/items[?category=xxx] — the current user's items, newest first,
// optionally limited to one category
export async function GET(request: Request) {
  const category = new URL(request.url).searchParams.get("category");
  if (category !== null && !isCategory(category)) {
    return jsonResponse({ message: "Invalid category" }, 400);
  }
  if (isLocalMode) {
    return jsonResponse(
      category ? localStore.items.filter((i) => i.category === category) : localStore.items
    );
  }

  const supabase = await createClient();
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  let query = supabase.from("items").select("*").eq("user_id", user!.id);
  if (category) query = query.eq("category", category);
  const { data, error } = await query.order("created_at", { ascending: false });

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
      created_at: new Date().toISOString(),
    };
    localStore.items.unshift(item);
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
// Body: { title?: string, done?: boolean }
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

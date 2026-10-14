import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Sample resource. Row-level security on `items` (supabase/schema.sql) limits
// every query to the signed-in user's rows; the user_id filters below are
// belt-and-braces.

const jsonResponse = (data: unknown, status = 200) =>
  NextResponse.json(data, { status });

// GET /api/items — the current user's items, newest first
export async function GET() {
  const supabase = await createClient();
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { data, error } = await supabase
    .from("items")
    .select("*")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  if (error) return jsonResponse({ message: error.message }, 500);

  return jsonResponse(data || []);
}

// POST /api/items
// Body: { title: string }
export async function POST(request: Request) {
  const supabase = await createClient();
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { title } = await request.json();
  if (typeof title !== "string" || !title.trim()) {
    return jsonResponse({ message: "Title is required" }, 400);
  }

  const { data, error } = await supabase
    .from("items")
    .insert({ user_id: user!.id, title: title.trim() })
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

  const { error } = await supabase
    .from("items")
    .delete()
    .eq("id", id)
    .eq("user_id", user!.id);

  if (error) return jsonResponse({ message: error.message }, 500);

  return new NextResponse(null, { status: 204 });
}

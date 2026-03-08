import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { mapUserList } from "@/lib/mappers";
import { userListToDb } from "@/lib/transformers";

const jsonResponse = (data: unknown, status = 200) =>
  NextResponse.json(data, { status });

export async function GET(request: Request) {
  const supabase = await createClient();
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (id) {
    const { data, error } = await supabase
      .from("user_lists")
      .select("*")
      .eq("id", id)
      .eq("user_id", user!.id)
      .maybeSingle();

    if (error || !data) {
      return jsonResponse({ message: "List not found" }, 404);
    }

    return jsonResponse(mapUserList(data));
  }

  const { data, error } = await supabase
    .from("user_lists")
    .select("*")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  if (error) {
    return jsonResponse({ message: error.message }, 500);
  }

  return jsonResponse((data || []).map(mapUserList));
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const payload = await request.json();
  const now = new Date().toISOString();

  const newList = {
    user_id: user!.id,
    ...userListToDb(payload),
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("user_lists")
    .insert(newList)
    .select("*")
    .single();

  if (error) {
    return jsonResponse({ message: error.message }, 500);
  }

  return jsonResponse(mapUserList(data), 201);
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return jsonResponse({ message: "List ID required" }, 400);
  }

  const { data: existing, error } = await supabase
    .from("user_lists")
    .select("*")
    .eq("id", id)
    .eq("user_id", user!.id)
    .maybeSingle();

  if (error || !existing) {
    return jsonResponse({ message: "List not found" }, 404);
  }

  const payload = await request.json();

  const { data, error: updateError } = await supabase
    .from("user_lists")
    .update({
      ...userListToDb(payload),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user!.id)
    .select("*")
    .single();

  if (updateError) {
    return jsonResponse({ message: updateError.message }, 500);
  }

  return jsonResponse(mapUserList(data));
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return jsonResponse({ message: "List ID required" }, 400);
  }

  const { error } = await supabase
    .from("user_lists")
    .delete()
    .eq("id", id)
    .eq("user_id", user!.id);

  if (error) {
    return jsonResponse({ message: "List not found" }, 404);
  }

  return new Response(null, { status: 204 });
}

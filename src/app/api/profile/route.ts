import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isLocalMode, localStore } from "@/lib/local";

const jsonResponse = (data: unknown, status = 200) =>
  NextResponse.json(data, { status });

// GET /api/profile — returns the current user's profile
export async function GET() {
  const supabase = await createClient();
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;
  if (isLocalMode) return jsonResponse(localStore.profile);

  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user!.id)
    .maybeSingle();

  if (error) {
    return jsonResponse({ message: error.message }, 500);
  }

  if (!data) {
    // Auto-create the profile row if it doesn't exist
    const { data: created, error: insertError } = await supabase
      .from("user_profiles")
      .insert({ id: user!.id })
      .select("*")
      .single();

    if (insertError) {
      return jsonResponse({ message: insertError.message }, 500);
    }

    return jsonResponse(created);
  }

  return jsonResponse(data);
}

// PATCH /api/profile
// Body: { full_name?: string } — whitelist any column you let users edit
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const payload = await request.json();
  const allowed: Record<string, unknown> = {};
  if (typeof payload.full_name === "string") {
    allowed.full_name = payload.full_name.trim();
  }

  if (Object.keys(allowed).length === 0) {
    return jsonResponse({ message: "No valid fields to update" }, 400);
  }

  if (isLocalMode) {
    Object.assign(localStore.profile, allowed);
    return jsonResponse({ ok: true });
  }

  const { error } = await supabase
    .from("user_profiles")
    .update(allowed)
    .eq("id", user!.id);

  if (error) return jsonResponse({ message: error.message }, 500);

  return jsonResponse({ ok: true });
}

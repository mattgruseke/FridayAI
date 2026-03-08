import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const jsonResponse = (data: unknown, status = 200) =>
  NextResponse.json(data, { status });

// GET /api/profile — returns the current user's profile
export async function GET() {
  const supabase = await createClient();
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

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

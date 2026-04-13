import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const jsonResponse = (data: unknown, status = 200) =>
  NextResponse.json(data, { status });

// POST /api/onboarding
// Body: { preferredRoles: string[], preferredCompensation?: string[], skip?: boolean }
export async function POST(request: Request) {
  const supabase = await createClient();
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const payload = await request.json();
  const { preferredRoles, preferredCompensation, skip } = payload;

  if (skip) {
    const { error } = await supabase
      .from("user_profiles")
      .update({ onboarding_skipped: true })
      .eq("id", user!.id);

    if (error) return jsonResponse({ message: error.message }, 500);
    return jsonResponse({ skipped: true });
  }

  if (!preferredRoles || preferredRoles.length === 0) {
    return jsonResponse({ message: "At least one role is required" }, 400);
  }

  const { error: profileError } = await supabase
    .from("user_profiles")
    .update({
      preferred_roles: preferredRoles,
      preferred_compensation: preferredCompensation || [],
      onboarding_completed: true,
    })
    .eq("id", user!.id);

  if (profileError) return jsonResponse({ message: profileError.message }, 500);

  return jsonResponse({ ok: true }, 200);
}

// PUT /api/onboarding
// Body: { preferredRoles: string[], preferredCompensation?: string[] } — saves preferences
export async function PUT(request: Request) {
  const supabase = await createClient();
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const payload = await request.json();
  const { preferredRoles, preferredCompensation } = payload;

  if (!preferredRoles || preferredRoles.length === 0) {
    return jsonResponse({ message: "At least one role is required" }, 400);
  }

  const update: Record<string, unknown> = { preferred_roles: preferredRoles };
  if (preferredCompensation !== undefined) {
    update.preferred_compensation = preferredCompensation;
  }

  const { error } = await supabase
    .from("user_profiles")
    .update(update)
    .eq("id", user!.id);

  if (error) return jsonResponse({ message: error.message }, 500);

  return jsonResponse({ saved: true });
}

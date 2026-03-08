import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { mapUserList } from "@/lib/mappers";

const jsonResponse = (data: unknown, status = 200) =>
  NextResponse.json(data, { status });

// POST /api/onboarding
// Body: { preferredRoles: string[], skip?: boolean }
// - If skip: true, marks onboarding_skipped = true
// - Otherwise: saves preferred_roles, queries matching leads, creates "Your First Leads" list, marks onboarding_completed = true
export async function POST(request: Request) {
  const supabase = await createClient();
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const payload = await request.json();
  const { preferredRoles, skip } = payload;

  if (skip) {
    const { error } = await supabase
      .from("user_profiles")
      .update({ onboarding_skipped: true })
      .eq("id", user!.id);

    if (error) {
      return jsonResponse({ message: error.message }, 500);
    }

    return jsonResponse({ skipped: true });
  }

  if (!preferredRoles || preferredRoles.length === 0) {
    return jsonResponse({ message: "At least one role is required" }, 400);
  }

  // Save preferred_roles and mark onboarding complete
  const { error: profileError } = await supabase
    .from("user_profiles")
    .update({
      preferred_roles: preferredRoles,
      onboarding_completed: true,
    })
    .eq("id", user!.id);

  if (profileError) {
    return jsonResponse({ message: profileError.message }, 500);
  }

  // Query leads matching any of the preferred roles (case-insensitive title match)
  const { data: matchingLeads, error: leadsError } = await supabase
    .from("leads")
    .select("id")
    .or(preferredRoles.map((role: string) => `title.ilike.%${role}%`).join(","));

  if (leadsError) {
    return jsonResponse({ message: leadsError.message }, 500);
  }

  const leadIds = (matchingLeads || []).map((l: { id: string }) => l.id);
  const now = new Date().toISOString();

  // Create "Your First Leads" list
  const { data: list, error: listError } = await supabase
    .from("user_lists")
    .insert({
      user_id: user!.id,
      name: "Your First List",
      description: `Leads matching: ${preferredRoles.join(", ")}`,
      lead_ids: leadIds,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (listError) {
    return jsonResponse({ message: listError.message }, 500);
  }

  return jsonResponse({ list: mapUserList(list), leadCount: leadIds.length }, 201);
}

// PUT /api/onboarding
// Body: { preferredRoles: string[] } — saves roles only, no list created
// PUT /api/onboarding?listId=xxx — re-runs query and updates list lead_ids
export async function PUT(request: Request) {
  const supabase = await createClient();
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(request.url);
  const listId = searchParams.get("listId");

  // Roles-only save (no listId)
  if (!listId) {
    const payload = await request.json();
    const { preferredRoles } = payload;

    if (!preferredRoles || preferredRoles.length === 0) {
      return jsonResponse({ message: "At least one role is required" }, 400);
    }

    const { error } = await supabase
      .from("user_profiles")
      .update({ preferred_roles: preferredRoles })
      .eq("id", user!.id);

    if (error) {
      return jsonResponse({ message: error.message }, 500);
    }

    return jsonResponse({ saved: true });
  }

  // Get user's preferred roles
  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("preferred_roles")
    .eq("id", user!.id)
    .single();

  if (profileError || !profile) {
    return jsonResponse({ message: "Profile not found" }, 404);
  }

  const preferredRoles: string[] = profile.preferred_roles || [];

  if (preferredRoles.length === 0) {
    return jsonResponse({ message: "No preferred roles set" }, 400);
  }

  // Re-query leads
  const { data: matchingLeads, error: leadsError } = await supabase
    .from("leads")
    .select("id")
    .or(preferredRoles.map((role: string) => `title.ilike.%${role}%`).join(","));

  if (leadsError) {
    return jsonResponse({ message: leadsError.message }, 500);
  }

  const leadIds = (matchingLeads || []).map((l: { id: string }) => l.id);

  // Update the list
  const { data, error: updateError } = await supabase
    .from("user_lists")
    .update({
      lead_ids: leadIds,
      updated_at: new Date().toISOString(),
    })
    .eq("id", listId)
    .eq("user_id", user!.id)
    .select("*")
    .single();

  if (updateError) {
    return jsonResponse({ message: updateError.message }, 500);
  }

  return jsonResponse({ list: mapUserList(data), leadCount: leadIds.length });
}

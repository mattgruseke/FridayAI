import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { mapReferral } from "@/lib/mappers";
import { referralToDb } from "@/lib/transformers";

const jsonResponse = (data: unknown, status = 200) =>
  NextResponse.json(data, { status });

const stripUndefined = (value: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined)
  );

export async function GET(request: Request) {
  const supabase = await createClient();
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const activity = searchParams.get("activity");

  if (activity === "true" && id) {
    const { data, error } = await supabase
      .from("referrals")
      .select("activity_history")
      .eq("id", id)
      .eq("user_id", user!.id)
      .maybeSingle();

    if (error || !data) {
      return jsonResponse({ message: "Referral not found" }, 404);
    }

    return jsonResponse((data.activity_history as unknown[]) || []);
  }

  if (id) {
    const { data, error } = await supabase
      .from("referrals")
      .select("*")
      .eq("id", id)
      .eq("user_id", user!.id)
      .maybeSingle();

    if (error || !data) {
      return jsonResponse({ message: "Referral not found" }, 404);
    }

    return jsonResponse(mapReferral(data));
  }

  const { data, error } = await supabase
    .from("referrals")
    .select("*")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  if (error) {
    return jsonResponse({ message: error.message }, 500);
  }

  return jsonResponse((data || []).map(mapReferral));
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const payload = await request.json();
  const now = new Date().toISOString();

  const newReferral = {
    user_id: user!.id,
    ...referralToDb(payload),
    company: payload.company || "",
    email: payload.email || "",
    linkedin: payload.linkedin || "",
    notes: payload.notes || "",
    linked_leads: payload.linkedLeads || payload.linked_leads || [],
    activity_history: [
      {
        createdAt: now,
        action: "created",
        description: "Referral created",
      },
    ],
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("referrals")
    .insert(newReferral)
    .select("*")
    .single();

  if (error) {
    return jsonResponse({ message: error.message }, 500);
  }

  return jsonResponse(mapReferral(data), 201);
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return jsonResponse({ message: "Referral ID required" }, 400);
  }

  const { data: existing, error } = await supabase
    .from("referrals")
    .select("*")
    .eq("id", id)
    .eq("user_id", user!.id)
    .maybeSingle();

  if (error || !existing) {
    return jsonResponse({ message: "Referral not found" }, 404);
  }

  const payload = await request.json();
  let activityDescription = "Referral updated";

  if (payload.notes && payload.notes !== existing.notes) {
    activityDescription = "Notes updated";
  } else if (
    payload.linkedLeads &&
    payload.linkedLeads.length !== (existing.linked_leads?.length || 0)
  ) {
    activityDescription =
      payload.linkedLeads.length > (existing.linked_leads?.length || 0)
        ? "Lead linked"
        : "Lead unlinked";
  }

  const activityHistory = [
    ...(existing.activity_history || []),
    {
      createdAt: new Date().toISOString(),
      action: "updated",
      description: activityDescription,
    },
  ];

  const updateData = {
    ...stripUndefined(referralToDb(payload)),
    activity_history: activityHistory,
    updated_at: new Date().toISOString(),
  };

  const { data, error: updateError } = await supabase
    .from("referrals")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", user!.id)
    .select("*")
    .single();

  if (updateError) {
    return jsonResponse({ message: updateError.message }, 500);
  }

  return jsonResponse(mapReferral(data));
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return jsonResponse({ message: "Referral ID required" }, 400);
  }

  const { error } = await supabase
    .from("referrals")
    .delete()
    .eq("id", id)
    .eq("user_id", user!.id);

  if (error) {
    return jsonResponse({ message: "Referral not found" }, 404);
  }

  return new Response(null, { status: 204 });
}

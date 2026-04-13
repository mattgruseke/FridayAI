import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const jsonResponse = (data: unknown, status = 200) =>
  NextResponse.json(data, { status });

// GET /api/notifications — fetch all incomplete notifications for the user
export async function GET() {
  const supabase = await createClient();
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user!.id)
    .eq("is_completed", false)
    .order("created_at", { ascending: true });

  if (error) return jsonResponse({ error: error.message }, 500);

  return jsonResponse(data || []);
}

// PUT /api/notifications?id=xxx — dismiss or complete a notification
// Body: { action: 'dismiss' | 'complete' }
export async function PUT(request: Request) {
  const supabase = await createClient();
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const { action } = await request.json();

  if (!id) return jsonResponse({ error: "Missing id" }, 400);
  if (action !== "dismiss" && action !== "complete")
    return jsonResponse({ error: "Invalid action" }, 400);

  const update =
    action === "complete"
      ? { is_completed: true }
      : { is_dismissed: true, dismissed_at: new Date().toISOString() };

  const { error } = await supabase
    .from("notifications")
    .update(update)
    .eq("id", id)
    .eq("user_id", user!.id);

  if (error) return jsonResponse({ error: error.message }, 500);

  return jsonResponse({ ok: true });
}

// PUT /api/notifications?type=xxx&action=complete — complete by type (e.g. after linkedin upload)
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { type } = await request.json();
  if (!type) return jsonResponse({ error: "Missing type" }, 400);

  const { error } = await supabase
    .from("notifications")
    .update({ is_completed: true })
    .eq("user_id", user!.id)
    .eq("type", type);

  if (error) return jsonResponse({ error: error.message }, 500);

  return jsonResponse({ ok: true });
}

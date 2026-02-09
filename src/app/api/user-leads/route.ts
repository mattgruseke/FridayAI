import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { mapLead, mapUserLead } from "@/lib/mappers";
import { userLeadUpdateToDb } from "@/lib/transformers";

const jsonResponse = (data: unknown, status = 200) =>
  NextResponse.json(data, { status });

const stripUndefined = (value: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined)
  );

const withLeadMapping = (row: Record<string, unknown> | null) => {
  if (!row) return row;
  const lead = row.lead as Record<string, unknown> | undefined;
  const { lead: _ignored, ...rest } = row;
  return {
    ...mapUserLead(rest),
    leadId: lead ? mapLead(lead) : null,
  };
};

export async function GET(request: Request) {
  const supabase = await createClient();
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const leadId = searchParams.get("leadId");
  const activity = searchParams.get("activity");

  if (leadId) {
    const { data, error } = await supabase
      .from("user_leads")
      .select("*")
      .eq("lead_id", leadId)
      .eq("user_id", user!.id)
      .maybeSingle();

    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }

    return jsonResponse(mapUserLead(data));
  }

  if (activity === "true" && id) {
    const { data, error } = await supabase
      .from("user_leads")
      .select("status_history")
      .eq("id", id)
      .eq("user_id", user!.id)
      .maybeSingle();

    if (error || !data) {
      return jsonResponse({ error: "Lead not found" }, 404);
    }

    const history = (data.status_history as Array<Record<string, string>>) || [];
    const activityData = history.map((item) => ({
      createdAt: item.timestamp,
      action: "status_change",
      description: item.note || `Status changed to ${item.status}`,
    }));

    return jsonResponse(activityData);
  }

  if (id) {
    const { data, error } = await supabase
      .from("user_leads")
      .select("*, lead:lead_id(*)")
      .eq("id", id)
      .eq("user_id", user!.id)
      .maybeSingle();

    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }

    return jsonResponse(withLeadMapping(data));
  }

  const { data, error } = await supabase
    .from("user_leads")
    .select("*, lead:lead_id(*)")
    .eq("user_id", user!.id);

  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }

  const mapped = (data || []).map(withLeadMapping);
  return jsonResponse(mapped);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const payload = await request.json();

  const { data: existing } = await supabase
    .from("user_leads")
    .select("id")
    .eq("user_id", user!.id)
    .eq("lead_id", payload.leadId)
    .maybeSingle();

  if (existing) {
    return jsonResponse({ error: "Lead already saved" }, 400);
  }

  const status = payload.status || payload.currentStatus || "saved";
  const now = new Date().toISOString();

  const userLeadDoc = {
    user_id: user!.id,
    lead_id: payload.leadId,
    current_status: status,
    status_history: [
      {
        status,
        timestamp: now,
        note: "Lead saved to pipeline",
      },
    ],
    priority: payload.priority || "medium",
    notes: payload.notes || "",
    saved_at: now,
    last_activity_at: now,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("user_leads")
    .insert(userLeadDoc)
    .select("*")
    .single();

  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }

  return jsonResponse(mapUserLead(data), 201);
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return jsonResponse({ error: "Missing ID" }, 400);
  }

  const { data: existing, error } = await supabase
    .from("user_leads")
    .select("*")
    .eq("id", id)
    .eq("user_id", user!.id)
    .maybeSingle();

  if (error || !existing) {
    return jsonResponse({ error: "Lead not found" }, 404);
  }

  const payload = await request.json();

  if (payload.status) {
    const now = new Date().toISOString();
    const history = (existing.status_history as Array<Record<string, string>>) || [];

    const updateDoc: Record<string, unknown> = {
      current_status: payload.status,
      updated_at: now,
      last_activity_at: now,
      status_history: [
        ...history,
        {
          status: payload.status,
          timestamp: now,
          note: payload.note || `Status changed to ${payload.status}`,
        },
      ],
    };

    if (payload.status === "contacted" && !existing.contacted_at) {
      updateDoc.contacted_at = now;
    } else if (payload.status === "applied" && !existing.applied_at) {
      updateDoc.applied_at = now;
    } else if (payload.status === "interviewing" && !existing.interviewing_at) {
      updateDoc.interviewing_at = now;
    } else if (payload.status === "offer" && !existing.offer_at) {
      updateDoc.offer_at = now;
    } else if (payload.status === "offer_accepted" && !existing.offer_accepted_at) {
      updateDoc.offer_accepted_at = now;
    }

    const { data, error: updateError } = await supabase
      .from("user_leads")
      .update(updateDoc)
      .eq("id", id)
      .eq("user_id", user!.id)
      .select("*")
      .single();

    if (updateError) {
      return jsonResponse({ error: updateError.message }, 500);
    }

    return jsonResponse(mapUserLead(data));
  }

  const updateData = stripUndefined(userLeadUpdateToDb(payload));
  updateData.updated_at = new Date().toISOString();

  const { data, error: updateError } = await supabase
    .from("user_leads")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", user!.id)
    .select("*")
    .single();

  if (updateError) {
    return jsonResponse({ error: updateError.message }, 500);
  }

  return jsonResponse(mapUserLead(data));
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return jsonResponse({ error: "Missing ID" }, 400);
  }

  const { data: existing, error } = await supabase
    .from("user_leads")
    .select("id")
    .eq("id", id)
    .eq("user_id", user!.id)
    .maybeSingle();

  if (error || !existing) {
    return jsonResponse({ error: "Lead not found" }, 404);
  }

  const { error: deleteError } = await supabase
    .from("user_leads")
    .delete()
    .eq("id", id)
    .eq("user_id", user!.id);

  if (deleteError) {
    return jsonResponse({ error: deleteError.message }, 500);
  }

  return new Response(null, { status: 204 });
}

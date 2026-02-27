import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const jsonResponse = (data: unknown, status = 200) =>
  NextResponse.json(data, { status });

export async function POST(request: Request) {
  const supabase = await createClient();
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const payload = await request.json();
  const { mode, leadId } = payload;

  if (mode === "single" && leadId) {
    const { data: userLead } = await supabase
      .from("user_leads")
      .select("id, compensation")
      .eq("lead_id", leadId)
      .eq("user_id", user!.id)
      .maybeSingle();

    if (!userLead) {
      return jsonResponse({ error: "Lead not found in your pipeline" }, 404);
    }

    const { data: lead } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .maybeSingle();

    if (!lead) {
      return jsonResponse({ error: "Lead not found" }, 404);
    }

    if (!lead.is_global) {
      const now = new Date().toISOString();
      const publicLeadData: Record<string, unknown> = {
        is_global: true,
        created_by: "community",
        shared_by: user!.id,
        shared_at: now,
        updated_at: now,
      };

      // If job posting has no compensation, fall back to user's tracked compensation
      if (!lead.compensation?.raw && userLead.compensation?.raw) {
        publicLeadData.compensation = userLead.compensation;
      }

      await supabase.from("leads").update(publicLeadData).eq("id", leadId);
    }

    return jsonResponse({ message: "Lead published successfully", leadId });
  }

  if (mode === "all") {
    const { data: userLeads } = await supabase
      .from("user_leads")
      .select("lead_id, compensation")
      .eq("user_id", user!.id);

    if (!userLeads || userLeads.length === 0) {
      return jsonResponse({ message: "No leads to publish", count: 0 });
    }

    const leadIds = userLeads.map((item) => item.lead_id);

    // Build a map of lead_id -> user compensation for quick lookup
    const userLeadCompMap = new Map(
      userLeads.map((ul) => [ul.lead_id, ul.compensation])
    );

    const { data: leads } = await supabase
      .from("leads")
      .select("id, is_global, compensation")
      .in("id", leadIds)
      .neq("is_global", true);

    if (!leads || leads.length === 0) {
      return jsonResponse({ message: "All leads are already public", count: 0 });
    }

    const now = new Date().toISOString();

    for (const lead of leads) {
      const updatePayload: Record<string, unknown> = {
        is_global: true,
        created_by: "community",
        shared_by: user!.id,
        shared_at: now,
        updated_at: now,
      };

      // If job posting has no compensation, fall back to user's tracked compensation
      const userComp = userLeadCompMap.get(lead.id);
      if (!lead.compensation?.raw && userComp?.raw) {
        updatePayload.compensation = userComp;
      }

      await supabase.from("leads").update(updatePayload).eq("id", lead.id);
    }

    return jsonResponse({
      message: `${leads.length} lead(s) published successfully`,
      count: leads.length,
    });
  }

  return jsonResponse({ error: 'Invalid mode. Use "single" or "all"' }, 400);
}

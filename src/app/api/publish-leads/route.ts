import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const jsonResponse = (data: unknown, status = 200) =>
  NextResponse.json(data, { status });

export async function POST(request: Request) {
  const { user, errorResponse } = await requireUser(request);
  if (errorResponse) return errorResponse;

  const payload = await request.json();
  const { mode, leadId } = payload;

  if (mode === "single" && leadId) {
    const { data: userLead } = await supabaseAdmin
      .from("user_leads")
      .select("id")
      .eq("lead_id", leadId)
      .eq("user_id", user!.id)
      .maybeSingle();

    if (!userLead) {
      return jsonResponse({ error: "Lead not found in your pipeline" }, 404);
    }

    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .maybeSingle();

    if (!lead) {
      return jsonResponse({ error: "Lead not found" }, 404);
    }

    if (!lead.is_global) {
      const now = new Date().toISOString();
      const publicLeadData = {
        is_global: true,
        created_by: "community",
        shared_by: user!.id,
        shared_at: now,
        updated_at: now,
        contact_name: null,
        contact_email: null,
        additional_emails: [],
        contact_linkedin: null,
        additional_links: null,
      };

      await supabaseAdmin.from("leads").update(publicLeadData).eq("id", leadId);
    }

    return jsonResponse({ message: "Lead published successfully", leadId });
  }

  if (mode === "all") {
    const { data: userLeads } = await supabaseAdmin
      .from("user_leads")
      .select("lead_id")
      .eq("user_id", user!.id);

    if (!userLeads || userLeads.length === 0) {
      return jsonResponse({ message: "No leads to publish", count: 0 });
    }

    const leadIds = userLeads.map((item) => item.lead_id);

    const { data: leads } = await supabaseAdmin
      .from("leads")
      .select("id, is_global")
      .in("id", leadIds)
      .neq("is_global", true);

    if (!leads || leads.length === 0) {
      return jsonResponse({ message: "All leads are already public", count: 0 });
    }

    const now = new Date().toISOString();

    for (const lead of leads) {
      await supabaseAdmin
        .from("leads")
        .update({
          is_global: true,
          created_by: "community",
          shared_by: user!.id,
          shared_at: now,
          updated_at: now,
          contact_name: null,
          contact_email: null,
          additional_emails: [],
          contact_linkedin: null,
          additional_links: null,
        })
        .eq("id", lead.id);
    }

    return jsonResponse({
      message: `${leads.length} lead(s) published successfully`,
      count: leads.length,
    });
  }

  return jsonResponse({ error: 'Invalid mode. Use "single" or "all"' }, 400);
}

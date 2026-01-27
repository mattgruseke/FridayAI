import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { mapLead, mapUserLead, mapReferral } from "@/lib/mappers";

const jsonResponse = (data: unknown, status = 200) =>
  NextResponse.json(data, { status });

export async function GET(request: Request) {
  const { user, errorResponse } = await requireUser(request);
  if (errorResponse) return errorResponse;

  const { data: userLeads, error } = await supabaseAdmin
    .from("user_leads")
    .select("*, lead:lead_id(*)")
    .eq("user_id", user!.id);

  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }

  const { data: referrals } = await supabaseAdmin
    .from("referrals")
    .select("*")
    .eq("user_id", user!.id);

  const referralList = (referrals || [])
    .map(mapReferral)
    .filter(
      (
        referral
      ): referral is NonNullable<ReturnType<typeof mapReferral>> =>
        referral !== null && typeof referral === "object"
    );

  const leads = (userLeads || []).map((row) => {
    const leadDetails = row.lead ? mapLead(row.lead) : null;
    const userLead = mapUserLead(row);

    const referral =
      referralList.find((referralItem) => {
        const linkedLeads = Array.isArray(referralItem.linkedLeads)
          ? referralItem.linkedLeads
          : [];
        return linkedLeads.includes(userLead?._id);
      }) || null;

    return {
      userLead,
      leadDetails,
      referral,
    };
  });

  const grouped = leads.reduce<Record<string, { _id: string; count: number; leads: unknown[] }>>(
    (acc, item) => {
      const status =
        (item.userLead as Record<string, string>)?.currentStatus || "saved";
      if (!acc[status]) {
        acc[status] = { _id: status, count: 0, leads: [] };
      }
      acc[status].count += 1;
      acc[status].leads.push(item);
      return acc;
    },
    {}
  );

  return jsonResponse(Object.values(grouped));
}

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { mapLead, mapUserLead, mapReferral } from "@/lib/mappers";

function normalizeCompany(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(inc\.?|llc\.?|ltd\.?|corp\.?|co\.?|group|holdings|international)\b/gi, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const jsonResponse = (data: unknown, status = 200) =>
  NextResponse.json(data, { status });

export async function GET() {
  const supabase = await createClient();
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { data: userLeads, error } = await supabase
    .from("user_leads")
    .select("*, lead:lead_id(*)")
    .eq("user_id", user!.id);

  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }

  const { data: referrals } = await supabase
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

  const { data: networkMatches } = await supabase
    .from("network_lead_matches")
    .select("lead_id, connection_count, connection_names, connection_urls")
    .eq("user_id", user!.id);

  const networkMatchMap = new Map(
    (networkMatches || []).map((m) => [m.lead_id, { connectionCount: m.connection_count, connectionNames: m.connection_names || [], connectionUrls: m.connection_urls || [] }])
  );

  // For leads with no pre-computed match, fall back to company-based lookup
  const unmatchedLeads = (userLeads || []).filter((row) => row.lead && !networkMatchMap.has(row.lead.id));
  const unmatchedCompanies = [...new Set(unmatchedLeads.map((row) => row.lead?.company ? normalizeCompany(row.lead.company) : null).filter(Boolean))] as string[];

  const companyConnectionMap = new Map<string, { connectionCount: number; connectionNames: string[]; connectionUrls: string[] }>();
  if (unmatchedCompanies.length > 0) {
    const { data: connRows } = await supabase
      .from("linkedin_connections")
      .select("first_name, last_name, position, linkedin_url, company_normalized")
      .eq("user_id", user!.id)
      .in("company_normalized", unmatchedCompanies);

    if (connRows) {
      for (const c of connRows) {
        const key = c.company_normalized;
        if (!key) continue;
        const name = [[c.first_name, c.last_name].filter(Boolean).join(" "), c.position ? `(${c.position})` : ""].filter(Boolean).join(" ");
        if (!companyConnectionMap.has(key)) {
          companyConnectionMap.set(key, { connectionCount: 0, connectionNames: [], connectionUrls: [] });
        }
        const entry = companyConnectionMap.get(key)!;
        entry.connectionCount += 1;
        entry.connectionNames.push(name);
        entry.connectionUrls.push(c.linkedin_url || "");
      }
    }
  }

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

    let networkConnections = leadDetails?._id ? (networkMatchMap.get(leadDetails._id) || null) : null;
    if (!networkConnections && row.lead?.company) {
      networkConnections = companyConnectionMap.get(normalizeCompany(row.lead.company)) || null;
    }

    return {
      userLead,
      leadDetails,
      referral,
      networkConnections,
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

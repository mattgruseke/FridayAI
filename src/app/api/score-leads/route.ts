import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  scoreLead,
  buildDistribution,
  type LeadForScoring,
  type ScoringContext,
} from "@/lib/scoring";

const jsonResponse = (data: unknown, status = 200) =>
  NextResponse.json(data, { status });

// GET /api/score-leads
// Computes match scores for all available leads against the user's profile.
// Returns:
//   distribution  — ScoreBucket[] for the bell curve chart
//   scoredLeads   — { id: string, score: number }[] for client-side filtering
//   hasConnections — whether the user has uploaded LinkedIn connections
export async function GET() {
  const supabase = await createClient();
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const userId = user!.id;

  // Fetch all data in parallel
  const [
    profileResult,
    leadsResult,
    networkMatchesResult,
    referralsResult,
  ] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("preferred_roles, preferred_compensation")
      .eq("id", userId)
      .maybeSingle(),

    supabase
      .from("leads")
      .select("id, title, company, location, compensation, date_posted, created_at")
      .or(`is_global.eq.true,created_by.eq.system,created_by.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(2000),

    supabase
      .from("network_lead_matches")
      .select("lead_id, connection_count")
      .eq("user_id", userId),

    supabase
      .from("referrals")
      .select("company")
      .eq("user_id", userId),
  ]);

  if (profileResult.error) {
    return jsonResponse({ error: "Failed to load profile" }, 500);
  }
  if (leadsResult.error) {
    return jsonResponse({ error: "Failed to load leads" }, 500);
  }

  const profile = profileResult.data;
  const leads: LeadForScoring[] = (leadsResult.data || []).map((row) => ({
    id: row.id,
    title: row.title,
    company: row.company,
    location: row.location,
    compensation: row.compensation as { min?: number; max?: number; raw?: string } | null,
    datePosted: row.date_posted,
    createdAt: row.created_at,
  }));

  // Build network match map: leadId → connection_count
  const networkMatchMap = new Map<string, number>();
  for (const match of networkMatchesResult.data || []) {
    if (match.lead_id && match.connection_count > 0) {
      networkMatchMap.set(match.lead_id, match.connection_count);
    }
  }

  // Build referral company set (normalized)
  const referralCompanies = new Set<string>();
  for (const ref of referralsResult.data || []) {
    if (ref.company) {
      const normalized = ref.company
        .toLowerCase()
        .replace(/\b(inc\.?|llc\.?|ltd\.?|corp\.?|co\.?|group|holdings|international)\b/gi, "")
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
      referralCompanies.add(normalized);
    }
  }

  const ctx: ScoringContext = {
    preferredRoles: (profile?.preferred_roles as string[]) ?? [],
    preferredCompensation: (profile?.preferred_compensation as string[]) ?? [],
    networkMatchMap,
    referralCompanies,
  };

  const scoredLeads = leads.map((lead) => ({
    id: lead.id,
    score: scoreLead(lead, ctx),
  }));

  const distribution = buildDistribution(scoredLeads.map((l) => l.score));

  const matchedLeadIds = Array.from(networkMatchMap.keys());

  return jsonResponse({
    distribution,
    scoredLeads,
    hasConnections: networkMatchMap.size > 0,
    matchedLeadIds,
    totalLeads: leads.length,
  });
}

// Scoring utility — computes a 0–100 match score for a lead against a user's preferences.
// Used by the /api/score-leads route. Weights sum to 100.

export type LeadForScoring = {
  id: string;
  title?: string | null;
  company?: string | null;
  location?: string | null;
  compensation?: { min?: number | null; max?: number | null; raw?: string | null } | null;
  datePosted?: string | null;
  createdAt?: string | null;
};

export type ScoringContext = {
  preferredRoles: string[];         // e.g. ["Solutions Engineer", "Remote", "Hybrid"]
  preferredCompensation: string[];  // e.g. ["$101k – $150k", "$151k – $200k"]
  networkMatchMap: Map<string, number>; // leadId → connection_count
  referralCompanies: Set<string>;       // normalized company names with referrals
};

// Parses "$101k – $150k" → { min: 101000, max: 150000 }
function parseCompRange(label: string): { min: number; max: number } | null {
  const match = label.match(/\$(\d+)k[^$]*\$(\d+)k/i);
  if (match) return { min: parseInt(match[1]) * 1000, max: parseInt(match[2]) * 1000 };
  // "$201k+" style
  const openMatch = label.match(/\$(\d+)k\+/i);
  if (openMatch) return { min: parseInt(openMatch[1]) * 1000, max: Infinity };
  return null;
}

function normalizeCompany(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(inc\.?|llc\.?|ltd\.?|corp\.?|co\.?|group|holdings|international)\b/gi, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function scoreLead(lead: LeadForScoring, ctx: ScoringContext): number {
  let score = 0;

  const LOCATION_KEYS = new Set(["Remote", "Hybrid", "Onsite"]);
  const rolePrefs = ctx.preferredRoles.filter((r) => !LOCATION_KEYS.has(r));
  const locationPrefs = ctx.preferredRoles.filter((r) => LOCATION_KEYS.has(r));

  // ── Role match (0–40) ────────────────────────────────────────────────────
  if (rolePrefs.length === 0) {
    score += 20; // no prefs set, give partial credit
  } else if (lead.title) {
    const titleLower = lead.title.toLowerCase();
    const matched = rolePrefs.some((r) => titleLower.includes(r.toLowerCase()));
    if (matched) score += 40;
  }

  // ── Comp match (0–15) ────────────────────────────────────────────────────
  if (ctx.preferredCompensation.length === 0) {
    score += 8; // no comp prefs, give partial
  } else {
    const comp = lead.compensation;
    const leadMin = comp?.min;
    const leadMax = comp?.max;
    if (typeof leadMin === "number" && typeof leadMax === "number") {
      const prefRanges = ctx.preferredCompensation.map(parseCompRange).filter(Boolean);
      const overlaps = prefRanges.some((range) => {
        if (!range) return false;
        return leadMax >= range.min && leadMin <= range.max;
      });
      if (overlaps) score += 15;
    } else {
      // No numeric comp data — give partial credit
      score += 5;
    }
  }

  // ── Location match (0–10) ────────────────────────────────────────────────
  if (locationPrefs.length === 0) {
    score += 5; // no location prefs
  } else if (lead.location) {
    const locLower = lead.location.toLowerCase();
    const isRemote = locLower.includes("remote");
    const isHybrid = locLower.includes("hybrid");
    const isOnsite = !isRemote && !isHybrid;

    if (locationPrefs.includes("Remote") && isRemote) score += 10;
    else if (locationPrefs.includes("Hybrid") && isHybrid) score += 10;
    else if (locationPrefs.includes("Onsite") && isOnsite) score += 10;
    else score += 2; // location present but doesn't match preference
  }

  // ── Network overlap (0–25) ───────────────────────────────────────────────
  const connCount = ctx.networkMatchMap.get(lead.id) ?? 0;
  if (connCount >= 3) score += 25;
  else if (connCount === 2) score += 20;
  else if (connCount === 1) score += 12;

  // ── Referral at company (+8) ─────────────────────────────────────────────
  if (lead.company) {
    const normalized = normalizeCompany(lead.company);
    if (ctx.referralCompanies.has(normalized)) score += 8;
  }

  // ── Recency bonus (0–2) ──────────────────────────────────────────────────
  const dateStr = lead.datePosted ?? lead.createdAt;
  if (dateStr) {
    const daysSince =
      (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince <= 7) score += 2;
    else if (daysSince <= 14) score += 1;
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

export type ScoreBucket = {
  label: string;
  range: [number, number]; // inclusive min, exclusive max (except last)
  count: number;
  zone: "low" | "medium" | "high";
};

export const SCORE_BUCKETS: Omit<ScoreBucket, "count">[] = [
  { label: "0–19",  range: [0, 20],  zone: "low"    },
  { label: "20–39", range: [20, 40], zone: "low"    },
  { label: "40–59", range: [40, 60], zone: "medium" },
  { label: "60–79", range: [60, 80], zone: "medium" },
  { label: "80–100",range: [80, 101],zone: "high"   },
];

export function buildDistribution(scores: number[]): ScoreBucket[] {
  return SCORE_BUCKETS.map((bucket) => ({
    ...bucket,
    count: scores.filter((s) => s >= bucket.range[0] && s < bucket.range[1]).length,
  }));
}

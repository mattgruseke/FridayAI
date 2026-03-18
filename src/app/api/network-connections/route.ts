import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const jsonResponse = (data: unknown, status = 200) =>
  NextResponse.json(data, { status });

function normalizeCompany(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(inc\.?|llc\.?|ltd\.?|corp\.?|co\.?|group|holdings|international)\b/gi, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// GET /api/network-connections?leadId=xxx
export async function GET(request: Request) {
  const supabase = await createClient();
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(request.url);
  const leadId = searchParams.get("leadId");

  if (!leadId) {
    return jsonResponse({ error: "leadId is required" }, 400);
  }

  // First try pre-computed matches
  const { data: match } = await supabase
    .from("network_lead_matches")
    .select("connection_count, connection_names, connection_urls")
    .eq("user_id", user!.id)
    .eq("lead_id", leadId)
    .maybeSingle();

  if (match && match.connection_count > 0) {
    const urls: string[] = match.connection_urls || [];
    const names: string[] = match.connection_names || [];

    let emailByUrl: Record<string, string> = {};
    if (urls.length > 0) {
      const { data: connRows } = await supabase
        .from("linkedin_connections")
        .select("linkedin_url, email")
        .eq("user_id", user!.id)
        .in("linkedin_url", urls);

      if (connRows) {
        for (const row of connRows) {
          if (row.linkedin_url && row.email) {
            emailByUrl[row.linkedin_url] = row.email;
          }
        }
      }
    }

    const connections = names.map((name, i) => ({
      name,
      linkedinUrl: urls[i] || null,
      email: urls[i] ? (emailByUrl[urls[i]] || null) : null,
    }));

    return jsonResponse({ connections });
  }

  // Fallback: look up lead's company and query linkedin_connections directly
  const { data: lead } = await supabase
    .from("leads")
    .select("company")
    .eq("id", leadId)
    .maybeSingle();

  if (!lead?.company) {
    return jsonResponse({ connections: [] });
  }

  const normalized = normalizeCompany(lead.company);

  const { data: connRows } = await supabase
    .from("linkedin_connections")
    .select("first_name, last_name, position, linkedin_url, email")
    .eq("user_id", user!.id)
    .eq("company_normalized", normalized);

  if (!connRows || connRows.length === 0) {
    return jsonResponse({ connections: [] });
  }

  const connections = connRows.map((c) => {
    const name = [
      [c.first_name, c.last_name].filter(Boolean).join(" "),
      c.position ? `(${c.position})` : "",
    ].filter(Boolean).join(" ");
    return {
      name,
      linkedinUrl: c.linkedin_url || null,
      email: c.email || null,
    };
  });

  return jsonResponse({ connections });
}

import { NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isLocalMode } from "@/lib/local";

// Agent intake answers, one row per user per agent (e.g. "home_manager").
// In local mode they're written to .local-data/intake/<agent>.json so they
// survive restarts and can be read directly.

const jsonResponse = (data: unknown, status = 200) =>
  NextResponse.json(data, { status });

const AGENTS = ["home_manager"];

const localFile = (agent: string) =>
  path.join(process.cwd(), ".local-data", "intake", `${agent}.json`);

// GET /api/intake?agent=xxx — the saved intake, or null if none yet
export async function GET(request: Request) {
  const agent = new URL(request.url).searchParams.get("agent");
  if (!agent || !AGENTS.includes(agent)) {
    return jsonResponse({ message: "Invalid agent" }, 400);
  }

  if (isLocalMode) {
    try {
      return jsonResponse(JSON.parse(await readFile(localFile(agent), "utf8")));
    } catch {
      return jsonResponse(null);
    }
  }

  const supabase = await createClient();
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { data, error } = await supabase
    .from("intake_responses")
    .select("agent, answers, updated_at")
    .eq("user_id", user!.id)
    .eq("agent", agent)
    .maybeSingle();

  if (error) return jsonResponse({ message: error.message }, 500);

  return jsonResponse(data ? { agent, ...data.answers, updated_at: data.updated_at } : null);
}

// PUT /api/intake?agent=xxx
// Body: { answers: Record<string, string>, known_providers: Provider[] }
export async function PUT(request: Request) {
  const agent = new URL(request.url).searchParams.get("agent");
  if (!agent || !AGENTS.includes(agent)) {
    return jsonResponse({ message: "Invalid agent" }, 400);
  }

  const { answers, known_providers } = await request.json();
  if (typeof answers !== "object" || !Array.isArray(known_providers)) {
    return jsonResponse({ message: "Invalid body" }, 400);
  }

  const updated_at = new Date().toISOString();
  const record = { answers, known_providers };

  if (isLocalMode) {
    const file = localFile(agent);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify({ agent, ...record, updated_at }, null, 2) + "\n");
    return jsonResponse({ ok: true, updated_at });
  }

  const supabase = await createClient();
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { error } = await supabase
    .from("intake_responses")
    .upsert({ user_id: user!.id, agent, answers: record, updated_at });

  if (error) return jsonResponse({ message: error.message }, 500);

  return jsonResponse({ ok: true, updated_at });
}

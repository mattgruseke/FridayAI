import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const jsonResponse = (data: unknown, status = 200) =>
  NextResponse.json(data, { status });

const mapTemplate = (row: Record<string, unknown>) => ({
  id: row.id,
  name: row.name,
  subject: row.subject,
  body: row.body,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export async function GET() {
  const supabase = await createClient();
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { data, error } = await supabase
    .from("user_templates")
    .select("*")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  if (error) return jsonResponse({ message: error.message }, 500);

  return jsonResponse((data || []).map(mapTemplate));
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { name, subject, body } = await request.json();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("user_templates")
    .insert({ user_id: user!.id, name, subject: subject ?? "", body: body ?? "", created_at: now, updated_at: now })
    .select("*")
    .single();

  if (error) return jsonResponse({ message: error.message }, 500);

  return jsonResponse(mapTemplate(data), 201);
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { user, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return jsonResponse({ message: "Template ID required" }, 400);

  const { error } = await supabase
    .from("user_templates")
    .delete()
    .eq("id", id)
    .eq("user_id", user!.id);

  if (error) return jsonResponse({ message: error.message }, 500);

  return new Response(null, { status: 204 });
}

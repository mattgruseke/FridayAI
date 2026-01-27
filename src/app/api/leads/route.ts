import { NextResponse } from "next/server";
import { optionalUser, requireUser, isAdminUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { mapLead } from "@/lib/mappers";
import { leadToDb } from "@/lib/transformers";

const jsonResponse = (data: unknown, status = 200) =>
  NextResponse.json(data, { status });

const stripUndefined = (value: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined)
  );

export async function GET(request: Request) {
  const { user } = await optionalUser(request);
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (id) {
    const { data, error } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      return jsonResponse({ error: "Lead not found" }, 404);
    }

    if (!data.is_global && data.created_by !== "system") {
      if (!user || data.created_by !== user.id) {
        return jsonResponse({ error: "Lead not found" }, 404);
      }
    }

    return jsonResponse(mapLead(data));
  }

  const page = Number(searchParams.get("page") || "1");
  const limit = Number(searchParams.get("limit") || "10");
  const sortParam = searchParams.get("sort") || "-created_at";
  const search = searchParams.get("search");

  const sortField = sortParam.startsWith("-")
    ? sortParam.slice(1)
    : sortParam;
  const ascending = !sortParam.startsWith("-");
  const normalizedSort = sortField === "_id" ? "created_at" : sortField;

  let query = supabaseAdmin
    .from("leads")
    .select("*", { count: "exact" })
    .order(normalizedSort, { ascending });

  const accessFilters = user
    ? `is_global.eq.true,created_by.eq.system,created_by.eq.${user.id}`
    : "is_global.eq.true,created_by.eq.system";
  query = query.or(accessFilters);

  if (search) {
    query = query.or(
      `title.ilike.%${search}%,company.ilike.%${search}%,location.ilike.%${search}%`
    );
  }

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await query.range(from, to);

  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }

  const leads = (data || []).map(mapLead);
  const totalLeads = count ?? leads.length;

  return jsonResponse({
    leads,
    totalLeads,
    page,
    limit,
    totalPages: Math.ceil(totalLeads / limit),
  });
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireUser(request);
  if (errorResponse) return errorResponse;

  const payload = await request.json();
  const now = new Date().toISOString();

  const insertData = {
    ...leadToDb(payload),
    created_by: user!.id,
    is_global: payload.isGlobal === true,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabaseAdmin
    .from("leads")
    .insert(insertData)
    .select("*")
    .single();

  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }

  return jsonResponse(mapLead(data), 201);
}

export async function PUT(request: Request) {
  const { user, errorResponse } = await requireUser(request);
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return jsonResponse({ error: "Missing ID" }, 400);
  }

  const { data: existing, error } = await supabaseAdmin
    .from("leads")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !existing) {
    return jsonResponse({ error: "Lead not found" }, 404);
  }

  const isAdmin = await isAdminUser(user!.id);
  if (existing.created_by !== user!.id && existing.created_by !== "system" && !isAdmin) {
    return jsonResponse({ error: "Not authorized to edit this lead" }, 403);
  }

  const updates = stripUndefined(leadToDb(await request.json()));
  if (!isAdmin) {
    delete updates.created_by;
    delete updates.is_global;
  }

  updates.updated_at = new Date().toISOString();

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("leads")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (updateError) {
    return jsonResponse({ error: updateError.message }, 500);
  }

  return jsonResponse(mapLead(updated));
}

export async function DELETE(request: Request) {
  const { user, errorResponse } = await requireUser(request);
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return jsonResponse({ error: "Missing ID" }, 400);
  }

  const { data: existing, error } = await supabaseAdmin
    .from("leads")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !existing) {
    return jsonResponse({ error: "Lead not found" }, 404);
  }

  const isAdmin = await isAdminUser(user!.id);
  if (existing.created_by !== user!.id && !isAdmin) {
    return jsonResponse({ error: "Not authorized to delete this lead" }, 403);
  }

  const { error: deleteError } = await supabaseAdmin
    .from("leads")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return jsonResponse({ error: deleteError.message }, 500);
  }

  return new Response(null, { status: 204 });
}

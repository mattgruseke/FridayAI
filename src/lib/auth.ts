import { supabaseAdmin } from "@/lib/supabaseAdmin";

type AuthResult = {
  user: { id: string } | null;
  errorResponse: Response | null;
  token: string | null;
};

const unauthorized = () =>
  new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });

export async function requireUser(request: Request): Promise<AuthResult> {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    return { user: null, errorResponse: unauthorized(), token: null };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    return { user: null, errorResponse: unauthorized(), token };
  }

  return { user: { id: data.user.id }, errorResponse: null, token };
}

export async function optionalUser(request: Request): Promise<AuthResult> {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    return { user: null, errorResponse: null, token: null };
  }

  const { data } = await supabaseAdmin.auth.getUser(token);
  if (!data?.user) {
    return { user: null, errorResponse: null, token };
  }

  return { user: { id: data.user.id }, errorResponse: null, token };
}

export async function isAdminUser(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error) return false;
  return data?.role === "admin";
}

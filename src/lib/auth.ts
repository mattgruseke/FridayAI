import { createClient } from "@/lib/supabase/server";

type AuthResult = {
  user: { id: string } | null;
  errorResponse: Response | null;
};

const unauthorized = () =>
  new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });

export async function requireUser(): Promise<AuthResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null, errorResponse: unauthorized() };
  }

  return { user: { id: user.id }, errorResponse: null };
}

export async function optionalUser(): Promise<AuthResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, errorResponse: null };
  }

  return { user: { id: user.id }, errorResponse: null };
}

export async function isAdminUser(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error) return false;
  return data?.role === "admin";
}

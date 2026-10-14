import { createClient } from "@/lib/supabase/server";
import { isLocalMode, LOCAL_USER, localStore } from "@/lib/local";

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
  if (isLocalMode) return { user: { id: LOCAL_USER.id }, errorResponse: null };
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
  if (isLocalMode) return { user: { id: LOCAL_USER.id }, errorResponse: null };
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
  if (isLocalMode) return localStore.profile.role === "admin";
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error) return false;
  return data?.role === "admin";
}

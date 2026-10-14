"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { siteConfig } from "@/config/site";

export async function signIn(email: string, password: string) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  revalidatePath("/", "layout");
}

export async function signUp(
  email: string,
  password: string,
  inviteCode = ""
) {
  const supabase = await createClient();
  const headersList = await headers();
  const origin = headersList.get("origin") || "";
  const code = inviteCode.trim().toUpperCase();

  if (siteConfig.inviteOnly) {
    const { valid, error } = await validateInviteCode(code);
    if (!valid) throw new Error(error);
  }

  // The `handle_new_user` trigger (supabase/schema.sql) creates the profile,
  // redeems the invite code from this metadata, and seeds a welcome notification.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/login?verified=true`,
      data: code ? { invite_code: code } : undefined,
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function validateInviteCode(code: string) {
  const supabase = await createClient();

  // Security-definer function so the invite_codes table stays unreadable to clients.
  const { data, error } = await supabase.rpc("check_invite_code", {
    p_code: code.trim().toUpperCase(),
  });

  if (error || !data) {
    return { valid: false, error: "Invalid or expired invite code" };
  }

  return { valid: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  // Don't redirect here - let the client handle it with window.location
  // for a full page reload that ensures state is cleared
}

export async function resetPassword(email: string) {
  const supabase = await createClient();
  const headersList = await headers();
  const origin = headersList.get("origin") || "";

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset-password`,
  });

  if (error) {
    throw error;
  }
}

export async function updatePassword(newPassword: string) {
  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    throw error;
  }
}

export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getUserProfile(userId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    return null;
  }

  return data;
}

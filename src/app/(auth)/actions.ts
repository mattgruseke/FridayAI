"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

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
  inviteCode: string
) {
  const supabase = await createClient();
  const headersList = await headers();
  const origin = headersList.get("origin") || "";

  // Validate invite code first
  const { data: codeData, error: codeError } = await supabase
    .from("invite_codes")
    .select("*")
    .eq("code", inviteCode.toUpperCase())
    .gt("uses_remaining", 0)
    .single();

  if (codeError || !codeData) {
    throw new Error("Invalid or expired invite code");
  }

  // Check expiration
  if (codeData.expires_at && new Date(codeData.expires_at) < new Date()) {
    throw new Error("Invite code has expired");
  }

  // Sign up with Supabase
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/login?verified=true`,
    },
  });

  if (error) {
    throw error;
  }

  // Decrement invite code uses
  await supabase
    .from("invite_codes")
    .update({ uses_remaining: codeData.uses_remaining - 1 })
    .eq("id", codeData.id);

  // Update user profile with invite code used
  if (data.user) {
    await supabase
      .from("user_profiles")
      .update({ invite_code_used: inviteCode.toUpperCase() })
      .eq("id", data.user.id);
  }

  return data;
}

export async function validateInviteCode(code: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("invite_codes")
    .select("*")
    .eq("code", code.toUpperCase())
    .gt("uses_remaining", 0)
    .single();

  if (error || !data) {
    return { valid: false, error: "Invalid or expired invite code" };
  }

  // Check expiration
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { valid: false, error: "Invite code has expired" };
  }

  return { valid: true, codeData: data };
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

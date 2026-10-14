"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  signOut as signOutAction,
  updatePassword as updatePasswordAction,
} from "@/app/(auth)/actions";

// Mirrors the `user_profiles` table (supabase/schema.sql). Add your own columns
// here and in the schema.
export type UserProfile = {
  id: string;
  role?: string;
  full_name?: string;
  invite_code_used?: string;
  [key: string]: unknown;
} | null;

type AuthContextValue = {
  user: User | null;
  userProfile: UserProfile;
  loading: boolean;
  isAdmin: boolean;
  isAuthenticated: boolean;
  fullName: string;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
};

type AuthProviderProps = {
  children: ReactNode;
  initialUser: User | null;
  initialProfile: UserProfile;
};

export const AuthProvider = ({
  children,
  initialUser,
  initialProfile,
}: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(initialUser);
  const [userProfile, setUserProfile] = useState<UserProfile>(initialProfile);
  const [loading, setLoading] = useState(false);

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/profile", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setUserProfile(data);
    } catch {
      // best effort
    }
  };

  const refreshProfile = async () => {
    if (!user) return;
    await fetchProfile();
  };

  useEffect(() => {
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        await fetchProfile();
      } else {
        setUserProfile(null);
      }

      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const value: AuthContextValue = {
    user,
    userProfile,
    loading,
    isAdmin: userProfile?.role === "admin",
    isAuthenticated: !!user,
    fullName: (userProfile?.full_name as string) ?? "",
    refreshProfile,
    signOut: signOutAction,
    updatePassword: updatePasswordAction,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;

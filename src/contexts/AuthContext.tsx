"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { signOut as signOutAction } from "@/app/(auth)/actions";

type UserProfile = {
  id: string;
  role?: string;
  invite_code_used?: string;
  onboarding_completed?: boolean;
  onboarding_skipped?: boolean;
  preferred_roles?: string[];
  preferred_compensation?: string[];
  tour_completed?: boolean;
  full_name?: string;
  has_network_access?: boolean;
  [key: string]: unknown;
} | null;

type AuthContextValue = {
  user: User | null;
  userProfile: UserProfile;
  loading: boolean;
  isAdmin: boolean;
  isAuthenticated: boolean;
  onboardingCompleted: boolean;
  onboardingSkipped: boolean;
  preferredRoles: string[];
  preferredCompensation: string[];
  tourCompleted: boolean;
  hasNetworkAccess: boolean;
  fullName: string;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
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
    onboardingCompleted: userProfile?.onboarding_completed === true,
    onboardingSkipped: userProfile?.onboarding_skipped === true,
    preferredRoles: (userProfile?.preferred_roles as string[]) ?? [],
    preferredCompensation: (userProfile?.preferred_compensation as string[]) ?? [],
    tourCompleted: userProfile?.tour_completed === true,
    hasNetworkAccess: userProfile?.has_network_access === true,
    fullName: (userProfile?.full_name as string) ?? "",
    refreshProfile,
    signOut: signOutAction,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;

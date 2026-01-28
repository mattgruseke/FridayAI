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
  [key: string]: unknown;
} | null;

type AuthContextValue = {
  user: User | null;
  userProfile: UserProfile;
  loading: boolean;
  isAdmin: boolean;
  isAuthenticated: boolean;
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

  useEffect(() => {
    const supabase = createClient();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        // Fetch user profile
        const { data } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("id", currentUser.id)
          .single();

        setUserProfile(data);
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
    signOut: signOutAction,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;

"use client";

import { AuthProvider } from "@/contexts/AuthContext";
import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";

type UserProfile = {
  id: string;
  role?: string;
  invite_code_used?: string;
  [key: string]: unknown;
} | null;

type ProvidersProps = {
  children: ReactNode;
  initialUser: User | null;
  initialProfile: UserProfile;
};

export default function Providers({
  children,
  initialUser,
  initialProfile,
}: ProvidersProps) {
  return (
    <AuthProvider initialUser={initialUser} initialProfile={initialProfile}>
      {children}
    </AuthProvider>
  );
}

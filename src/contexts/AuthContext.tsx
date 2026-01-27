"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';
import { setAccessToken as setApiAccessToken } from '../api/client';

type UserProfile = Record<string, any> | null;

type AuthContextValue = {
  user: Record<string, any> | null;
  userProfile: UserProfile;
  loading: boolean;
  signUp: (email: string, password: string, inviteCode: string) => Promise<any>;
  signIn: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  validateInviteCode: (code: string) => Promise<{ valid: boolean; error?: string; codeData?: any }>;
  getAccessToken: () => string | null;
  accessToken: string | null;
  isAdmin: boolean;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};

type AuthProviderProps = {
  children: ReactNode;
};

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<Record<string, any> | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile>(null);
  const [loading, setLoading] = useState(true);
  const [currentAccessToken, setCurrentAccessToken] = useState<string | null>(null);

  // Fetch user profile (role, etc.)
  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // Ignore AbortError - happens during React StrictMode remounts
        if (error.message?.includes('AbortError') || error.code === 'ABORT_ERR') {
          return null;
        }
        console.error('Error fetching user profile:', error);
        return null;
      }
      return data;
    } catch (err: any) {
      // Ignore AbortError - happens during React StrictMode remounts
      if (err.name === 'AbortError' || err.message?.includes('AbortError')) {
        return null;
      }
      console.error('Error fetching user profile:', err);
      return null;
    }
  };

  useEffect(() => {
    let isMounted = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let sessionResolved = false;

    // Timeout fallback - if getSession takes too long, stop loading
    timeoutId = setTimeout(() => {
      if (isMounted && !sessionResolved) {
        console.warn('Auth session check timed out');
        setLoading(false);
      }
    }, 5000);

    // Get initial session
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        sessionResolved = true;
        if (timeoutId) clearTimeout(timeoutId);
        if (!isMounted) return;
        const token = session?.access_token ?? null;
        setUser(session?.user ?? null);
        setCurrentAccessToken(token);
        setApiAccessToken(token); // Sync to API client
        if (session?.user) {
          const profile = await fetchUserProfile(session.user.id);
          if (isMounted) setUserProfile(profile);
        }
        if (isMounted) setLoading(false);
      })
      .catch((err: any) => {
        sessionResolved = true;
        if (timeoutId) clearTimeout(timeoutId);
        // Ignore AbortError - happens during React StrictMode remounts
        if (err.name === 'AbortError' || err.message?.includes('AbortError')) {
          return;
        }
        console.error('Error getting session:', err);
        if (isMounted) setLoading(false);
      });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!isMounted) return;
        const token = session?.access_token ?? null;
        setUser(session?.user ?? null);
        setCurrentAccessToken(token);
        setApiAccessToken(token); // Sync to API client
        if (session?.user) {
          const profile = await fetchUserProfile(session.user.id);
          if (isMounted) setUserProfile(profile);
        } else {
          setUserProfile(null);
        }
      }
    );

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  // Validate invite code
  const validateInviteCode = async (code: string) => {
    const { data, error } = await supabase
      .from('invite_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .gt('uses_remaining', 0)
      .single();

    if (error || !data) {
      return { valid: false, error: 'Invalid or expired invite code' };
    }

    // Check expiration
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return { valid: false, error: 'Invite code has expired' };
    }

    return { valid: true, codeData: data };
  };

  // Sign up with invite code
  const signUp = async (email: string, password: string, inviteCode: string) => {
    // Validate invite code first
    const { valid, error: codeError, codeData } = await validateInviteCode(inviteCode);

    if (!valid) {
      throw new Error(codeError);
    }

    // Sign up with Supabase
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/login?verified=true`,
      },
    });

    if (error) throw error;

    // Decrement invite code uses
    await supabase
      .from('invite_codes')
      .update({ uses_remaining: codeData.uses_remaining - 1 })
      .eq('id', codeData.id);

    // Update user profile with invite code used
    if (data.user) {
      await supabase
        .from('user_profiles')
        .update({ invite_code_used: inviteCode.toUpperCase() })
        .eq('id', data.user.id);
    }

    return data;
  };

  // Sign in
  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  };

  // Sign out
  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err: any) {
      // Ignore AbortError from React StrictMode
      if (err.name !== 'AbortError') throw err;
    }
    setUser(null);
    setUserProfile(null);
    setCurrentAccessToken(null);
    setApiAccessToken(null); // Clear API client token
  };

  // Reset password request
  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  };

  // Update password (after reset)
  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
  };

  // Get current session token for API calls - returns cached token directly
  const getAccessToken = () => {
    return currentAccessToken;
  };

  const value: AuthContextValue = {
    user,
    userProfile,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
    validateInviteCode,
    getAccessToken,
    accessToken: currentAccessToken,
    isAdmin: userProfile?.role === 'admin',
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;

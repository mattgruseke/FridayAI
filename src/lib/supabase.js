import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables not set. Auth will not work.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      // Prevent auto-refresh race conditions in React StrictMode
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      // Use a custom storage key to avoid conflicts
      storageKey: 'gigfrog-auth',
    },
  }
);

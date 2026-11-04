// Local mode: runs the app with no Supabase project. Turned on when
// NEXT_PUBLIC_SUPABASE_URL is unset. Everyone is signed in as LOCAL_USER and
// data lives in memory, so it resets when the dev server restarts.

import type { User } from "@supabase/supabase-js";
import type { Item } from "@/api/client";

export const isLocalMode = !process.env.NEXT_PUBLIC_SUPABASE_URL;

export const LOCAL_USER = {
  id: "00000000-0000-0000-0000-000000000000",
  email: "dev@localhost",
  created_at: new Date().toISOString(),
  app_metadata: {},
  user_metadata: {},
  aud: "authenticated",
} as User;

type Profile = { id: string; role: string; full_name: string };
type Notification = {
  id: string;
  user_id: string;
  type: string;
  message: string;
  action_url: string | null;
  is_completed: boolean;
  is_dismissed: boolean;
  created_at: string;
};

type Store = {
  profile: Profile;
  items: Item[];
  notifications: Notification[];
};

// Kept on globalThis so it survives hot reloads.
const g = globalThis as typeof globalThis & { __localStore?: Store };

export const localStore: Store = (g.__localStore ??= {
  profile: { id: LOCAL_USER.id, role: "user", full_name: "" },
  items: [],
  notifications: [
    {
      id: crypto.randomUUID(),
      user_id: LOCAL_USER.id,
      type: "welcome",
      message: "Welcome! Set your name on your profile.",
      action_url: "/profile",
      is_completed: false,
      is_dismissed: false,
      created_at: new Date().toISOString(),
    },
  ],
});

// The store outlives hot reloads, so it can hold items from before these fields existed.
for (const item of localStore.items) {
  item.status ??= "not_started";
  item.notes ??= null;
  item.scheduled_on ??= null;
  item.scheduled_time ??= null;
}

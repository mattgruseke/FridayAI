# Web App Auth Template

A Next.js 15 + Supabase starter with:

- **Auth**: email/password signup with email verification, login, password reset, optional invite codes, protected routes (middleware + client guard), and admin roles.
- **A sample feature**: per-user "items" CRUD (page → API client → route handler → table with row-level security) to copy for your own resources.
- **Notifications**: a header bell backed by a `notifications` table. New users get a welcome notification.
- **Theming**: light/dark mode and a user-pickable accent colour, driven by CSS tokens.

## Local mode (no Supabase)

Run `yarn && yarn dev` with no `.env.local`. With `NEXT_PUBLIC_SUPABASE_URL` unset, you're always signed in as `dev@localhost`, and items, profile and notifications are kept in memory, so they reset on restart. See [`src/lib/local.ts`](src/lib/local.ts). Follow the steps below to switch to Supabase.

## Quick start

1. **Install**
   ```
   yarn
   ```

2. **Create a Supabase project** and run [`supabase/schema.sql`](supabase/schema.sql) in its SQL editor. It creates the tables, row-level security policies and the signup trigger.

3. **Configure env**
   ```
   cp .env.example .env.local
   ```
   Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Supabase → Project Settings → API.

4. **Set Supabase auth URLs.** Under Authentication → URL Configuration, set the Site URL (e.g. `http://localhost:3000`) and add `http://localhost:3000/**` to Redirect URLs so the verification and password-reset links work.

5. **Create an invite code** (signup is invite-only by default):
   ```sql
   insert into public.invite_codes (code, uses_remaining) values ('WELCOME', 10);
   ```

6. **Run**
   ```
   yarn dev
   ```

## Make it yours

| What | Where |
| --- | --- |
| App name, description, footer, nav links, default dark mode, accent palette | [`src/config/site.ts`](src/config/site.ts) |
| Colours, fonts, spacing tokens | [`src/app/theme.css`](src/app/theme.css) |
| Favicon | [`src/app/icon.svg`](src/app/icon.svg) |
| Overview at `/` (every item, tagged by area) | [`src/views/Overview.tsx`](src/views/Overview.tsx) |
| Home, entertainment and food pages (each lists its own category of items, with a list/calendar toggle) | [`src/views/Items.tsx`](src/views/Items.tsx), [`src/components/Calendar.tsx`](src/components/Calendar.tsx), `src/app/(app)/` |
| Profile columns | `user_profiles` in the schema, [`AuthContext.tsx`](src/contexts/AuthContext.tsx), [`/api/profile`](src/app/api/profile/route.ts) |

### Turning off invite codes

Set `inviteOnly: false` in `src/config/site.ts` **and** `require_invite := false` in `handle_new_user()` in the schema. The database check stops people from bypassing the form by calling Supabase directly.

### Admins

```sql
update public.user_profiles set role = 'admin' where id = '<user uuid>';
```
Users can't change their own role: column grants only allow them to update `full_name`. Use `isAdmin` from `useAuth()` on the client and `isAdminUser()` from `src/lib/auth.ts` on the server.

### Adding a feature

Follow the items example:

1. Add a table and RLS policies to `supabase/schema.sql`. Copy the `items` block.
2. Add a route handler under `src/app/api/<name>/route.ts`. Start with `requireUser()`.
3. Add typed calls to `src/api/client.ts`.
4. Add a page in `src/app/(app)/<name>/page.tsx`. Everything under `(app)` is behind login and gets the header/footer.
5. Add it to `nav` in `src/config/site.ts`.

Items have a `category` (`home`, `entertainment` or `food`). To add a category, add it to `ITEM_CATEGORIES` in `src/api/client.ts` and to the `category` check in the schema, then add a page and nav link.

### Sending notifications

Insert rows from SQL, a trigger, or server code using the service role key:
```sql
insert into public.notifications (user_id, type, message, action_url)
values ('<user uuid>', 'reminder', 'Something needs your attention', '/');
```
Call `api.notifications.completeByType('<type>')` once the user has done the thing. See `Profile.tsx` for an example.

## Project layout

```
src/
  app/
    (auth)/        login, signup, reset-password + server actions
    (app)/         signed-in pages (home, items, profile)
    api/           route handlers (items, notifications, profile)
    theme.css      design tokens + shared styles
  config/site.ts   branding and app-level switches
  contexts/        AuthContext (user, profile, signOut, updatePassword)
  hooks/           useTheme, useToast
  lib/supabase/    browser, server and middleware clients
  middleware.ts    session refresh + redirect to /login
supabase/schema.sql
```
new items

 a
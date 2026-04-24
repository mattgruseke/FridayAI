# SES Email Integration — Remaining Work

## Current State

The Send Email button in the Network → LinkedIn Analysis section is fully wired up:

- `POST /api/send-email` route exists at `src/app/api/send-email/route.ts`
- Sends via AWS SES with `From: "Name via GigFrog <noreply@gigfrog.io>"` and `Reply-To: user's email`
- On success: logs activity, advances lead to "Contacted", shows "Email Sent!" state
- On failure: shows error message in the modal, user can retry
- AWS credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SES_REGION`) are in `.env`
- `gigfrog.io` domain is verified in SES

---

## Blocker: SES Sandbox Mode

SES is currently in **sandbox mode**, which means only verified email addresses can *receive* emails. Real LinkedIn connection emails will bounce/fail until production access is granted.

### Request Production Access
1. Go to AWS Console → SES → Account dashboard
2. Click **"Request production access"**
3. Fill out the form:
   - **Mail type**: Transactional
   - **Website URL**: gigfrog.io
   - **Use case**: Job seekers sending personalized outreach emails to their LinkedIn connections via the GigFrog platform. Emails are user-initiated, one at a time, to known contacts.
   - **Additional contacts**: Add your email
4. Submit — AWS typically approves within 24 hours

---

## Nice-to-Have: User Display Name

Currently the `From` display name falls back to the part before `@` in the user's email (e.g. `doug` from `doug@gmail.com`). Users who signed up via Google OAuth will get their real full name from `user.user_metadata.full_name`.

To fix this properly for email/password signups, add a `full_name` field to the onboarding flow and store it in `user_profiles`. Then pull it in `src/app/api/send-email/route.ts` via a Supabase query:

```ts
const { data: profile } = await supabase
  .from("user_profiles")
  .select("full_name")
  .eq("id", user.id)
  .maybeSingle();

const rawName = profile?.full_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "Someone";
```

---

## Optional: Sending Limit / Rate Guard

Once in production, consider adding a simple per-user daily send limit at the API layer to avoid abuse. SES charges per email and reputation is shared across the domain.

```ts
// rough sketch — could use a redis counter or a supabase table
const todayCount = await getSendCountToday(user.id);
if (todayCount >= 20) {
  return NextResponse.json({ message: "Daily send limit reached" }, { status: 429 });
}
```

---

## Files Changed This Session

| File | What changed |
|------|-------------|
| `src/app/api/send-email/route.ts` | New — SES send endpoint |
| `src/api/client.ts` | Added `api.sendEmail.send()` |
| `src/views/Network.tsx` | `handleSendEmail` calls real API, `emailError` state added |

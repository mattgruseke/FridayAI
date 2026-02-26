# Migration Plan: Contact Fields & user_leads Schema

## Finalized Data Model

### `leads` table — public, non-fungible facts
Read-only for any user who didn't create the row. Shared across everyone who saves the lead.

| Field | Notes |
|---|---|
| `company` | Non-fungible |
| `title` | Non-fungible |
| `team` | Non-fungible |
| `industry` | Non-fungible |
| `datePosted` | Non-fungible |
| `sourceLink` | Original job board URL — public fact |
| `sourceApplicationLink` | URL to apply — same for everyone |
| `location` | Posted location — public fact, users can override in user_leads |
| `compensation` | Posted range — public fact, users can override in user_leads |
| `contactName` | Recruiter/HR name from the posting — non-fungible public context |
| `contactEmail` | Recruiter/HR email from the posting — non-fungible public context |
| `contactLinkedIn` | Recruiter/HR LinkedIn from the posting — non-fungible public context |
| `isGlobal` | Whether the lead is in the public database |

### `user_leads` table — personal tracking, always user-owned
Fully editable by the user regardless of whether the lead is public or private.

**Existing fields (unchanged):**
- `leadId`, `userId`, `currentStatus`, `priority`, `notes`, `activity`

**Fields to add — user overrides for contextual lead data:**
| Field | Overrides | Notes |
|---|---|---|
| `location` | `leads.location` | User's actual location situation (e.g. "hybrid, 3 days onsite") |
| `compensation` | `leads.compensation` | User's negotiated or updated comp info |
| `sourceApplicationLink` | `leads.sourceApplicationLink` | User's specific application link if different |

**Fields to add — personal contacts discovered during job search:**
| Field | Notes |
|---|---|
| `userContactName` | The person the user actually spoke to (may differ from posted contact) |
| `userContactEmail` | Personal contact email discovered during process |
| `userContactLinkedIn` | Personal contact LinkedIn |
| `additionalEmails` | Emails from interviewers, hiring managers, etc. |
| `additionalLinks` | Personal links added during the process |

---

## UI: LeadDetail Layout (post-save view)

### Basic Information section → two sub-sections

**Job Posting** (read from `leads`)
- Locked for public/global leads (isGlobal: true) — no edit pencil
- Edit pencil shown only for user-created leads
- Fields: Company, Position, Team, Industry, Date Posted, Source URL

**Your Tracking** (read/write from `user_leads`, always editable inline — no pencil needed)
- Stage (existing `currentStatus`)
- Priority (existing `priority`)
- Location (shows `user_leads.location` if set, else `leads.location` as placeholder)
- Compensation (shows `user_leads.compensation` if set, else `leads.compensation` as placeholder)
- Application Link (shows `user_leads.sourceApplicationLink` if set, else `leads.sourceApplicationLink`)
- *(space reserved for additional tracking fields coming soon)*

### Contact Information section → two sub-sections

**Listed Contact** (read from `leads`)
- Locked for public/global leads — no edit pencil
- Edit pencil shown only for user-created leads
- Fields: Contact Name, Email + copy, LinkedIn

**Your Contacts** (read/write from `user_leads`, always editable inline)
- My Contact Name (`user_leads.userContactName`)
- My Contact Email + copy (`user_leads.userContactEmail`)
- My LinkedIn (`user_leads.userContactLinkedIn`)
- Additional Emails (`user_leads.additionalEmails`)
- Additional Links (`user_leads.additionalLinks`)
- Referral (existing)

---

## UI: Add New Lead flow

Show **only `leads` fields** — no tracking section at all.
Stage defaults to `saved` and Priority defaults to `medium` automatically; user never sees them here.

Fields shown in Add New form:
- Company, Position, Team, Industry
- Location, Compensation
- Date Posted, Source URL, Application URL
- Contact Name, Contact Email, Contact LinkedIn

Rationale: user is entering a job posting. The tracking layer (Your Tracking, Your Contacts) reveals itself after the lead is saved, once they've committed to it.

---

---

## Step 1: Immediate DB Cleanup (safe to run now)

`additional_emails` and `additional_links` are confirmed all-NULL in `leads`.
Drop them — they belong in `user_leads` only.

```sql
ALTER TABLE leads DROP COLUMN additional_emails;
ALTER TABLE leads DROP COLUMN additional_links;
```

---

## Step 2: Add new fields to `user_leads`

```sql
ALTER TABLE user_leads ADD COLUMN location TEXT;
ALTER TABLE user_leads ADD COLUMN compensation JSONB;
ALTER TABLE user_leads ADD COLUMN source_application_link TEXT;
ALTER TABLE user_leads ADD COLUMN user_contact_name TEXT;
ALTER TABLE user_leads ADD COLUMN user_contact_email TEXT;
ALTER TABLE user_leads ADD COLUMN user_contact_linkedin TEXT;
ALTER TABLE user_leads ADD COLUMN additional_emails TEXT[];
ALTER TABLE user_leads ADD COLUMN additional_links JSONB;
```

> All nullable with no defaults — existing rows are unaffected.

---

## Step 3: API layer

The user_leads PATCH endpoint needs to accept and return the new fields:
- `location`, `compensation`, `source_application_link`
- `user_contact_name`, `user_contact_email`, `user_contact_linkedin`
- `additional_emails`, `additional_links`

Confirm these are included in the PATCH allowlist and returned in the GET response.

---

## Step 4: Frontend changes (LeadDetail.tsx)

### New types
```typescript
type Lead = {
  // existing fields...
  isGlobal?: boolean; // needed to gate edit pencil visibility
};

type UserLead = {
  // existing fields...
  location?: string;
  compensation?: { raw?: string };
  sourceApplicationLink?: string;
  userContactName?: string;
  userContactEmail?: string;
  userContactLinkedIn?: string;
  additionalEmails?: string[];
  additionalLinks?: { title?: string; url?: string }[];
};
```

### Read logic — merge on load
```typescript
// Overlay user_leads overrides on top of leads canonical values
setDisplayLocation(userLead.location ?? lead.location);
setDisplayCompensation(userLead.compensation ?? lead.compensation);
setDisplayAppLink(userLead.sourceApplicationLink ?? lead.sourceApplicationLink);
// Your Contacts fields read directly from userLead state
```

### Write logic — route saves to the right table
- **Job Posting** fields (company, title, team, industry, datePosted, sourceLink) → `api.leads.update` — only called when `!lead.isGlobal`
- **Your Tracking** fields (stage, priority, location, compensation, appLink) → `api.userLeads.update`
- **Listed Contact** fields (contactName, contactEmail, contactLinkedIn) → `api.leads.update` — only when `!lead.isGlobal`
- **Your Contacts** fields (userContactName, userContactEmail, etc.) → `api.userLeads.update`

### Edit pencil visibility
- **Job Posting** edit pencil: only show when `!lead.isGlobal`
- **Your Tracking**: always inline editable — no pencil
- **Listed Contact** edit pencil: only show when `!lead.isGlobal`
- **Your Contacts**: always inline editable — no pencil

### Add New form
- Remove Stage and Priority inputs from the Add New form entirely
- They are set to defaults (`saved` / `medium`) in state on mount — user never sees them
- Show only: Company, Position, Team, Industry, Location, Compensation, Date Posted, Source URL, Application URL, Contact Name, Contact Email, Contact LinkedIn
- After save, router.push to the lead detail page where the full layout is shown

---

## Step 5: No data migration needed for existing rows

- Existing `user_leads` rows: all new fields default to NULL — UI falls back to `leads` values seamlessly
- Existing `leads` rows: `contactEmail` / `contactLinkedIn` / `contactName` stay as-is — they're the public contact hint
- No retroactive stripping of `leads` rows — historical data left untouched

---

## What does NOT change

- `leads.contactName` / `contactEmail` / `contactLinkedIn` stay in `leads` — they're the non-fungible public contact
- `leads.location` / `compensation` / `sourceApplicationLink` stay in `leads` — they're the canonical posted values, used as fallback and for browsing the leads table before saving
- The publish flow (`isGlobal = true`) requires no stripping — once frontend routes personal fields to `user_leads`, the `leads` row will naturally only contain public data going forward

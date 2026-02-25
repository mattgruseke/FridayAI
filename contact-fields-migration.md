# Migration Plan: Move Contact Fields from `leads` → `user_leads`

## Problem
When a user saves a public lead from the leads table, they get a `user_leads` row but
don't own the shared `leads` row. Attempting to edit contact info (or any basic field)
returns a 403 "Not authorized to edit this lead" from the API.

Contact info is personal to each user's job search — it shouldn't be shared data.

---

## Goal
- `leads` table = public job posting data (read-only for saved public leads)
- `user_leads` table = everything personal to the user's tracking, including contact info

---

## Fields to move from `leads` → `user_leads`

| Field | Notes |
|---|---|
| `contactName` | Personal contact the user found |
| `contactEmail` | Personal contact email |
| `contactLinkedIn` | Personal LinkedIn URL |
| `additionalEmails` | Array of extra emails |
| `additionalLinks` | Array of `{ title, url }` objects |

Fields that **stay in `leads`** (public job data):
- `title`, `company`, `location`, `team`
- `compensation`, `industry`, `datePosted`
- `sourceApplicationLink`, `sourceLink`
- `isGlobal`

---

## Backend Changes

### 1. Add contact fields to `user_leads` schema
```
contactName: String
contactEmail: String
contactLinkedIn: String
additionalEmails: [String]
additionalLinks: [{ title: String, url: String }]
```

### 2. Migration script
For each existing `user_leads` document:
- Look up its linked `leads` document
- If `leads.contactName` / `contactEmail` etc. are set, copy them into the `user_leads` row
- (Optionally clear them from `leads` after migration, or leave them — they'll be ignored by the UI)

### 3. API: `user_leads` update endpoint
Ensure `PATCH /api/user-leads/:id` accepts and saves the new contact fields.
The existing update endpoint likely already accepts arbitrary fields — just verify.

### 4. API: `leads` update endpoint auth (no change needed)
Keep the existing 403 guard on `leads`. The frontend will stop calling it for contact info.

---

## Frontend Changes (`src/views/LeadDetail.tsx`)

### 1. Update the `UserLead` type
```typescript
type UserLead = {
  _id: string;
  leadId?: string | Lead;
  priority?: string;
  notes?: string;
  currentStatus?: string;
  // Add these:
  contactName?: string;
  contactEmail?: string;
  contactLinkedIn?: string;
  additionalEmails?: string[];
  additionalLinks?: { title?: string; url?: string }[];
};
```

### 2. Populate contact state from `userLead` (not `lead`)
In `fetchLeadDetails`, after loading `userLeadData`, initialize contact fields:
```typescript
// Prefer userLead contact data; fall back to lead data for user-created leads
setContactName(userLeadData.contactName ?? leadData.contactName ?? '');
setContactEmail(userLeadData.contactEmail ?? leadData.contactEmail ?? '');
// etc.
```
Or simpler: merge them into the displayed `lead` object so the rest of the UI is unchanged:
```typescript
setLead({
  ...leadData,
  contactName: userLeadData.contactName ?? leadData.contactName,
  contactEmail: userLeadData.contactEmail ?? leadData.contactEmail,
  contactLinkedIn: userLeadData.contactLinkedIn ?? leadData.contactLinkedIn,
  additionalEmails: userLeadData.additionalEmails ?? leadData.additionalEmails ?? [],
  additionalLinks: userLeadData.additionalLinks ?? leadData.additionalLinks ?? [],
});
```

### 3. `handleSaveSection('contact')` — write to `user_leads` instead of `leads`
```typescript
const handleSaveSection = async (section: 'basic' | 'contact') => {
  if (section === 'contact') {
    // Save contact fields to user_leads
    await api.userLeads.update(userLead._id, {
      contactName: lead.contactName,
      contactEmail: lead.contactEmail,
      contactLinkedIn: lead.contactLinkedIn,
      additionalEmails: lead.additionalEmails?.filter(e => e.trim()) || [],
      additionalLinks: lead.additionalLinks?.filter(l => l.url?.trim()) || [],
    });
  } else {
    // section === 'basic' — still writes to leads (only for user-owned leads)
    await api.leads.update(lead._id, { ...basicFields });
  }
  // ... rest of save logic unchanged
};
```

### 4. Basic Information edit button — hide for public leads
Now that contact info is separated, we can safely hide the Basic Info edit pencil
for public leads (`lead.isGlobal === true`) since those fields truly are read-only.
Add `isGlobal?: boolean` to the `Lead` type and gate the pencil icon:
```tsx
{!isNewLead && userLead && !lead.isGlobal && !isEditingBasic && (
  <button className="edit-icon-btn" ...>
```
Contact Information edit pencil stays ungated — always editable since it now writes to `user_leads`.

---

## Summary of the split after migration

| Section | Reads from | Writes to | Editable for public leads? |
|---|---|---|---|
| Basic Information | `leads` | `leads` | No (hide edit button) |
| Contact Information | `userLead` (fallback `leads`) | `user_leads` | Yes |
| Status / Priority | `user_leads` | `user_leads` | Yes |
| Notes | `user_leads` | `user_leads` | Yes |

---

## Notes
- For **user-created leads** (`isGlobal: false`), behavior is unchanged — basic info is still
  editable and contact info will write to `user_leads` (the lead row also has the data from
  creation, but `user_leads` values take precedence in the UI).
- The fallback (`userLeadData.contactEmail ?? leadData.contactEmail`) ensures existing
  manually-created leads still display their contact data before any migration runs.

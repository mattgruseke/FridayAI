type AnyRecord = Record<string, unknown>;

export const leadToDb = (payload: AnyRecord) => ({
  title: payload.title,
  company: payload.company,
  location: payload.location,
  team: payload.team,
  compensation: payload.compensation,
  contact_name: payload.contactName ?? payload.contact_name,
  contact_email: payload.contactEmail ?? payload.contact_email,
  additional_emails: payload.additionalEmails ?? payload.additional_emails,
  additional_links: payload.additionalLinks ?? payload.additional_links,
  contact_linkedin: payload.contactLinkedIn ?? payload.contact_linkedin,
  source_link: payload.sourceLink ?? payload.source_link,
  source_application_link:
    payload.sourceApplicationLink ?? payload.source_application_link,
  date_posted: payload.datePosted ?? payload.date_posted,
  industry: payload.industry,
  is_global: payload.isGlobal ?? payload.is_global,
  created_by: payload.createdBy ?? payload.created_by,
  shared_by: payload.sharedBy ?? payload.shared_by,
  shared_at: payload.sharedAt ?? payload.shared_at,
});

export const userLeadUpdateToDb = (payload: AnyRecord) => ({
  priority: payload.priority,
  notes: payload.notes,
  custom_fields: payload.customFields ?? payload.custom_fields,
  saved_at: payload.savedAt ?? payload.saved_at,
  last_activity_at: payload.lastActivityAt ?? payload.last_activity_at,
});

export const referralToDb = (payload: AnyRecord) => ({
  name: payload.name,
  company: payload.company,
  email: payload.email,
  linkedin: payload.linkedin,
  notes: payload.notes,
  linked_leads: payload.linkedLeads ?? payload.linked_leads,
});

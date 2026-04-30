type AnyRecord = Record<string, unknown>;

export const mapLead = (row: AnyRecord | null) => {
  if (!row) return row;
  return {
    _id: row.id ?? row._id,
    title: row.title,
    company: row.company,
    location: row.location,
    team: row.team,
    compensation: row.compensation,
    contactName: row.contact_name ?? row.contactName,
    contactEmail: row.contact_email ?? row.contactEmail,
    contactLinkedIn: row.contact_linkedin ?? row.contactLinkedIn,
    sourceLink: row.source_link ?? row.sourceLink,
    sourceApplicationLink:
      row.source_application_link ?? row.sourceApplicationLink,
    datePosted: row.date_posted ?? row.datePosted,
    industry: row.industry,
    createdBy: row.created_by ?? row.createdBy,
    isGlobal: row.is_global ?? row.isGlobal,
    sharedBy: row.shared_by ?? row.sharedBy,
    sharedAt: row.shared_at ?? row.sharedAt,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
  };
};

export const mapUserLead = (row: AnyRecord | null) => {
  if (!row) return row;
  return {
    _id: row.id ?? row._id,
    userId: row.user_id ?? row.userId,
    leadId: row.lead_id ?? row.leadId,
    currentStatus: row.current_status ?? row.currentStatus,
    statusHistory: row.status_history ?? row.statusHistory,
    priority: row.priority,
    notes: row.notes,
    customFields: row.custom_fields ?? row.customFields,
    savedAt: row.saved_at ?? row.savedAt,
    contactedAt: row.contacted_at ?? row.contactedAt,
    appliedAt: row.applied_at ?? row.appliedAt,
    interviewingAt: row.interviewing_at ?? row.interviewingAt,
    offerAt: row.offer_at ?? row.offerAt,
    offerAcceptedAt: row.offer_accepted_at ?? row.offerAcceptedAt,
    lastActivityAt: row.last_activity_at ?? row.lastActivityAt,
    location: row.location,
    compensation: row.compensation,
    sourceApplicationLink: row.source_application_link ?? row.sourceApplicationLink,
    userContactName: row.user_contact_name ?? row.userContactName,
    userContactEmail: row.user_contact_email ?? row.userContactEmail,
    userContactLinkedIn: row.user_contact_linkedin ?? row.userContactLinkedIn,
    additionalEmails: row.additional_emails ?? row.additionalEmails,
    additionalLinks: row.additional_links ?? row.additionalLinks,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
  };
};

export const mapUserList = (row: AnyRecord | null) => {
  if (!row) return row;
  return {
    _id: row.id ?? row._id,
    userId: row.user_id ?? row.userId,
    name: row.name,
    description: row.description,
    leadIds: row.lead_ids ?? row.leadIds ?? [],
    metadata: row.metadata ?? null,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
  };
};

export const mapReferral = (row: AnyRecord | null) => {
  if (!row) return row;
  return {
    _id: row.id ?? row._id,
    userId: row.user_id ?? row.userId,
    name: row.name,
    company: row.company,
    email: row.email,
    linkedin: row.linkedin,
    notes: row.notes,
    linkedLeads: row.linked_leads ?? row.linkedLeads,
    activityHistory: row.activity_history ?? row.activityHistory,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
  };
};

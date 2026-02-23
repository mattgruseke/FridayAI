"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import api from "../api/client";
import { useToast } from "../hooks/useToast";
import { getErrorMessage } from "../lib/errors";
import NoteEditor from "../components/NoteEditor";

type NoteEntry = {
  id: string;
  text: string;
  createdAt: string;
};

const parseNotes = (raw: string): NoteEntry[] => {
  if (!raw || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch { /* fall through to legacy */ }
  return raw.split('\n\n').filter(s => s.trim()).map(entry => {
    const match = entry.match(/^\[(.+?)\]\s*([\s\S]*)/);
    if (match) {
      const parsed = new Date(match[1]);
      return {
        id: crypto.randomUUID(),
        text: match[2],
        createdAt: isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString(),
      };
    }
    return { id: crypto.randomUUID(), text: entry, createdAt: new Date().toISOString() };
  });
};

const serializeNotes = (entries: NoteEntry[]): string =>
  entries.length > 0 ? JSON.stringify(entries) : '';

type Referral = {
  _id: string;
  name?: string;
  company?: string;
  email?: string;
  linkedin?: string;
  notes?: string;
  linkedLeads?: string[];
};

type UserLead = {
  _id: string;
  leadId?:
    | { _id?: string; title?: string; company?: string; location?: string }
    | string;
  currentStatus?: string;
};

const ReferralDetail = () => {
  const params = useParams() || {};
  const router = useRouter();
  const searchParams = useSearchParams();
  const referralParam = (params as { referralId?: string | string[] })
    .referralId;
  const referralId = Array.isArray(referralParam)
    ? referralParam[0]
    : referralParam;
  const isNewReferral = referralId === "new";

  // Get linkLeadId from navigation state (when coming from LeadDetail)
  const linkLeadFromState = searchParams?.get("linkLeadId");
  const leadPageId = searchParams?.get("leadPageId");
  const leadTitleFromState = searchParams?.get("leadTitle");
  const leadCompanyFromState = searchParams?.get("leadCompany");
  const { showToast, ToastComponent } = useToast();

  const [referral, setReferral] = useState<Referral | null>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [linkedLeads, setLinkedLeads] = useState<UserLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [noteEntries, setNoteEntries] = useState<NoteEntry[]>([]);
  const [newNote, setNewNote] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);
  const savingNoteRef = useRef(false);

  // Modal state for linking leads
  const [showLinkLeadModal, setShowLinkLeadModal] = useState(false);
  const [availableLeads, setAvailableLeads] = useState<UserLead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!referralId) {
      setError("Missing referral id.");
      setLoading(false);
      return;
    }
    if (!isNewReferral) {
      fetchReferralData();
    } else {
      setLoading(false);
    }
  }, [referralId]);

  const fetchReferralData = async () => {
    try {
      if (!referralId) {
        return;
      }
      setLoading(true);
      const referralData = (await api.referrals.getById(
        referralId,
      )) as Referral;
      setReferral(referralData);
      setName(referralData.name || "");
      setCompany(referralData.company || "");
      setEmail(referralData.email || "");
      setLinkedin(referralData.linkedin || "");
      setNoteEntries(parseNotes(referralData.notes || ""));

      // Fetch linked leads details
      if (referralData.linkedLeads && referralData.linkedLeads.length > 0) {
        const leadsData = (await Promise.all(
          referralData.linkedLeads.map((leadId) =>
            api.userLeads.getById(leadId),
          ),
        )) as UserLead[];
        setLinkedLeads(leadsData.filter(Boolean));
      } else {
        setLinkedLeads([]); // Reset if no linked leads
      }

      // Fetch activity
      const activityData = (await api.referrals.getActivity(
        referralId,
      )) as any[];
      setActivity(activityData || []);
    } catch (err) {
      setError(getErrorMessage(err));
      console.error("Error fetching referral:", err);
      showToast(`Error loading referral: ${getErrorMessage(err)}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveReferral = async () => {
    try {
      if (!name.trim()) {
        showToast("Please enter a name", "error");
        return;
      }

      // Include linked lead from state if coming from LeadDetail
      const linkedLeadsArray = referral?.linkedLeads || [];
      if (
        isNewReferral &&
        linkLeadFromState &&
        !linkedLeadsArray.includes(linkLeadFromState)
      ) {
        linkedLeadsArray.push(linkLeadFromState);
      }

      const referralData = {
        name: name.trim(),
        company: company.trim(),
        email: email.trim(),
        linkedin: linkedin.trim(),
        notes: serializeNotes(noteEntries),
        linkedLeads: linkedLeadsArray,
      };

      if (isNewReferral) {
        const newReferral = await api.referrals.create(referralData);

        // Log activity on the linked user_lead when coming from LeadDetail
        if (linkLeadFromState) {
          await api.userLeads.update(linkLeadFromState, {
            activityNote: `Referral added: ${name.trim()}`,
            activityAction: 'referral_linked',
          });
        }

        showToast("Referral saved successfully", "success");
        if (leadPageId) {
          router.replace(`/leads/${leadPageId}`);
        } else {
          router.replace(`/referrals/${newReferral._id}`);
        }
      } else {
        await api.referrals.update(referralId, referralData);
        showToast("Referral updated successfully", "success");
        fetchReferralData();
      }
    } catch (err) {
      console.error("Error saving referral:", err);
      showToast(`Error saving referral: ${getErrorMessage(err)}`, "error");
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || savingNoteRef.current) return;
    savingNoteRef.current = true;

    const entry: NoteEntry = {
      id: crypto.randomUUID(),
      text: newNote.trim(),
      createdAt: new Date().toISOString(),
    };
    const updated = [...noteEntries, entry];
    setNoteEntries(updated);
    setNewNote("");
    setIsAddingNote(false);

    try {
      await api.referrals.update(referralId, { notes: serializeNotes(updated) });
      showToast("Note added!", "success");
    } catch (err) {
      showToast(`Error adding note: ${getErrorMessage(err)}`, "error");
    }
    savingNoteRef.current = false;
  };

  const handleCancelAddNote = () => {
    setNewNote("");
    setIsAddingNote(false);
  };

  const handleLinkLead = async () => {
    if (!selectedLeadId) {
      showToast("Please select a lead", "error");
      return;
    }

    try {
      const updatedLinkedLeads = [
        ...(referral?.linkedLeads || []),
        selectedLeadId,
      ];
      await api.referrals.update(referralId, {
        linkedLeads: updatedLinkedLeads,
      });
      showToast("Lead linked successfully", "success");
      setShowLinkLeadModal(false);
      setSelectedLeadId("");
      fetchReferralData();
    } catch (err) {
      console.error("Error linking lead:", err);
      showToast(`Error linking lead: ${getErrorMessage(err)}`, "error");
    }
  };

  const handleUnlinkLead = async (leadId: string) => {
    try {
      const updatedLinkedLeads = (referral?.linkedLeads || []).filter(
        (id) => id !== leadId,
      );
      await api.referrals.update(referralId, {
        linkedLeads: updatedLinkedLeads,
      });
      showToast("Lead unlinked successfully", "success");
      fetchReferralData();
    } catch (err) {
      console.error("Error unlinking lead:", err);
      showToast(`Error unlinking lead: ${getErrorMessage(err)}`, "error");
    }
  };

  const openLinkLeadModal = async () => {
    try {
      // Fetch all saved leads
      const userLeads = (await api.userLeads.getAll()) as UserLead[];
      // Filter out already linked leads
      const alreadyLinkedIds = new Set(referral?.linkedLeads || []);
      const available = userLeads.filter(
        (lead) => !alreadyLinkedIds.has(lead._id),
      );
      setAvailableLeads(available);
      setSearchQuery(""); // Reset search when opening modal
      setSelectedLeadId(""); // Reset selection
      setShowLinkLeadModal(true);
    } catch (err) {
      console.error("Error fetching leads:", err);
      showToast(`Error loading leads: ${getErrorMessage(err)}`, "error");
    }
  };

  // Filter available leads based on search query
  const filteredLeads = availableLeads.filter((lead) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const title = lead.leadId?.title?.toLowerCase() || "";
    const company = lead.leadId?.company?.toLowerCase() || "";
    const location = lead.leadId?.location?.toLowerCase() || "";
    return (
      title.includes(query) ||
      company.includes(query) ||
      location.includes(query)
    );
  });

  if (loading) {
    return (
      <div className="container">
        <div className="main">
          <div className="page-title">Loading...</div>
        </div>
      </div>
    );
  }

  if (error && !isNewReferral) {
    return (
      <div className="container">
        <div className="main">
          <div className="page-title">Error</div>
          <p>{error}</p>
          <button onClick={() => router.push("/referrals")} className="btn">
            Back to Referrals
          </button>
        </div>
        <ToastComponent />
      </div>
    );
  }

  return (
    <div className="container">
      <div className="main">
        <div className="page-header">
          <button
            onClick={() => router.push("/referrals")}
            className="btn-back"
          >
            ← Back to Referrals
          </button>
          <div className="page-title">
            {isNewReferral ? "Add New Referral" : "Referral Details"}
          </div>
        </div>

        <div className="referral-detail-content">
          <div className="main-col">
            {/* Show linked lead notice when coming from LeadDetail */}
            {isNewReferral && linkLeadFromState && (
              <div className="linked-lead-notice">
                This referral will be linked to:{" "}
                <strong>{leadTitleFromState}</strong> at{" "}
                <strong>{leadCompanyFromState}</strong>
              </div>
            )}

            {/* Basic Information */}
            <div className="section">
              <div className="section-title">Basic Information</div>

              <div className="form-group">
                <label htmlFor="name">Name *</label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter referral name"
                />
              </div>

              <div className="form-group">
                <label htmlFor="company">Company</label>
                <input
                  id="company"
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Enter company name"
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email address"
                />
              </div>

              <div className="form-group">
                <label htmlFor="linkedin">LinkedIn</label>
                <input
                  id="linkedin"
                  type="url"
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                  placeholder="https://linkedin.com/in/..."
                />
              </div>

              <div className="form-actions">
                <button
                  onClick={handleSaveReferral}
                  className="btn btn-primary"
                >
                  {isNewReferral ? "Add Referral" : "Save Changes"}
                </button>
              </div>
            </div>

            {/* Notes Section */}
            {!isNewReferral && (
              <div className="section">
                <div className="section-title">Notes</div>
                {isAddingNote ? (
                  <div className="add-note">
                    <NoteEditor
                      content={newNote}
                      onChange={setNewNote}
                      placeholder="Write your note..."
                    />
                    <div className="note-edit-actions">
                      <button className="btn btn-primary" onClick={handleAddNote}>Save</button>
                      <button className="btn" onClick={handleCancelAddNote}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button className="btn btn-primary" onClick={() => setIsAddingNote(true)} style={{ marginBottom: 8 }}>
                    Add Note
                  </button>
                )}
                {[...noteEntries].reverse().map((entry) => (
                  <div key={entry.id} className="note-entry">
                    <div className="note-date">
                      {new Date(entry.createdAt).toLocaleString()}
                    </div>
                    <NoteEditor content={entry.text} onChange={() => {}} editable={false} />
                  </div>
                ))}
              </div>
            )}

            {/* Linked Leads */}
            {!isNewReferral && (
              <div className="section">
                <div className="section-title">Linked Leads</div>
                <button
                  onClick={openLinkLeadModal}
                  className="btn"
                  style={{ marginBottom: "12px" }}
                >
                  Link Lead
                </button>

                {linkedLeads.length > 0 ? (
                  <div className="linked-leads-list">
                    {linkedLeads.map((lead) => (
                      <div key={lead._id} className="linked-lead-item">
                        <div className="linked-lead-info">
                          <div className="linked-lead-title">
                            <a
                              href={`/leads/${lead.leadId?._id || lead.leadId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {lead.leadId?.title || "Unknown Position"}
                            </a>
                          </div>
                          <div className="linked-lead-company">
                            {lead.leadId?.company || "Unknown Company"} •{" "}
                            {lead.currentStatus || "No status"}
                          </div>
                        </div>
                        <button
                          onClick={() => handleUnlinkLead(lead._id)}
                          className="btn-unlink"
                          title="Unlink this lead"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty-message">
                    No linked leads yet. Click "Link Lead" to connect this
                    referral to your job applications.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Side Column - Activity */}
          {!isNewReferral && (
            <div className="side-col">
              <div className="section">
                <div className="section-title">Activity & Timeline</div>
                {activity.length > 0 ? (
                  activity.map((item, index) => (
                    <div key={index} className="activity-item">
                      <div className="activity-meta">
                        {new Date(item.createdAt).toLocaleString()} |{" "}
                        {item.action.replace("_", " ")}
                      </div>
                      <div className="activity-text">{item.description}</div>
                    </div>
                  ))
                ) : (
                  <div className="activity-item">
                    <div className="activity-text">No activity yet.</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Link Lead Modal */}
      {showLinkLeadModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowLinkLeadModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Link Lead</h3>
              <button
                className="modal-close"
                onClick={() => setShowLinkLeadModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-instruction">
                Search and select a lead from your pipeline to link to this
                referral
              </p>

              <label htmlFor="lead-search">Search Leads</label>
              <input
                id="lead-search"
                type="text"
                className="modal-input"
                placeholder="Search by position, company, or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />

              <label
                htmlFor="lead-select"
                style={{ marginTop: "12px", display: "block" }}
              >
                Select Lead ({filteredLeads.length} available)
              </label>
              <select
                id="lead-select"
                className="modal-select"
                value={selectedLeadId}
                onChange={(e) => setSelectedLeadId(e.target.value)}
                size={8}
              >
                <option value="">-- Select a lead --</option>
                {filteredLeads.map((lead) => (
                  <option key={lead._id} value={lead._id}>
                    {lead.leadId?.title || "Unknown"} -{" "}
                    {lead.leadId?.company || "Unknown Company"} -{" "}
                    {lead.leadId?.location || "N/A"}
                  </option>
                ))}
              </select>

              {filteredLeads.length === 0 && availableLeads.length > 0 && (
                <p
                  style={{
                    fontSize: "9pt",
                    color: "#999999",
                    marginTop: "8px",
                    fontStyle: "italic",
                  }}
                >
                  No leads match your search. Try a different query.
                </p>
              )}

              {availableLeads.length === 0 && (
                <p
                  style={{
                    fontSize: "9pt",
                    color: "#999999",
                    marginTop: "8px",
                    fontStyle: "italic",
                  }}
                >
                  No available leads to link. All leads in your pipeline are
                  already linked.
                </p>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn"
                onClick={() => setShowLinkLeadModal(false)}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleLinkLead}>
                Link Lead
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastComponent />
    </div>
  );
};

export default ReferralDetail;

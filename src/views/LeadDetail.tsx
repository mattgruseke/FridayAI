// Updated LeadDetail.jsx component with proper status handling
// Place this in: src/pages/LeadDetail.jsx

"use client";

import { useState, useEffect, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '../api/client';
import { useToast } from '../hooks/useToast';
import PublishLeadModal from '../components/PublishLeadModal';
import type { PublishLeadMode } from '../components/PublishLeadModal';
import { getErrorMessage } from '../lib/errors';
import NoteEditor from '../components/NoteEditor';
import CompanyLogo from '../components/CompanyLogo';

type Lead = {
  _id?: string;
  title?: string;
  company?: string;
  location?: string;
  team?: string;
  compensation?: { raw?: string; min?: number; max?: number };
  industry?: string;
  datePosted?: string;
  contactName?: string;
  contactEmail?: string;
  contactLinkedIn?: string;
  sourceApplicationLink?: string;
  sourceLink?: string;
  isGlobal?: boolean;
};

type UserLead = {
  _id: string;
  leadId?: string | Lead;
  priority?: string;
  notes?: string;
  currentStatus?: string;
  location?: string;
  compensation?: { raw?: string };
  sourceApplicationLink?: string;
  userContactName?: string;
  userContactEmail?: string;
  userContactLinkedIn?: string;
  additionalEmails?: string[];
  additionalLinks?: { title?: string; url?: string }[];
};

type Referral = {
  _id: string;
  name?: string;
  company?: string;
  email?: string;
  linkedLeads?: string[];
};

type NoteEntry = {
  id: string;
  text: string;
  createdAt: string;
};

const parseNotes = (raw: string): NoteEntry[] => {
  if (!raw || !raw.trim()) return [];
  // Try new JSON format first
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch { /* not JSON, fall through to legacy parsing */ }
  // Legacy string format: "[date] text" separated by double newlines
  return raw.split('\n\n').filter(s => s.trim()).map(entry => {
    const match = entry.match(/^\[(.+?)\]\s*([\s\S]*)/);
    if (match) {
      const dateStr = match[1];
      const parsed = new Date(dateStr);
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

const LeadDetail = () => {
  const params = useParams() || {};
  const router = useRouter();
  const leadParam = (params as { leadId?: string | string[] }).leadId;
  const leadId = Array.isArray(leadParam) ? leadParam[0] : leadParam;
  const isNewLead = leadId === 'new';
  const { showToast, toastElement } = useToast();
  const addLeadBtnRef = useRef<HTMLButtonElement | null>(null);

  const [lead, setLead] = useState<Lead | null>(null);
  const [userLead, setUserLead] = useState<UserLead | null>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [referral, setReferral] = useState<Referral | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [priority, setPriority] = useState('medium');
  const [status, setStatus] = useState<string | null>(null);
  const [noteEntries, setNoteEntries] = useState<NoteEntry[]>([]);
  const [newNote, setNewNote] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  // Edit mode state
  const [isEditingBasic, setIsEditingBasic] = useState(false);
  const [isEditingTracking, setIsEditingTracking] = useState(false);
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [isEditingYourContacts, setIsEditingYourContacts] = useState(false);

  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [dontShowImportModal, setDontShowImportModal] = useState(false);

  // Publish lead modal state
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishMode, setPublishMode] = useState<PublishLeadMode>(null); // 'rejected' or 'offer_accepted'
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  // Link referral modal state
  const [showLinkReferralModal, setShowLinkReferralModal] = useState(false);
  const [availableReferrals, setAvailableReferrals] = useState<Referral[]>([]);
  const [selectedReferralId, setSelectedReferralId] = useState('');
  const [referralSearchQuery, setReferralSearchQuery] = useState('');

  // Contact email compose modal
  const [contactEmailDraft, setContactEmailDraft] = useState<{ to: string; subject: string; body: string } | null>(null);
  const [contactEmailSending, setContactEmailSending] = useState(false);
  const [contactEmailSent, setContactEmailSent] = useState(false);

  // Network connections (LinkedIn matches)
  type NetworkConnection = { name: string; linkedinUrl: string | null; email: string | null };
  const [networkConnections, setNetworkConnections] = useState<NetworkConnection[]>([]);

  // Track initial values to detect changes
  const [initialValues, setInitialValues] = useState<any | null>(null);

  // Publish to public database state (for new leads only)
  const [publishToPublic, setPublishToPublic] = useState(false);

  const updateLead = (updates: Partial<Lead>) => {
    setLead((prev) => ({ ...(prev || {}), ...updates }));
  };

  const updateUserLead = (updates: Partial<UserLead>) => {
    setUserLead((prev) => prev ? { ...prev, ...updates } : prev);
  };

  // Snapshots for cancel/revert
  const [leadSnapshot, setLeadSnapshot] = useState<Lead | null>(null);
  const [userLeadSnapshot, setUserLeadSnapshot] = useState<UserLead | null>(null);

  const handleStartEdit = (section: 'basic' | 'tracking' | 'contact' | 'yourContacts') => {
    if (section === 'basic' || section === 'contact') {
      setLeadSnapshot({ ...(lead || {}) });
      if (section === 'basic') setIsEditingBasic(true);
      else setIsEditingContact(true);
    } else {
      setUserLeadSnapshot(userLead ? { ...userLead } : null);
      if (section === 'tracking') setIsEditingTracking(true);
      else setIsEditingYourContacts(true);
    }
  };

  const handleCancelEdit = (section: 'basic' | 'tracking' | 'contact' | 'yourContacts') => {
    if (section === 'basic' || section === 'contact') {
      if (leadSnapshot) setLead(leadSnapshot);
      setLeadSnapshot(null);
      if (section === 'basic') setIsEditingBasic(false);
      else setIsEditingContact(false);
    } else {
      if (userLeadSnapshot) setUserLead(userLeadSnapshot);
      setUserLeadSnapshot(null);
      if (section === 'tracking') setIsEditingTracking(false);
      else setIsEditingYourContacts(false);
    }
  };

  const handleSaveSection = async (section: 'basic' | 'tracking' | 'contact' | 'yourContacts') => {
    if (!userLead) return;
    try {
      if (section === 'basic') {
        if (!lead?._id) return;
        await api.leads.update(lead._id, {
          title: lead.title,
          company: lead.company,
          team: lead.team,
          industry: lead.industry,
          location: lead.location,
          compensation: lead.compensation,
          datePosted: lead.datePosted,
          sourceLink: lead.sourceLink,
        });
        setLeadSnapshot(null);
        setIsEditingBasic(false);
      } else if (section === 'tracking') {
        await api.userLeads.update(userLead._id, {
          location: userLead.location,
          compensation: userLead.compensation,
          sourceApplicationLink: userLead.sourceApplicationLink,
        });
        setUserLeadSnapshot(null);
        setIsEditingTracking(false);
      } else if (section === 'contact') {
        if (!lead?._id) return;
        await api.leads.update(lead._id, {
          contactName: lead.contactName,
          contactEmail: lead.contactEmail,
          contactLinkedIn: lead.contactLinkedIn,
        });
        setLeadSnapshot(null);
        setIsEditingContact(false);
      } else if (section === 'yourContacts') {
        await api.userLeads.update(userLead._id, {
          userContactName: userLead.userContactName,
          userContactEmail: userLead.userContactEmail,
          userContactLinkedIn: userLead.userContactLinkedIn,
          additionalEmails: userLead.additionalEmails?.filter((e: string) => e.trim()) || [],
          additionalLinks: userLead.additionalLinks?.filter((l: { url?: string }) => l.url?.trim()) || [],
        });
        setUserLeadSnapshot(null);
        setIsEditingYourContacts(false);
      }
      setInitialValues({ lead: { ...lead }, priority, notes: serializeNotes(noteEntries) });
      showToast('Changes saved', 'success');
    } catch (err) {
      showToast(`Error saving: ${getErrorMessage(err)}`, 'error');
    }
  };

  // --- Job board parsers by domain ---
  type ParsedJob = { title: string; company: string; location: string; compensation: string; datePosted: string };

  const parseAshby = (html: string, doc: Document): ParsedJob | null => {
    // Ashby embeds JSON-LD JobPosting structured data
    const jsonLdScripts = doc.querySelectorAll('script[type="application/ld+json"]');
    for (const script of jsonLdScripts) {
      try {
        const data = JSON.parse(script.textContent || '');
        const jobPosting = data['@type'] === 'JobPosting' ? data
          : Array.isArray(data) ? data.find((d: Record<string, unknown>) => d['@type'] === 'JobPosting')
            : null;
        if (!jobPosting) continue;

        const title = jobPosting.title || '';
        const company = jobPosting.hiringOrganization?.name || '';

        let location = '';
        const jobLoc = jobPosting.jobLocation;
        if (jobLoc) {
          const addr = Array.isArray(jobLoc) ? jobLoc[0]?.address : jobLoc.address;
          const parts = [addr?.addressLocality, addr?.addressRegion, addr?.addressCountry].filter(Boolean);
          location = parts.join(', ');
        }
        if (jobPosting.jobLocationType === 'TELECOMMUTE') {
          location = location ? `${location} - Remote` : 'Remote';
        }

        let compensation = '';
        const salary = jobPosting.baseSalary;
        if (salary?.value) {
          const min = salary.value.minValue;
          const max = salary.value.maxValue;
          const currency = salary.currency || 'USD';
          if (min && max) {
            const fmt = (n: number) => currency === 'USD' ? `$${(n / 1000).toFixed(0)}K` : `${n.toLocaleString()} ${currency}`;
            compensation = `${fmt(min)} - ${fmt(max)}`;
          } else if (min || max) {
            const val = min || max;
            compensation = currency === 'USD' ? `$${(val / 1000).toFixed(0)}K` : `${val.toLocaleString()} ${currency}`;
          }
        }
        if (!compensation) {
          const ashbyMatch = html.match(/"compensationTierSummary"\s*:\s*"([^"]+)"/);
          if (ashbyMatch) compensation = ashbyMatch[1];
        }

        return { title, company, location, compensation, datePosted: jobPosting.datePosted || '' };
      } catch { /* continue */ }
    }
    return null;
  };

  const parseGreenhouse = (html: string): ParsedJob | null => {
    // Greenhouse is a Remix SPA — job data lives in window.__remixContext
    const remixMatch = html.match(/window\.__remixContext\s*=\s*(\{.+?\});?\s*<\/script>/s);
    if (!remixMatch) return null;

    try {
      const ctx = JSON.parse(remixMatch[1]);
      const loaderData = ctx?.state?.loaderData;
      if (!loaderData) return null;

      // Find the route key that contains jobPost
      const routeKey = Object.keys(loaderData).find(k => loaderData[k]?.jobPost);
      const jobPost = routeKey ? loaderData[routeKey].jobPost : null;
      if (!jobPost) return null;

      const title = jobPost.title || '';
      const company = jobPost.company_name || '';
      const location = jobPost.job_post_location || '';

      let compensation = '';
      const payRanges = jobPost.pay_ranges;
      if (Array.isArray(payRanges) && payRanges.length > 0) {
        const range = payRanges[0];
        if (range.min_cents != null && range.max_cents != null) {
          const min = range.min_cents / 100;
          const max = range.max_cents / 100;
          const currency = range.currency_type || 'USD';
          const fmt = (n: number) => currency === 'USD' ? `$${(n / 1000).toFixed(0)}K` : `${n.toLocaleString()} ${currency}`;
          compensation = `${fmt(min)} - ${fmt(max)}`;
        }
      }

      return { title, company, location, compensation, datePosted: jobPost.published_at || '' };
    } catch {
      return null;
    }
  };

  const parseGenericDOM = (html: string, url: string, doc: Document): ParsedJob => {
    // JSON-LD fallback for any site
    const jsonLdScripts = doc.querySelectorAll('script[type="application/ld+json"]');
    for (const script of jsonLdScripts) {
      try {
        const data = JSON.parse(script.textContent || '');
        const jobPosting = data['@type'] === 'JobPosting' ? data
          : Array.isArray(data) ? data.find((d: Record<string, unknown>) => d['@type'] === 'JobPosting')
            : null;
        if (jobPosting) {
          const result = parseAshby(html, doc);
          if (result) return result;
        }
      } catch { /* continue */ }
    }

    // DOM-based fallback
    let title = doc.querySelector('h1')?.textContent?.trim() ||
      doc.querySelector('h2')?.textContent?.trim() ||
      doc.querySelector('[class*="title"]')?.textContent?.trim() || '';

    let company = doc.querySelector('[class*="company"]')?.textContent?.trim() ||
      doc.querySelector('[class*="Company"]')?.textContent?.trim() ||
      doc.querySelector('[class*="employer"]')?.textContent?.trim() || '';
    if (!company) {
      const urlMatch = url.match(/\/\/([^.\/]+)\./);
      if (urlMatch && urlMatch[1]) {
        company = urlMatch[1].charAt(0).toUpperCase() + urlMatch[1].slice(1);
      }
    }

    let location = doc.querySelector('[class*="location"]')?.textContent?.trim() ||
      doc.querySelector('[class*="Location"]')?.textContent?.trim() ||
      doc.querySelector('[class*="office"]')?.textContent?.trim() || '';
    if (!location) {
      const bodyText = doc.body?.textContent || '';
      if (/\b(remote|work from home|wfh)\b/i.test(bodyText)) location = 'Remote';
    }
    if (!location || location.length > 100) {
      const urlLocationMatch = url.match(/\/(usa|us|remote|anywhere|global)[\-_]?(remote|anywhere)?/i);
      if (urlLocationMatch) {
        const parts = urlLocationMatch[0].split(/[\-_\/]/).filter(p => p && p !== 'co');
        location = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
      }
    }
    if (location && location.length > 100) location = '';

    let compensation = '';
    const compElements = doc.querySelectorAll('*');
    for (let el of compElements) {
      const text = el.textContent;
      if (text && (text.includes('$') || text.includes('salary') || text.includes('compensation'))) {
        const match = text.match(/\$[\d,]+(k|K)?\s*-?\s*\$?[\d,]+(k|K)?/);
        if (match) { compensation = match[0]; break; }
      }
    }

    let datePosted = '';
    const dateElements = doc.querySelectorAll('[class*="date"], [class*="posted"], time');
    if (dateElements.length > 0) {
      const dateText = dateElements[0].textContent?.trim() || dateElements[0].getAttribute('datetime');
      if (dateText) {
        const date = new Date(dateText);
        if (!isNaN(date.getTime())) datePosted = date.toISOString().split('T')[0];
      }
    }

    return { title, company, location, compensation, datePosted };
  };

  // Domain → parser mapping
  const boardParsers: Record<string, (html: string, url: string, doc: Document) => ParsedJob | null> = {
    'jobs.ashbyhq.com': (html, _url, doc) => parseAshby(html, doc),
    'job-boards.greenhouse.io': (html) => parseGreenhouse(html),
  };

  const parseJobUrl = async (url: string) => {
    try {
      const response = await fetch('/api/parse-job-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      if (!response.ok) throw new Error('Failed to fetch job URL');

      const { html } = await response.json();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Match domain to a specific parser
      const hostname = new URL(url).hostname;
      const boardParser = boardParsers[hostname];
      if (boardParser) {
        const result = boardParser(html, url, doc);
        if (result) return result;
      }

      // Generic fallback (JSON-LD then DOM)
      return parseGenericDOM(html, url, doc);
    } catch (error) {
      console.error('Error parsing job URL:', error);
      showToast('Error parsing the job URL. Please check the URL and try again.', 'error');
      return null;
    }
  };

  const handleImportUrl = async () => {
    if (!importUrl.trim()) {
      showToast('Please enter a URL', 'error');
      return;
    }

    const jobData = await parseJobUrl(importUrl);
    if (jobData) {
      updateLead({
        title: (jobData.title || lead?.title || '').trim(),
        company: (jobData.company || lead?.company || '').trim(),
        location: (jobData.location || lead?.location || '').trim(),
        compensation: { raw: (jobData.compensation || lead?.compensation?.raw || '').trim() },
        datePosted: jobData.datePosted || lead?.datePosted,
        sourceApplicationLink: importUrl.trim()
      });
      setShowImportModal(false);
      setImportUrl('');
    }
  };

  useEffect(() => {
    if (!leadId) {
      setError('Missing lead id.');
      setLoading(false);
      return;
    }
    if (isNewLead) {
      // Initialize empty lead for new entry
      const emptyLead = {
        title: '',
        company: '',
        location: '',
        team: '',
        compensation: { raw: '' },
        industry: '',
        datePosted: '',
        contactName: '',
        contactEmail: '',
        contactLinkedIn: '',
        sourceApplicationLink: '',
        sourceLink: ''
      };
      setLead(emptyLead);
      setStatus('saved'); // Auto-set to saved for new leads

      // Capture initial values for new lead
      setInitialValues({
        lead: { ...emptyLead },
        priority: 'medium',
        notes: ''
      });

      // Auto-show import modal for new leads unless user opted out
      const skipImportModal = localStorage.getItem('skipImportModalOnNewLead') === 'true';
      if (!skipImportModal) {
        setShowImportModal(true);
      }

      setLoading(false);
    } else {
      fetchLeadDetails();
    }
  }, [leadId, isNewLead]);

  const fetchLeadDetails = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);

      // Fetch lead details
      const leadData = (await api.leads.getById(leadId)) as Lead;
      setLead(leadData);

      // Try to fetch user lead using the new by-lead endpoint
      try {
        const userLeadData = (await api.userLeads.getByLeadId(
          leadId
        )) as UserLead;
        setUserLead(userLeadData);
        setPriority(userLeadData.priority || 'medium');
        setStatus(userLeadData.currentStatus ?? null); // ✅ This now gets the correct status!
        setNoteEntries(parseNotes(userLeadData.notes || ''));

        // Capture initial values for change detection
        setInitialValues({
          lead: { ...leadData },
          priority: userLeadData.priority || 'medium',
          notes: userLeadData.notes || '' // stored as raw string for comparison
        });

        // Fetch activity using the ACTUAL userLead ID
        const activityData = (await api.userLeads.getActivity(
          userLeadData._id
        )) as any[];
        setActivity(activityData || []);

        // Fetch network connections (best-effort)
        try {
          const ncData = (await api.networkConnections.getByLeadId(leadId!)) as { connections: NetworkConnection[] };
          setNetworkConnections(ncData?.connections || []);
        } catch {
          setNetworkConnections([]);
        }

        // Fetch referral if this lead is linked to any referral
        try {
          const allReferrals = (await api.referrals.getAll()) as Referral[];
          const linkedReferral = allReferrals.find(
            (ref) =>
              Array.isArray(ref.linkedLeads) &&
              ref.linkedLeads.includes(userLeadData._id)
          );
          setReferral(linkedReferral || null);
        } catch (refErr) {
          console.log('No referral linked to this lead');
          setReferral(null);
        }
      } catch (err) {
        // Lead not saved yet, that's ok
        console.log('Lead not saved by user yet');
        // Keep default values
        setPriority('medium');
        setStatus(null);
        setNoteEntries([]);
        setActivity([]);

        // Capture initial values for new lead
        setInitialValues({
          lead: { ...leadData },
          priority: 'medium',
          notes: ''
        });
      }
    } catch (err) {
      setError(getErrorMessage(err));
      console.error('Error fetching lead:', err);
    } finally {
      setLoading(false);
    }
  };

  const hasChanges = () => {
    if (!initialValues || !lead) return false;

    // Check if lead fields have changed
    const leadChanged =
      lead.title !== initialValues.lead.title ||
      lead.company !== initialValues.lead.company ||
      lead.location !== initialValues.lead.location ||
      lead.team !== initialValues.lead.team ||
      lead.compensation?.raw !== initialValues.lead.compensation?.raw ||
      lead.industry !== initialValues.lead.industry ||
      lead.datePosted !== initialValues.lead.datePosted ||
      lead.contactName !== initialValues.lead.contactName ||
      lead.contactEmail !== initialValues.lead.contactEmail ||
      lead.contactLinkedIn !== initialValues.lead.contactLinkedIn ||
      lead.sourceApplicationLink !== initialValues.lead.sourceApplicationLink ||
      lead.sourceLink !== initialValues.lead.sourceLink;

    // Check if notes have changed (priority auto-saves now)
    const notesChanged = serializeNotes(noteEntries) !== initialValues.notes;

    return leadChanged || notesChanged;
  };

  const handleBackClick = async () => {
    if (hasChanges()) {
      // Auto-save if there are changes
      await handleSave();
    }
    router.back();
  };

  const handleSave = async () => {
    try {
      if (isNewLead) {
        // Disable the button via ref to prevent double-clicks without re-render
        if (addLeadBtnRef.current) {
          addLeadBtnRef.current.disabled = true;
        }
        // Create new lead first, then create userLead
        const newLeadData = {
          title: lead.title,
          company: lead.company,
          location: lead.location,
          team: lead.team,
          compensation: { raw: lead.compensation?.raw || '' },
          industry: lead.industry,
          datePosted: lead.datePosted || new Date(),
          contactName: lead.contactName,
          contactEmail: lead.contactEmail,
          contactLinkedIn: lead.contactLinkedIn,
          sourceApplicationLink: lead.sourceApplicationLink,
          sourceLink: lead.sourceLink,
          isGlobal: publishToPublic
        };

        const createdLead = (await api.leads.create(newLeadData)) as Lead;

        // Now create userLead with status 'saved'
        if (createdLead._id) {
          await api.userLeads.save({
            leadId: createdLead._id,
            priority,
            notes: serializeNotes(noteEntries),
            currentStatus: 'saved'
          });
        }

        showToast('Lead created and saved to pipeline!', 'success');
        if (createdLead._id) {
          router.push(`/leads/${createdLead._id}`);
        }
      } else if (userLead) {
        const serializedNotes = serializeNotes(noteEntries);
        await api.userLeads.update(userLead._id, { priority, notes: serializedNotes });

        // Update initial values to reflect saved state
        setInitialValues({
          lead: { ...(lead || {}) },
          priority,
          notes: serializedNotes
        });

        showToast('Changes saved!', 'success');
        fetchLeadDetails({ silent: true }); // Refresh to get latest data
      } else {
        // Create new userLead for existing lead
        if (lead?._id) {
          await api.userLeads.save({
            leadId: lead._id,
            priority,
            notes: serializeNotes(noteEntries)
          });
        }
        showToast('Lead saved to pipeline!', 'success');
        fetchLeadDetails(); // Refresh to get the new userLead
      }
    } catch (err) {
      showToast(`Error saving: ${getErrorMessage(err)}`, 'error');
    }
  };

  const handleStatusChange = async (e: ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;

    if (!userLead) {
      showToast('Please save the lead first', 'error');
      e.target.value = status || ''; // Reset dropdown
      return;
    }

    // Check if this status change should trigger a publish modal
    if (newStatus === 'rejected' || newStatus === 'archived' || newStatus === 'offer_accepted') {
      setPendingStatus(newStatus);
      setPublishMode(newStatus);
      setShowPublishModal(true);
      // Don't update status yet - wait for modal response
      e.target.value = status; // Reset dropdown temporarily
      return;
    }

    try {
      // Optimistically update UI
      setStatus(newStatus);

      // Make API call
      await api.userLeads.updateStatus(userLead._id, newStatus);

      // Refresh activity to show the status change in timeline
      await fetchLeadDetails({ silent: true });
    } catch (err) {
      showToast(`Error updating status: ${getErrorMessage(err)}`, 'error');
      // Revert on error
      setStatus(status);
      e.target.value = status || ''; // Reset dropdown on error
    }
  };

  const handlePublishConfirm = async () => {
    setIsPublishing(true);
    try {
      if (!userLead || !pendingStatus || !publishMode) {
        setIsPublishing(false);
        return;
      }
      // First update the status
      await api.userLeads.updateStatus(userLead._id, pendingStatus);
      setStatus(pendingStatus);

      // Then publish based on mode
      if (publishMode === 'rejected' || publishMode === 'archived') {
        // Publish single lead
        if (lead?._id) {
          await api.publish.publishSingle(lead._id);
        }
        showToast('Lead published to public database!', 'success');
      } else if (publishMode === 'offer_accepted') {
        // Publish all leads
        const result = (await api.publish.publishAll()) as { count?: number };
        showToast(`${result.count} lead(s) published to public database!`, 'success');
      }

      // Refresh and close modal
      await fetchLeadDetails({ silent: true });
      setShowPublishModal(false);
      setPendingStatus(null);
      setPublishMode(null);
    } catch (err) {
      showToast(`Error: ${getErrorMessage(err)}`, 'error');
    } finally {
      setIsPublishing(false);
    }
  };

  const handlePublishDecline = async () => {
    // User declined to publish, but still update the status
    try {
      if (userLead && pendingStatus) {
        await api.userLeads.updateStatus(userLead._id, pendingStatus);
      }
      setStatus(pendingStatus);
      await fetchLeadDetails({ silent: true });
      showToast('Status updated', 'success');
    } catch (err) {
      showToast(`Error updating status: ${getErrorMessage(err)}`, 'error');
    }
    setShowPublishModal(false);
    setPendingStatus(null);
    setPublishMode(null);
  };

  const handlePriorityChange = async (e: ChangeEvent<HTMLSelectElement>) => {
    const newPriority = e.target.value;

    if (!userLead) {
      showToast('Please save the lead first', 'error');
      e.target.value = priority; // Reset dropdown
      return;
    }

    try {
      // Optimistically update UI
      setPriority(newPriority);

      // Make API call
      await api.userLeads.update(userLead._id, {
        priority: newPriority,
        activityNote: `Priority changed to ${newPriority}`,
        activityAction: 'priority_change',
      });

      // Update initial values to reflect the saved priority
      setInitialValues((prev) =>
        prev
          ? {
            ...prev,
            priority: newPriority
          }
          : prev
      );

      // Show success feedback
      showToast('Priority updated!', 'success');

      // Refresh to get latest data
      await fetchLeadDetails({ silent: true });
    } catch (err) {
      showToast(`Error updating priority: ${getErrorMessage(err)}`, 'error');
      // Revert on error
      setPriority(priority);
      e.target.value = priority; // Reset dropdown on error
    }
  };

  const savingNoteRef = useRef(false);
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
    setNewNote('');
    setIsAddingNote(false);

    if (userLead) {
      try {
        await api.userLeads.update(userLead._id, {
          notes: serializeNotes(updated),
          activityNote: 'Note added',
          activityAction: 'note_added',
        });
        // Refresh just the activity timeline
        const activityData = (await api.userLeads.getActivity(userLead._id)) as any[];
        setActivity(activityData || []);
        showToast('Note added!', 'success');

      } catch (err) {
        showToast(`Error saving note: ${getErrorMessage(err)}`, 'error');
      }
    }
    savingNoteRef.current = false;
  };

  const handleCancelAddNote = () => {
    setNewNote('');
    setIsAddingNote(false);
  };

  const handleEditNote = (noteId: string) => {
    const note = noteEntries.find(n => n.id === noteId);
    if (note) {
      setEditingNoteId(noteId);
      setEditingNoteText(note.text);
    }
  };

  const handleSaveNoteEdit = async () => {
    if (!editingNoteId) return;

    const updated = noteEntries.map(n =>
      n.id === editingNoteId ? { ...n, text: editingNoteText } : n
    );
    setNoteEntries(updated);
    setEditingNoteId(null);
    setEditingNoteText('');

    if (userLead) {
      try {
        await api.userLeads.update(userLead._id, { notes: serializeNotes(updated) });
        showToast('Note updated!', 'success');
      } catch (err) {
        showToast(`Error saving note: ${getErrorMessage(err)}`, 'error');
      }
    }
  };

  const handleCancelNoteEdit = () => {
    setEditingNoteId(null);
    setEditingNoteText('');
  };

  const handleReadOnlyClick = (_section: string) => {
    // No-op: pencil icon is self-explanatory
  };

  const handleDelete = async () => {
    if (!userLead) {
      router.push('/leads');
      return;
    }

    if (window.confirm('Remove this lead from your pipeline?')) {
      try {
        await api.userLeads.remove(userLead._id);
        showToast('Lead removed from pipeline', 'success');
        router.push('/pipeline');
      } catch (err) {
        showToast(`Error deleting: ${getErrorMessage(err)}`, 'error');
      }
    }
  };

  const openLinkReferralModal = async () => {
    try {
      const allReferrals = (await api.referrals.getAll()) as Referral[];
      // Filter out the already linked referral if one exists
      const available = referral
        ? allReferrals.filter((ref) => ref._id !== referral._id)
        : allReferrals;
      setAvailableReferrals(available);
      setReferralSearchQuery('');
      setSelectedReferralId('');
      setShowLinkReferralModal(true);
    } catch (err) {
      console.error('Error fetching referrals:', err);
      showToast(`Error loading referrals: ${getErrorMessage(err)}`, 'error');
    }
  };

  const handleLinkReferral = async () => {
    if (!selectedReferralId) {
      showToast('Please select a referral', 'error');
      return;
    }

    try {
      // Get the selected referral and add this userLead to its linkedLeads
      const selectedRef = availableReferrals.find(
        (ref) => ref._id === selectedReferralId
      );
      if (!selectedRef || !userLead) {
        showToast('Please select a referral', 'error');
        return;
      }
      const updatedLinkedLeads = [
        ...(selectedRef.linkedLeads || []),
        userLead._id,
      ];
      await api.referrals.update(selectedReferralId, { linkedLeads: updatedLinkedLeads });

      // Log activity on the user_lead
      await api.userLeads.update(userLead._id, {
        activityNote: `Referral linked: ${selectedRef.name}`,
        activityAction: 'referral_linked',
      });

      showToast('Referral linked successfully', 'success');
      setShowLinkReferralModal(false);
      setSelectedReferralId('');

      // Refresh to show the linked referral
      fetchLeadDetails({ silent: true });
    } catch (err) {
      console.error('Error linking referral:', err);
      showToast(`Error linking referral: ${getErrorMessage(err)}`, 'error');
    }
  };

  function openContactEmailModal() {
    const name = userLead?.userContactName || '';
    const firstName = name.split(/[\s(]/)[0] || 'there';
    setContactEmailDraft({
      to: userLead?.userContactEmail || '',
      subject: `Following up on ${lead?.title || 'the role'} at ${lead?.company || 'your company'}`,
      body: [
        `Hi ${firstName},`,
        '',
        `I wanted to follow up regarding the ${lead?.title || 'role'} opening at ${lead?.company}. I'm very interested and wanted to reach out directly.`,
        '',
        'Looking forward to hearing from you!',
        '',
        'Best,',
      ].join('\n'),
    });
    setContactEmailSending(false);
    setContactEmailSent(false);
  }

  async function handleSendContactEmail() {
    if (!contactEmailDraft || !userLead?._id) return;
    setContactEmailSending(true);
    await new Promise((r) => setTimeout(r, 1500));
    const activityNote = `Email sent to ${contactEmailDraft.to}`;
    try {
      if (userLead.currentStatus === 'saved') {
        // Advance to Contacted; use email note as the history entry
        await api.userLeads.updateStatus(userLead._id, 'contacted', activityNote);
        setUserLead((prev) => prev ? { ...prev, currentStatus: 'contacted' } : prev);
        setStatus('contacted');
      } else {
        // Already past Saved — just log the activity, don't change status
        await api.userLeads.update(userLead._id, {
          activityNote,
          activityAction: 'email_sent',
        });
      }
      const activityData = (await api.userLeads.getActivity(userLead._id)) as any[];
      setActivity(activityData || []);
    } catch {}
    setContactEmailSending(false);
    setContactEmailSent(true);
  }

  const filteredReferrals = availableReferrals.filter(ref => {
    if (!referralSearchQuery) return true;
    const query = referralSearchQuery.toLowerCase();
    return (
      ref.name?.toLowerCase().includes(query) ||
      ref.company?.toLowerCase().includes(query) ||
      ref.email?.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <div className="main">
        <div className="page-title">Loading...</div>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="main">
        <div className="page-title">Error loading lead</div>
        <p>{error}</p>
        <button onClick={() => router.push('/leads')}>Back to Leads</button>
      </div>
    );
  }

  return (
    <div className="main">
      <div className="page-header">
        <button onClick={handleBackClick} className="back-link">← back</button>
        <div className="page-title-row">
          {!isNewLead && lead.company && <CompanyLogo company={lead.company} size={40} className="lead-detail-avatar" />}
          <div>
            <div className="page-title">{isNewLead ? 'Add New Lead' : lead.title}</div>
            {!isNewLead && <div className="page-subtitle">{lead.company}{lead.location ? ` | ${lead.location}` : ''}</div>}
          </div>
          {isNewLead && (
            <button className="btn btn-import" onClick={() => setShowImportModal(true)}>
              Import Lead from URL
            </button>
          )}
        </div>
      </div>

      {/* Contact Email Compose Modal */}
      {contactEmailDraft && (
        <div className="modal-overlay" onClick={() => !contactEmailSending && setContactEmailDraft(null)}>
          <div className="modal-content" style={{ width: 520, maxWidth: '96vw' }} onClick={(e) => e.stopPropagation()}>
            {contactEmailSent ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '24px 0' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2e7d32' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p style={{ fontWeight: 600, fontSize: '1.05rem', margin: 0 }}>Email Sent!</p>
                <p style={{ color: '#666', fontSize: 13, margin: 0 }}>Your message is on its way.</p>
                <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => setContactEmailDraft(null)}>Done</button>
              </div>
            ) : (
              <>
                <div className="modal-header">
                  <h3>Send Email</h3>
                  <button className="modal-close" onClick={() => setContactEmailDraft(null)}>×</button>
                </div>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #eee', padding: '8px 0' }}>
                    <span style={{ width: 54, flexShrink: 0, color: '#888', fontSize: 13 }}>To</span>
                    <input type="email" value={contactEmailDraft.to} onChange={(e) => setContactEmailDraft({ ...contactEmailDraft, to: e.target.value })} style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13 }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #eee', padding: '8px 0' }}>
                    <span style={{ width: 54, flexShrink: 0, color: '#888', fontSize: 13 }}>Subject</span>
                    <input type="text" value={contactEmailDraft.subject} onChange={(e) => setContactEmailDraft({ ...contactEmailDraft, subject: e.target.value })} style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13 }} />
                  </div>
                  <textarea
                    value={contactEmailDraft.body}
                    onChange={(e) => setContactEmailDraft({ ...contactEmailDraft, body: e.target.value })}
                    style={{ width: '100%', boxSizing: 'border-box', minHeight: 160, border: 'none', outline: 'none', fontSize: 13, resize: 'vertical', marginTop: 8, fontFamily: 'inherit' }}
                  />
                </div>
                <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button className="btn" onClick={() => setContactEmailDraft(null)} disabled={contactEmailSending}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleSendContactEmail} disabled={contactEmailSending}>
                    {contactEmailSending ? 'Sending...' : 'Send Email'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Import Lead from URL</h3>
              <button className="modal-close" onClick={() => setShowImportModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p className="modal-instruction">Copy and paste the link to the job application and click Import</p>
              <label htmlFor="import-url-input">Application URL</label>
              <input
                id="import-url-input"
                type="text"
                className="modal-input"
                placeholder="https://example.com/jobs/1234"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleImportUrl();
                  }
                }}
              />
              {isNewLead && (
                <label className="checkbox-label" style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '9pt', color: '#666' }}>
                  <input
                    type="checkbox"
                    checked={dontShowImportModal}
                    onChange={(e) => setDontShowImportModal(e.target.checked)}
                  />
                  Don't show this automatically
                </label>
              )}
            </div>
            <div className="modal-footer">
              {isNewLead ? (
                <>
                  <button className="btn" onClick={() => {
                    if (dontShowImportModal) {
                      localStorage.setItem('skipImportModalOnNewLead', 'true');
                    }
                    setShowImportModal(false);
                    setDontShowImportModal(false);
                  }}>Skip - Fill Manually</button>
                  <button className="btn btn-primary" onClick={() => {
                    if (dontShowImportModal) {
                      localStorage.setItem('skipImportModalOnNewLead', 'true');
                    }
                    handleImportUrl();
                  }}>Import</button>
                </>
              ) : (
                <>
                  <button className="btn" onClick={() => setShowImportModal(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleImportUrl}>Import</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="actions">
        <button
          ref={isNewLead ? addLeadBtnRef : null}
          className="btn btn-primary"
          onClick={handleSave}
        >
          {isNewLead ? 'Add Lead' : userLead ? 'Save Changes' : 'Save Lead'}
        </button>

        {userLead && (
          <button className="btn-trash" onClick={handleDelete} title="Remove from Pipeline">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        )}
      </div>
      {isNewLead && (
        <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', marginBottom: '8px', fontSize: '10pt' }}>
          <input
            type="checkbox"
            checked={publishToPublic}
            onChange={(e) => setPublishToPublic(e.target.checked)}
          />
          Publish this lead to the public database
        </label>
      )}

      {userLead && status && (
        <div className="lead-status-badge">
          <strong>Current Stage:</strong>{' '}
          <span style={{ textTransform: 'capitalize', background: 'var(--accent)', color: '#fff', padding: '2px 10px', borderRadius: '12px', fontWeight: 600, fontSize: '0.85em' }}>
            {status.replace(/_/g, ' ')}
          </span>
        </div>
      )}

      <div className="content-grid">
        <div className="main-col">
          <div className="section">
            {isNewLead ? (
              /* ── Add New form: all leads fields, no tracking ── */
              <>
                <div className="section-title">Job Information</div>
                <table className="form-table">
                  <tbody>
                    <tr>
                      <td>Company</td>
                      <td><input type="text" value={lead.company || ''} onChange={(e) => updateLead({ company: e.target.value })} placeholder="e.g. Acme Corp" /></td>
                    </tr>
                    <tr>
                      <td>Position</td>
                      <td><input type="text" value={lead.title || ''} onChange={(e) => updateLead({ title: e.target.value })} placeholder="e.g. Senior Software Engineer" /></td>
                    </tr>
                    <tr>
                      <td>Team</td>
                      <td><input type="text" value={lead.team || ''} onChange={(e) => updateLead({ team: e.target.value })} placeholder="e.g. Engineering" /></td>
                    </tr>
                    <tr>
                      <td>Industry</td>
                      <td><input type="text" value={lead.industry || ''} onChange={(e) => updateLead({ industry: e.target.value })} placeholder="e.g. Technology, Finance" /></td>
                    </tr>
                    <tr>
                      <td>Location</td>
                      <td><input type="text" value={lead.location || ''} onChange={(e) => updateLead({ location: e.target.value })} placeholder="e.g. San Francisco, CA or Remote" /></td>
                    </tr>
                    <tr>
                      <td>Compensation</td>
                      <td><input type="text" value={lead.compensation?.raw || ''} onChange={(e) => updateLead({ compensation: { raw: e.target.value } })} placeholder="e.g. $120k - $180k" /></td>
                    </tr>
                    <tr>
                      <td>Date Posted</td>
                      <td><input type="date" value={lead.datePosted || ''} onChange={(e) => updateLead({ datePosted: e.target.value })} /></td>
                    </tr>
                    <tr>
                      <td>Application URL</td>
                      <td><input type="text" value={lead.sourceApplicationLink || ''} onChange={(e) => updateLead({ sourceApplicationLink: e.target.value })} placeholder="https://..." /></td>
                    </tr>
                    <tr>
                      <td>Source URL</td>
                      <td><input type="text" value={lead.sourceLink || ''} onChange={(e) => updateLead({ sourceLink: e.target.value })} placeholder="https://..." /></td>
                    </tr>
                  </tbody>
                </table>
              </>
            ) : (
              /* ── Post-save: Job Posting + Your Tracking ── */
              <>
                {/* Job Posting sub-section */}
                <div className="section-title">
                  Job Posting
                  {!userLead && (
                    <span className="section-locked-hint">Save this lead to enable editing</span>
                  )}
                  {userLead && !isEditingBasic && !lead.isGlobal && (
                    <button className="edit-icon-btn" onClick={() => handleStartEdit('basic')} title="Edit job posting">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                    </button>
                  )}
                  {isEditingBasic && (
                    <span className="section-edit-actions">
                      <button className="btn btn-primary btn-sm" onClick={() => handleSaveSection('basic')}>Save</button>
                      <button className="btn btn-sm" onClick={() => handleCancelEdit('basic')}>Cancel</button>
                    </span>
                  )}
                </div>
                {!isEditingBasic ? (
                  <table className="detail-table">
                    <tbody>
                      {lead.company && <tr><td>Company</td><td>{lead.company}</td></tr>}
                      {lead.title && <tr><td>Position</td><td>{lead.title}</td></tr>}
                      {lead.team && <tr><td>Team</td><td>{lead.team}</td></tr>}
                      {lead.industry && <tr><td>Industry</td><td>{lead.industry}</td></tr>}
                      {lead.location && <tr><td>Location</td><td>{lead.location}</td></tr>}
                      {lead.compensation?.raw && <tr><td>Compensation</td><td className="comp-value">{lead.compensation.raw}</td></tr>}
                      {lead.datePosted && <tr><td>Date Posted</td><td>{new Date(lead.datePosted).toLocaleDateString()}</td></tr>}
                      {lead.sourceLink && (
                        <tr><td>Source URL</td><td><a href={lead.sourceLink} target="_blank" rel="noopener noreferrer">View Source →</a></td></tr>
                      )}
                      {lead.sourceApplicationLink && (
                        <tr>
                          <td>Application Link</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <a href={lead.sourceApplicationLink} target="_blank" rel="noopener noreferrer">Apply</a>
                              <button className="copy-icon-btn" onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(lead.sourceApplicationLink || '');
                                const button = e.currentTarget;
                                const originalHTML = button.innerHTML;
                                button.innerHTML = '<span style="font-size: 8pt; color: #00a000; white-space: nowrap;">Copied!</span>';
                                button.style.padding = '4px 6px';
                                setTimeout(() => { button.innerHTML = originalHTML; button.style.padding = '4px'; }, 1500);
                              }} title="Copy application URL">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                ) : (
                  <table className="form-table">
                    <tbody>
                      <tr>
                        <td>Company</td>
                        <td><input type="text" value={lead.company || ''} onChange={(e) => updateLead({ company: e.target.value })} /></td>
                      </tr>
                      <tr>
                        <td>Position</td>
                        <td><input type="text" value={lead.title || ''} onChange={(e) => updateLead({ title: e.target.value })} /></td>
                      </tr>
                      <tr>
                        <td>Team</td>
                        <td><input type="text" value={lead.team || ''} onChange={(e) => updateLead({ team: e.target.value })} /></td>
                      </tr>
                      <tr>
                        <td>Industry</td>
                        <td><input type="text" value={lead.industry || ''} onChange={(e) => updateLead({ industry: e.target.value })} /></td>
                      </tr>
                      <tr>
                        <td>Location</td>
                        <td><input type="text" value={lead.location || ''} onChange={(e) => updateLead({ location: e.target.value })} /></td>
                      </tr>
                      <tr>
                        <td>Compensation</td>
                        <td><input type="text" value={lead.compensation?.raw || ''} onChange={(e) => updateLead({ compensation: { raw: e.target.value } })} /></td>
                      </tr>
                      <tr>
                        <td>Date Posted</td>
                        <td><input type="date" value={lead.datePosted || ''} onChange={(e) => updateLead({ datePosted: e.target.value })} /></td>
                      </tr>
                      <tr>
                        <td>Application URL</td>
                        <td><input type="text" value={lead.sourceApplicationLink || ''} onChange={(e) => updateLead({ sourceApplicationLink: e.target.value })} placeholder="https://..." /></td>
                      </tr>
                      <tr>
                        <td>Source URL</td>
                        <td><input type="text" value={lead.sourceLink || ''} onChange={(e) => updateLead({ sourceLink: e.target.value })} placeholder="https://..." /></td>
                      </tr>
                    </tbody>
                  </table>
                )}

                {/* Listed Contact sub-section */}
                {(lead.contactName || lead.contactEmail || lead.contactLinkedIn || (!lead.isGlobal && userLead)) && (
                  <>
                    <div className="section-title subsection-title">
                      Listed Contact
                      {userLead && !isEditingContact && !lead.isGlobal && (
                        <button className="edit-icon-btn" onClick={() => handleStartEdit('contact')} title="Edit listed contact">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                          </svg>
                        </button>
                      )}
                      {isEditingContact && (
                        <span className="section-edit-actions">
                          <button className="btn btn-primary btn-sm" onClick={() => handleSaveSection('contact')}>Save</button>
                          <button className="btn btn-sm" onClick={() => handleCancelEdit('contact')}>Cancel</button>
                        </span>
                      )}
                    </div>
                    {!isEditingContact ? (
                      <table className="detail-table">
                        <tbody>
                          {lead.contactName && <tr><td>Name</td><td>{lead.contactName}</td></tr>}
                          {lead.contactEmail && (
                            <tr>
                              <td>Email</td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <a href={`mailto:${lead.contactEmail}`}>{lead.contactEmail}</a>
                                  <button className="copy-icon-btn" onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(lead.contactEmail || '');
                                    const button = e.currentTarget;
                                    const originalHTML = button.innerHTML;
                                    button.innerHTML = '<span style="font-size: 8pt; color: #00a000; white-space: nowrap;">Copied!</span>';
                                    button.style.padding = '4px 6px';
                                    setTimeout(() => { button.innerHTML = originalHTML; button.style.padding = '4px'; }, 1500);
                                  }} title="Copy email">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                          {lead.contactLinkedIn && (
                            <tr><td>LinkedIn</td><td><a href={lead.contactLinkedIn} target="_blank" rel="noopener noreferrer">View Profile →</a></td></tr>
                          )}
                        </tbody>
                      </table>
                    ) : (
                      <table className="form-table">
                        <tbody>
                          <tr>
                            <td>Contact Name</td>
                            <td><input type="text" value={lead.contactName || ''} onChange={(e) => updateLead({ contactName: e.target.value })} /></td>
                          </tr>
                          <tr>
                            <td>Email</td>
                            <td><input type="email" value={lead.contactEmail || ''} onChange={(e) => updateLead({ contactEmail: e.target.value })} /></td>
                          </tr>
                          <tr>
                            <td>LinkedIn</td>
                            <td><input type="text" value={lead.contactLinkedIn || ''} onChange={(e) => updateLead({ contactLinkedIn: e.target.value })} placeholder="https://linkedin.com/in/..." /></td>
                          </tr>
                        </tbody>
                      </table>
                    )}
                  </>
                )}

              </>
            )}
          </div>

          {!isNewLead && userLead && (
            <div className="section">
              <div className="section-title">
                Tracking
                {!isEditingTracking && (
                  <button className="edit-icon-btn" onClick={() => handleStartEdit('tracking')} title="Edit tracking info">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                )}
                {isEditingTracking && (
                  <span className="section-edit-actions">
                    <button className="btn btn-primary btn-sm" onClick={() => handleSaveSection('tracking')}>Save</button>
                    <button className="btn btn-sm" onClick={() => handleCancelEdit('tracking')}>Cancel</button>
                  </span>
                )}
              </div>
              <table className="form-table">
                <tbody>
                  <tr>
                    <td>Stage</td>
                    <td>
                      <select value={status || ''} onChange={handleStatusChange}>
                        <option value="saved">Saved</option>
                        <option value="contacted">Contacted</option>
                        <option value="applied">Applied</option>
                        <option value="interviewing">Interviewing</option>
                        <option value="offer">Offer</option>
                        <option value="offer_accepted">Offer Accepted</option>
                        <option value="rejected">Rejected</option>
                        <option value="archived">Archived</option>
                      </select>
                    </td>
                  </tr>
                  <tr>
                    <td>Priority</td>
                    <td>
                      <select value={priority} onChange={handlePriorityChange}>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </td>
                  </tr>
                  <tr>
                    <td>Location</td>
                    <td>
                      <input
                        type="text"
                        value={userLead.location || ''}
                        onChange={(e) => updateUserLead({ location: e.target.value })}
                        onClick={() => handleReadOnlyClick('tracking')}
                        readOnly={!isEditingTracking}
                        placeholder={lead.location || 'Your location details'}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td>Actual Compensation</td>
                    <td>
                      <input
                        type="text"
                        value={userLead.compensation?.raw || ''}
                        onChange={(e) => updateUserLead({ compensation: { raw: e.target.value } })}
                        onClick={() => handleReadOnlyClick('tracking')}
                        readOnly={!isEditingTracking}
                        placeholder={lead.compensation?.raw || 'Your comp details'}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          <div className="section">
            {isNewLead ? (
              /* ── Add New form: contact fields ── */
              <>
                <div className="section-title">Contact Information</div>
                <table className="form-table">
                  <tbody>
                    <tr>
                      <td>Contact Name</td>
                      <td><input type="text" value={lead.contactName || ''} onChange={(e) => updateLead({ contactName: e.target.value })} placeholder="e.g. Jane Doe (recruiter)" /></td>
                    </tr>
                    <tr>
                      <td>Contact Email</td>
                      <td><input type="email" value={lead.contactEmail || ''} onChange={(e) => updateLead({ contactEmail: e.target.value })} placeholder="email@example.com" /></td>
                    </tr>
                    <tr>
                      <td>LinkedIn</td>
                      <td><input type="text" value={lead.contactLinkedIn || ''} onChange={(e) => updateLead({ contactLinkedIn: e.target.value })} placeholder="https://linkedin.com/in/..." /></td>
                    </tr>
                  </tbody>
                </table>
              </>
            ) : (
              /* ── Post-save: Your Contacts ── */
              <>
                <div className="section-title">
                   Contacts
              {!isEditingYourContacts && userLead && (
                <button className="edit-icon-btn" onClick={() => handleStartEdit('yourContacts')} title="Edit your contacts">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </button>
              )}
              {!isEditingYourContacts && !userLead && (
                <span className="section-locked-hint">Save this lead to enable editing</span>
              )}
              {isEditingYourContacts && (
                <span className="section-edit-actions">
                  <button className="btn btn-primary btn-sm" onClick={() => handleSaveSection('yourContacts')}>Save</button>
                  <button className="btn btn-sm" onClick={() => handleCancelEdit('yourContacts')}>Cancel</button>
                </span>
              )}
            </div>
            <table className="form-table">
              <tbody>
                <tr>
                  <td>Primary Contact</td>
                  <td>
                    <input type="text" value={userLead?.userContactName || ''} onChange={(e) => updateUserLead({ userContactName: e.target.value })} onClick={() => handleReadOnlyClick('yourContacts')} readOnly={!isEditingYourContacts} placeholder={isEditingYourContacts ? "Name of person you spoke with" : ""} />
                  </td>
                </tr>
                <tr>
                  <td>Primary Email</td>
                  <td>
                    {!isEditingYourContacts && userLead?.userContactEmail ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <a href={`mailto:${userLead.userContactEmail}`}>{userLead.userContactEmail}</a>
                        <button className="copy-icon-btn" onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(userLead?.userContactEmail || '');
                          const button = e.currentTarget;
                          const originalHTML = button.innerHTML;
                          button.innerHTML = '<span style="font-size: 8pt; color: #00a000; white-space: nowrap;">Copied!</span>';
                          button.style.padding = '4px 6px';
                          setTimeout(() => { button.innerHTML = originalHTML; button.style.padding = '4px'; }, 1500);
                        }} title="Copy email">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                          </svg>
                        </button>
                        <button
                          disabled
                          title="Send email functionality coming soon!"
                          style={{ background: '#f5f5f5', border: '1px solid #ddd', color: '#aaa', cursor: 'not-allowed', padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 4, fontSize: '8pt', fontFamily: 'Verdana, Geneva, sans-serif' }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                            <polyline points="22,6 12,13 2,6"/>
                          </svg>
                          Send email
                        </button>
                      </div>
                    ) : (
                      <input type="email" value={userLead?.userContactEmail || ''} onChange={(e) => updateUserLead({ userContactEmail: e.target.value })} onClick={() => handleReadOnlyClick('yourContacts')} readOnly={!isEditingYourContacts} placeholder={isEditingYourContacts ? "email@example.com" : ""} />
                    )}
                  </td>
                </tr>
                {(isEditingYourContacts || userLead?.userContactLinkedIn) && (
                  <tr>
                    <td>Primary LinkedIn</td>
                    <td>
                      {isEditingYourContacts ? (
                        <input type="text" value={userLead?.userContactLinkedIn || ''} onChange={(e) => updateUserLead({ userContactLinkedIn: e.target.value })} placeholder="https://linkedin.com/in/..." />
                      ) : (
                        <a href={userLead?.userContactLinkedIn} target="_blank" rel="noopener noreferrer">View Profile →</a>
                      )}
                    </td>
                  </tr>
                )}
                {(userLead?.additionalEmails || []).map((email: string, index: number) => (
                  <tr key={`add-email-${index}`}>
                    <td>{index === 0 ? 'More Emails' : ''}</td>
                    <td>
                      {!isEditingYourContacts ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <a href={`mailto:${email}`}>{email}</a>
                          <button className="copy-icon-btn" onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(email);
                            const button = e.currentTarget;
                            const originalHTML = button.innerHTML;
                            button.innerHTML = '<span style="font-size: 8pt; color: #00a000; white-space: nowrap;">Copied!</span>';
                            button.style.padding = '4px 6px';
                            setTimeout(() => { button.innerHTML = originalHTML; button.style.padding = '4px'; }, 1500);
                          }} title="Copy email">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <input type="email" value={email} onChange={(e) => {
                            const newEmails = [...(userLead?.additionalEmails || [])];
                            newEmails[index] = e.target.value;
                            updateUserLead({ additionalEmails: newEmails });
                          }} placeholder="email@example.com" style={{ flex: 1 }} />
                          <button type="button" className="btn-remove-email" onClick={() => {
                            const newEmails = (userLead?.additionalEmails || []).filter((_: string, i: number) => i !== index);
                            updateUserLead({ additionalEmails: newEmails });
                          }} title="Remove email">×</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {userLead && (
                  <tr>
                    <td></td>
                    <td>
                      <button type="button" className="btn-add-email" onClick={() => {
                        if (!isEditingYourContacts) handleStartEdit('yourContacts');
                        updateUserLead({ additionalEmails: [...(userLead?.additionalEmails || []), ''] });
                      }}>+ Add email</button>
                    </td>
                  </tr>
                )}
                {(userLead?.additionalLinks || []).map((link: { title?: string; url?: string }, index: number) => (
                  <tr key={`add-link-${index}`}>
                    <td>{index === 0 ? 'Links' : ''}</td>
                    <td>
                      {!isEditingYourContacts ? (
                        <div>
                          {link.title && <span style={{ fontSize: '8pt', color: '#828282', display: 'block', marginBottom: '2px' }}>{link.title}</span>}
                          <a href={link.url} target="_blank" rel="noopener noreferrer">
                            {link.url && link.url.length > 50 ? link.url.substring(0, 50) + '...' : link.url}
                          </a>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <input type="text" value={link.title || ''} onChange={(e) => {
                              const newLinks = [...(userLead?.additionalLinks || [])];
                              newLinks[index] = { ...newLinks[index], title: e.target.value };
                              updateUserLead({ additionalLinks: newLinks });
                            }} placeholder="Title (optional)" style={{ fontSize: '8pt' }} />
                            <input type="url" value={link.url || ''} onChange={(e) => {
                              const newLinks = [...(userLead?.additionalLinks || [])];
                              newLinks[index] = { ...newLinks[index], url: e.target.value };
                              updateUserLead({ additionalLinks: newLinks });
                            }} placeholder="https://..." />
                          </div>
                          <button type="button" className="btn-remove-email" onClick={() => {
                            const newLinks = (userLead?.additionalLinks || []).filter((_: { title?: string; url?: string }, i: number) => i !== index);
                            updateUserLead({ additionalLinks: newLinks });
                          }} title="Remove link" style={{ marginTop: '4px' }}>×</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {userLead && (
                  <tr>
                    <td>{(userLead?.additionalLinks || []).length === 0 ? 'Links' : ''}</td>
                    <td>
                      <button type="button" className="btn-add-email" onClick={() => {
                        if (!isEditingYourContacts) handleStartEdit('yourContacts');
                        updateUserLead({ additionalLinks: [...(userLead?.additionalLinks || []), { title: '', url: '' }] });
                      }}>{(userLead?.additionalLinks || []).length === 0 ? '+ Add link' : '+ Add another link'}</button>
                    </td>
                  </tr>
                )}
                {networkConnections.length > 0 && (
                  <>
                    {networkConnections.map((conn, i) => (
                      <tr key={`nc-${i}`}>
                        <td>{i === 0 ? 'Connections' : ''}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            {conn.linkedinUrl ? (
                              <a href={conn.linkedinUrl} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 500 }}>{conn.name}</a>
                            ) : (
                              <span style={{ fontWeight: 500 }}>{conn.name}</span>
                            )}
                            {conn.email && (
                              <span style={{ color: '#828282', fontSize: '8pt' }}>{conn.email}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </>
                )}
                {referral ? (
                  <>
                    <tr>
                      <td>Referral</td>
                      <td>
                        <a href={`/referrals/${referral._id}`} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 'bold' }}>{referral.name}</a>
                      </td>
                    </tr>
                    {referral.email && (
                      <tr>
                        <td>Referral Email</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <a href={`mailto:${referral.email}`}>{referral.email}</a>
                            <button className="copy-icon-btn" onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(referral.email || '');
                              const button = e.currentTarget;
                              const originalHTML = button.innerHTML;
                              button.innerHTML = '<span style="font-size: 8pt; color: #00a000; white-space: nowrap;">Copied!</span>';
                              button.style.padding = '4px 6px';
                              setTimeout(() => { button.innerHTML = originalHTML; button.style.padding = '4px'; }, 1500);
                            }} title="Copy email">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ) : userLead && (
                  <tr>
                    <td>Referral</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button className="btn-sm btn-secondary" onClick={openLinkReferralModal}>Link Referral</button>
                        <button className="btn-sm btn-secondary" onClick={() =>
                          router.push(`/referrals/new?linkLeadId=${encodeURIComponent(userLead._id)}&leadPageId=${encodeURIComponent(lead?._id || '')}&leadTitle=${encodeURIComponent(lead?.title || '')}&leadCompany=${encodeURIComponent(lead?.company || '')}`)
                        }>+ Add New Referral</button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </>
          )}

            <div className="notes-thread">
              <div className="section-title">Notes</div>
              {isAddingNote ? (
                <div className="add-note">
                  <NoteEditor content={newNote} onChange={setNewNote} placeholder="Write your note..." onCmdEnter={handleAddNote} />
                  <div className="note-edit-actions">
                    <button className="btn btn-primary" onClick={handleAddNote}>Save</button>
                    <button className="btn" onClick={handleCancelAddNote}>Cancel</button>
                  </div>
                </div>
              ) : userLead ? (
                <button className="btn btn-primary" onClick={() => setIsAddingNote(true)} style={{ marginBottom: 8 }}>Add Note</button>
              ) : null}
              {noteEntries.length > 0 ? (
                [...noteEntries].reverse().map((entry) => (
                  <div key={entry.id} className="note-entry">
                    <div className="note-header">
                      <span className="note-date">
                        {new Date(entry.createdAt).toLocaleString()}
                        {editingNoteId !== entry.id && (
                          <button className="edit-icon-btn" onClick={() => handleEditNote(entry.id)} title="Edit note">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                          </button>
                        )}
                      </span>
                    </div>
                    {editingNoteId === entry.id ? (
                      <>
                        <NoteEditor content={editingNoteText} onChange={setEditingNoteText} onCmdEnter={handleSaveNoteEdit} />
                        <div className="note-edit-actions">
                          <button className="btn btn-primary" onClick={handleSaveNoteEdit}>Save</button>
                          <button className="btn" onClick={handleCancelNoteEdit}>Cancel</button>
                        </div>
                      </>
                    ) : (
                      <NoteEditor content={entry.text} onChange={() => {}} editable={false} />
                    )}
                  </div>
                ))
              ) : (
                <div className="note-empty">No notes yet.</div>
              )}
            </div>
          </div>

        </div>

        <div className="side-col">
          <div className="section">
            <div className="section-title">Activity & Timeline</div>

            {activity.length > 0 ? (
              activity.map((item, index) => (
                <div key={index} className="activity-item">
                  <div className="activity-meta">
                    {new Date(item.createdAt).toLocaleString()} | {item.action.replace('_', ' ')}
                  </div>
                  <div className="activity-text">{item.description}</div>
                </div>
              ))
            ) : userLead ? (
              <div className="activity-item">
                <div className="activity-text">No activity yet. Start tracking your progress!</div>
              </div>
            ) : (
              <div className="activity-item">
                <div className="activity-text">Save this lead to start tracking activity</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {toastElement}

      {/* Publish Lead Modal */}
      <PublishLeadModal
        isOpen={showPublishModal}
        onClose={handlePublishDecline}
        onConfirm={handlePublishConfirm}
        mode={publishMode}
        leadTitle={lead?.title}
        leadCompany={lead?.company}
        isLoading={isPublishing}
      />

      {/* Link Referral Modal */}
      {showLinkReferralModal && (
        <div className="modal-overlay" onClick={() => setShowLinkReferralModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Link Referral</h3>
              <button className="modal-close" onClick={() => setShowLinkReferralModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p className="modal-instruction">Search and select an existing referral to link to this lead</p>

              <label htmlFor="referral-search">Search Referrals</label>
              <input
                id="referral-search"
                type="text"
                className="modal-input"
                placeholder="Search by name, company, or email..."
                value={referralSearchQuery}
                onChange={(e) => setReferralSearchQuery(e.target.value)}
              />

              <label htmlFor="referral-select" style={{ marginTop: '12px', display: 'block' }}>
                Select Referral ({filteredReferrals.length} available)
              </label>
              <select
                id="referral-select"
                className="modal-select"
                value={selectedReferralId}
                onChange={(e) => setSelectedReferralId(e.target.value)}
                size={8}
              >
                <option value="">-- Select a referral --</option>
                {filteredReferrals.map((ref) => (
                  <option key={ref._id} value={ref._id}>
                    {ref.name} {ref.company ? `- ${ref.company}` : ''} {ref.email ? `(${ref.email})` : ''}
                  </option>
                ))}
              </select>

              {filteredReferrals.length === 0 && availableReferrals.length > 0 && (
                <p style={{ fontSize: '9pt', color: '#999999', marginTop: '8px', fontStyle: 'italic' }}>
                  No referrals match your search. Try a different query.
                </p>
              )}

              {availableReferrals.length === 0 && (
                <p style={{ fontSize: '9pt', color: '#999999', marginTop: '8px', fontStyle: 'italic' }}>
                  No referrals available. Create a new referral using "+ Add New Referral".
                </p>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowLinkReferralModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleLinkReferral}>Link Referral</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadDetail;

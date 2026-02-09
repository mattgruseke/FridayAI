// Updated Pipeline.jsx component with API integration
// Place this in: src/pages/Pipeline.jsx

"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import api from '../api/client';
import { useToast } from '../hooks/useToast';
import PublishLeadModal from '../components/PublishLeadModal';
import type { PublishLeadMode } from '../components/PublishLeadModal';
import { getErrorMessage } from '../lib/errors';

type PipelineLeadItem = {
  userLead?: { _id?: string; priority?: "high" | "medium" | "low"; lastActivityAt?: string };
  leadDetails?: { _id?: string; title?: string; company?: string; location?: string; compensation?: { raw?: string } };
  referral?: { name?: string; email?: string };
};

function getActivityAge(dateStr: string | undefined): { label: string; className: string } | null {
  if (!dateStr) return null;
  const ms = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const weeks = Math.floor(days / 7);

  let label: string;
  if (days === 0) label = 'Today';
  else if (days === 1) label = '1 day ago';
  else if (days < 7) label = `${days} days ago`;
  else if (weeks === 1) label = '1 week ago';
  else label = `${weeks} weeks ago`;

  let className = 'activity-fresh';       // green: < 1 week
  if (days >= 14) className = 'activity-stale';  // red: > 2 weeks
  else if (days >= 7) className = 'activity-aging'; // yellow: > 1 week

  return { label, className };
}

type PipelineStage = {
  _id: string;
  count: number;
  leads?: PipelineLeadItem[];
};

const PIPELINE_FILTERS_KEY = 'pipelineVisibleStatuses';
const DEFAULT_VISIBLE = ['saved', 'contacted', 'applied', 'interviewing'];

const MIGRATED_KEY = 'pipelineMigratedStatuses';

function loadVisibleStatuses(): string[] {
  if (typeof window === 'undefined') return DEFAULT_VISIBLE;
  try {
    const saved = localStorage.getItem(PIPELINE_FILTERS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        // One-time migration: inject "contacted" for users with old saved prefs
        const migrated: string[] = JSON.parse(localStorage.getItem(MIGRATED_KEY) || '[]');
        if (!migrated.includes('contacted') && !parsed.includes('contacted')) {
          parsed.push('contacted');
          localStorage.setItem(PIPELINE_FILTERS_KEY, JSON.stringify(parsed));
          localStorage.setItem(MIGRATED_KEY, JSON.stringify([...migrated, 'contacted']));
        }
        return parsed;
      }
    }
  } catch {}
  return DEFAULT_VISIBLE;
}

const Pipeline = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showToast, ToastComponent } = useToast();
  const [pipeline, setPipeline] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    activeLeads: 0,
    applied: 0,
    interviewing: 0,
    offers: 0
  });

  // Filter state
  const [visibleStatuses, setVisibleStatuses] = useState<string[]>(loadVisibleStatuses);
  const [savedStatuses, setSavedStatuses] = useState<string[]>(loadVisibleStatuses);

  const hasUnsavedChanges =
    JSON.stringify([...visibleStatuses].sort()) !== JSON.stringify([...savedStatuses].sort());

  const toggleStatus = (statusId: string) => {
    setVisibleStatuses(prev =>
      prev.includes(statusId)
        ? prev.filter(s => s !== statusId)
        : [...prev, statusId]
    );
  };

  const saveView = () => {
    localStorage.setItem(PIPELINE_FILTERS_KEY, JSON.stringify(visibleStatuses));
    setSavedStatuses(visibleStatuses);
    showToast('View saved', 'success');
  };

  // Publish modal state
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishMode, setPublishMode] = useState<PublishLeadMode>(null);
  const [pendingUserLeadId, setPendingUserLeadId] = useState<string | null>(null);
  const [pendingLeadDetails, setPendingLeadDetails] = useState<PipelineLeadItem['leadDetails'] | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  // Re-fetch pipeline on mount and when location changes
  useEffect(() => {
    fetchPipeline();
  }, [pathname, searchParams]); // Re-run when route changes

  const fetchPipeline = async () => {
    try {
      setLoading(true);
      const data = (await api.userLeads.getPipeline()) as PipelineStage[];
      setPipeline(data || []);

      // Calculate stats from pipeline data
      const stats = {
        activeLeads: data.reduce((sum, stage) => sum + (stage.count || 0), 0),
        applied: data.find(s => s._id === 'applied')?.count || 0,
        interviewing: data.find(s => s._id === 'interviewing')?.count || 0,
        offers: data.find(s => s._id === 'offer')?.count || 0
      };
      setStats(stats);
    } catch (err) {
      setError(getErrorMessage(err));
      console.error('Error fetching pipeline:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (
    userLeadId: string,
    newStatus: string,
    leadDetails: PipelineLeadItem['leadDetails'] | null = null
  ) => {
    // Check if this status change should trigger a publish modal
    if (newStatus === 'rejected' || newStatus === 'offer_accepted') {
      setPendingUserLeadId(userLeadId);
      setPendingLeadDetails(leadDetails);
      setPublishMode(newStatus);
      setShowPublishModal(true);
      return;
    }

    try {
      await api.userLeads.updateStatus(userLeadId, newStatus);
      // Refresh pipeline
      fetchPipeline();
    } catch (err) {
      showToast(`Error updating status: ${getErrorMessage(err)}`, 'error');
    }
  };

  const handlePublishConfirm = async () => {
    setIsPublishing(true);
    try {
      if (!pendingUserLeadId || !publishMode) {
        setIsPublishing(false);
        return;
      }
      // First update the status
      await api.userLeads.updateStatus(pendingUserLeadId, publishMode);

      // Then publish based on mode
      if (publishMode === 'rejected' && pendingLeadDetails?._id) {
        await api.publish.publishSingle(pendingLeadDetails._id);
        showToast('Lead published to public database!', 'success');
      } else if (publishMode === 'offer_accepted') {
        const result = (await api.publish.publishAll()) as { count?: number };
        showToast(`${result.count} lead(s) published to public database!`, 'success');
      }

      // Refresh and close modal
      fetchPipeline();
      setShowPublishModal(false);
      setPendingUserLeadId(null);
      setPendingLeadDetails(null);
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
      if (pendingUserLeadId && publishMode) {
        await api.userLeads.updateStatus(pendingUserLeadId, publishMode);
      }
      fetchPipeline();
      showToast('Status updated', 'success');
    } catch (err) {
      showToast(`Error updating status: ${getErrorMessage(err)}`, 'error');
    }
    setShowPublishModal(false);
    setPendingUserLeadId(null);
    setPendingLeadDetails(null);
    setPublishMode(null);
  };

  // Helper to get leads for a specific status (sorted by priority, then most recent activity)
  const getLeadsByStatus = (status: string) => {
    const stage = pipeline.find(s => s._id === status);
    const leads = stage?.leads || [];

    const priorityValue = { high: 3, medium: 2, low: 1 };
    return [...leads].sort((a, b) => {
      const aKey = a.userLead?.priority;
      const bKey = b.userLead?.priority;
      const aPriority = aKey && aKey in priorityValue ? priorityValue[aKey] : 0;
      const bPriority = bKey && bKey in priorityValue ? priorityValue[bKey] : 0;
      if (bPriority !== aPriority) return bPriority - aPriority;
      // Same priority: most recent activity first
      const aTime = a.userLead?.lastActivityAt ? new Date(a.userLead.lastActivityAt).getTime() : 0;
      const bTime = b.userLead?.lastActivityAt ? new Date(b.userLead.lastActivityAt).getTime() : 0;
      return bTime - aTime;
    });
  };

  // Status display mapping
  const statusColumns = [
    { id: 'saved', title: 'Saved' },
    { id: 'contacted', title: 'Contacted' },
    { id: 'applied', title: 'Applied' },
    { id: 'interviewing', title: 'Interviewing' },
    { id: 'offer', title: 'Offer' },
    { id: 'offer_accepted', title: 'Accepted' }
  ];

  if (loading) {
    return (
      <div className="main">
        <div className="page-title">Loading pipeline...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="main">
        <div className="page-title">Error loading pipeline</div>
        <p>{error}</p>
        <button onClick={fetchPipeline}>Retry</button>
      </div>
    );
  }

  return (
    <div className="main">
      <div className="page-title">Pipeline</div>

      {/* <div className="stats">
        <span>{stats.activeLeads} active leads</span>
        <span>{stats.applied} applications sent</span>
        <span>{stats.interviewing} interviews</span>
        <span>{stats.offers} offer{stats.offers !== 1 ? 's' : ''}</span>
      </div> */}
      <Link href="/leads/new" className="btn-add-lead-pipeline">Add Lead</Link>

      <div className="pipeline-filters">
        <div className="filter-checkboxes">
          {statusColumns.map(column => {
            const isVisible = visibleStatuses.includes(column.id);
            const hiddenCount = !isVisible ? getLeadsByStatus(column.id).length : 0;
            return (
              <label key={column.id} className="filter-checkbox">
                <input
                  type="checkbox"
                  checked={isVisible}
                  onChange={() => toggleStatus(column.id)}
                />
                {column.title}
                {!isVisible && hiddenCount > 0 && (
                  <span className="hidden-count">({hiddenCount} hidden)</span>
                )}
              </label>
            );
          })}
        </div>
        <button
          className={`btn-save-view${hasUnsavedChanges ? ' unsaved' : ''}`}
          onClick={saveView}
          disabled={!hasUnsavedChanges}
        >
          Save View
        </button>
      </div>

      <div className="pipeline-table">
        {statusColumns.filter(col => visibleStatuses.includes(col.id)).map(column => {
          const leads = getLeadsByStatus(column.id);
          const count = leads.length;

          return (
            <div key={column.id} className="pipeline-col">
              <div className="col-header">
                {column.title} <span className="count">{count}</span>
              </div>

              {leads.map(({ userLead, leadDetails, referral }) => {
                if (!userLead || !leadDetails) return null;
                return (
                <div
                  key={userLead._id}
                  className="job-card"
                  onClick={() => router.push(`/leads/${leadDetails._id}`)}
                >
                  <div className="job-company">{leadDetails.company}</div>
                  <div className="job-title">
                    <Link href={`/leads/${leadDetails._id}`}>
                      {leadDetails.title}
                    </Link>
                  </div>
                  <div className="job-meta">
                    {leadDetails.location} |
                    <span className="job-comp">
                      {leadDetails.compensation?.raw || 'N/A'}
                    </span>
                    {userLead.priority && (
                      <span className={`priority-badge priority-${userLead.priority}`}>
                        {userLead.priority}
                      </span>
                    )}
                  </div>

                  {/* Referral info */}
                  {referral && (
                    <div className="job-referral" onClick={(e) => e.stopPropagation()}>
                      <div className="referral-label">Referral:</div>
                      <div className="referral-info">
                        <span className="referral-name">{referral.name}</span>
                        {referral.email && (
                          <div className="referral-email">
                            <span>{referral.email}</span>
                            <button
                              className="copy-email-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(referral.email);
                                const button = e.currentTarget;
                                const originalHTML = button.innerHTML;
                                button.innerHTML = '✓';
                                button.classList.add('copied');
                                setTimeout(() => {
                                  button.innerHTML = originalHTML;
                                  button.classList.remove('copied');
                                }, 1500);
                              }}
                              title="Copy email"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Last activity */}
                  {(() => {
                    const activity = getActivityAge(userLead.lastActivityAt);
                    if (!activity) return null;
                    return (
                      <div className={`last-activity ${activity.className}`}>
                        Last activity: {activity.label}
                      </div>
                    );
                  })()}

                  {/* Status change buttons */}
                  <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                    {column.id === 'saved' && (
                      <>
                        <button
                          className="btn-sm"
                          onClick={() => handleStatusChange(userLead._id, 'contacted')}
                        >
                          Contacted →
                        </button>
                        <button
                          className="btn-sm btn-danger"
                          onClick={() => handleStatusChange(userLead._id, 'rejected', leadDetails)}
                          title="Mark as Rejected"
                        >
                          Rejected
                        </button>
                      </>
                    )}
                    {column.id === 'contacted' && (
                      <>
                        <button
                          className="btn-sm btn-secondary"
                          onClick={() => handleStatusChange(userLead._id, 'saved')}
                          title="Move back to Saved"
                        >
                          ← Back
                        </button>
                        <button
                          className="btn-sm"
                          onClick={() => handleStatusChange(userLead._id, 'applied')}
                        >
                          Applied →
                        </button>
                        <button
                          className="btn-sm btn-danger"
                          onClick={() => handleStatusChange(userLead._id, 'rejected', leadDetails)}
                          title="Mark as Rejected"
                        >
                          Rejected
                        </button>
                      </>
                    )}
                    {column.id === 'applied' && (
                      <>
                        <button
                          className="btn-sm btn-secondary"
                          onClick={() => handleStatusChange(userLead._id, 'contacted')}
                          title="Move back to Contacted"
                        >
                          ← Back
                        </button>
                        <button
                          className="btn-sm"
                          onClick={() => handleStatusChange(userLead._id, 'interviewing')}
                        >
                          Interview →
                        </button>
                        <button
                          className="btn-sm btn-danger"
                          onClick={() => handleStatusChange(userLead._id, 'rejected', leadDetails)}
                          title="Mark as Rejected"
                        >
                          Rejected
                        </button>
                      </>
                    )}
                    {column.id === 'interviewing' && (
                      <>
                        <button
                          className="btn-sm btn-secondary"
                          onClick={() => handleStatusChange(userLead._id, 'applied')}
                          title="Move back to Applied"
                        >
                          ← Back
                        </button>
                        <button
                          className="btn-sm"
                          onClick={() => handleStatusChange(userLead._id, 'offer')}
                        >
                          Got Offer! →
                        </button>
                        <button
                          className="btn-sm btn-danger"
                          onClick={() => handleStatusChange(userLead._id, 'rejected', leadDetails)}
                          title="Mark as Rejected"
                        >
                          Rejected
                        </button>
                      </>
                    )}
                    {column.id === 'offer' && (
                      <>
                        <button
                          className="btn-sm btn-secondary"
                          onClick={() => handleStatusChange(userLead._id, 'interviewing')}
                          title="Move back to Interviewing"
                        >
                          ← Back
                        </button>
                        <button
                          className="btn-sm btn-success"
                          onClick={() => handleStatusChange(userLead._id, 'offer_accepted', leadDetails)}
                        >
                          Accept Offer!
                        </button>
                        <button
                          className="btn-sm btn-danger"
                          onClick={() => handleStatusChange(userLead._id, 'rejected', leadDetails)}
                          title="Mark as Rejected"
                        >
                          Rejected
                        </button>
                      </>
                    )}
                    {column.id === 'offer_accepted' && (
                      <span className="accepted-label">Congratulations!</span>
                    )}
                  </div>
                </div>
                );
              })}

              {count === 0 && (
                <div className="empty-state">
                  No {column.title.toLowerCase()} leads
                </div>
              )}
            </div>
          );
        })}
      </div>
      <ToastComponent />

      {/* Publish Lead Modal */}
      <PublishLeadModal
        isOpen={showPublishModal}
        onClose={handlePublishDecline}
        onConfirm={handlePublishConfirm}
        mode={publishMode}
        leadTitle={pendingLeadDetails?.title}
        leadCompany={pendingLeadDetails?.company}
        isLoading={isPublishing}
      />
    </div>
  );
};

export default Pipeline;

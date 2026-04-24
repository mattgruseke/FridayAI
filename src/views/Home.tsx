"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import api from "../api/client";
import NetworkAnalysisCard from "../components/NetworkAnalysisCard";
import TourTooltip from "../components/TourTooltip";

type StatusHistoryEntry = {
  status?: string;
  timestamp?: string;
  note?: string;
  action?: string;
};

type PipelineLeadItem = {
  userLead?: { _id?: string; priority?: "high" | "medium" | "low"; statusHistory?: StatusHistoryEntry[]; lastActivityAt?: string; currentStatus?: string };
  leadDetails?: {
    _id?: string;
    title?: string;
    company?: string;
    location?: string;
    compensation?: { raw?: string };
  };
};

type PipelineStage = {
  _id: string;
  count?: number;
  leads?: PipelineLeadItem[];
};

type AttentionItem = {
  leadId: string;
  company: string;
  title: string;
  status: string;
  daysIdle: number;
};

type ActivityItem = {
  leadId: string;
  company: string;
  title: string;
  description: string;
  timestamp: string;
};

const Home = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, preferredRoles, onboardingCompleted } = useAuth();
  const [pipeline, setPipeline] = useState<PipelineStage[]>([]);
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Only fetch data if user is authenticated
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    fetchData();
  }, [pathname, isAuthenticated]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch pipeline and recent leads in parallel
      const [pipelineResult, leadsResult] = await Promise.allSettled([
        api.userLeads.getPipeline() as Promise<PipelineStage[]>,
        api.leads.getAll({
          page: 1,
          limit: 200,
          sort: "-created_at",
        }) as Promise<{ leads?: any[] }>,
      ]);

      if (pipelineResult.status === "fulfilled") {
        setPipeline(pipelineResult.value || []);
      } else {
        console.error("Error fetching pipeline:", pipelineResult.reason);
      }

      if (leadsResult.status === "fulfilled") {
        console.log(leadsResult)
        setRecentLeads(leadsResult.value?.leads || []);
      } else {
        console.error("Error fetching recent leads:", leadsResult.reason);
      }
    } finally {
      setLoading(false);
    }
  };

  // Pipeline stage counts
  const getStageCount = (status: string) =>
    pipeline.find((s) => s._id === status)?.leads?.length || 0;

  // Thresholds: how many days idle before a lead in this stage needs attention
  const stageThresholds: Record<string, number> = {
    saved: 3,
    contacted: 7,
    applied: 14,
    interviewing: 2,
    offer: 1,
  };

  // Find leads needing attention: idle for too long given their stage
  const getAttentionItems = (): AttentionItem[] => {
    const now = Date.now();
    const DAY = 1000 * 60 * 60 * 24;
    const items: AttentionItem[] = [];

    for (const stage of pipeline) {
      const threshold = stageThresholds[stage._id];
      if (!threshold) continue;
      for (const item of stage.leads || []) {
        const lead = item.leadDetails;
        const lastActivity = item.userLead?.lastActivityAt;
        if (!lead?._id || !lastActivity) continue;

        const daysIdle = Math.floor((now - new Date(lastActivity).getTime()) / DAY);
        if (daysIdle >= threshold) {
          items.push({
            leadId: lead._id,
            company: lead.company || "",
            title: lead.title || "",
            status: stage._id,
            daysIdle,
          });
        }
      }
    }

    // Newest first (least idle on top)
    items.sort((a, b) => a.daysIdle - b.daysIdle);
    return items;
  };

  const attentionItems = getAttentionItems();

  // Aggregate attention by stage for callout summaries and expandable lists
  const attentionByStage: Record<string, AttentionItem[]> = {};
  for (const item of attentionItems) {
    if (!attentionByStage[item.status]) attentionByStage[item.status] = [];
    attentionByStage[item.status].push(item);
  }

  const stageActionLabels: Record<string, string> = {
    saved: "need outreach",
    contacted: "awaiting response",
    applied: "with no update",
    interviewing: "need follow-up",
    offer: "pending decision",
  };

  // Extract activity from pipeline data
  const getRecentActivity = (): { today: ActivityItem[]; thisWeek: ActivityItem[]; lastWeek: ActivityItem[] } => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
    const startOfLastWeek = new Date(startOfWeek);
    startOfLastWeek.setDate(startOfWeek.getDate() - 7);

    const allActivity: ActivityItem[] = [];

    for (const stage of pipeline) {
      for (const item of stage.leads || []) {
        const lead = item.leadDetails;
        const history = item.userLead?.statusHistory || [];
        if (!lead?._id) continue;

        for (const entry of history) {
          if (!entry.timestamp) continue;
          const entryDate = new Date(entry.timestamp);
          if (entryDate < startOfLastWeek) continue;

          allActivity.push({
            leadId: lead._id,
            company: lead.company || "",
            title: lead.title || "",
            description: entry.note || `Status changed to ${entry.status}`,
            timestamp: entry.timestamp,
          });
        }
      }
    }

    allActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const today: ActivityItem[] = [];
    const thisWeek: ActivityItem[] = [];
    const lastWeek: ActivityItem[] = [];

    for (const item of allActivity) {
      const d = new Date(item.timestamp);
      if (d >= startOfToday) today.push(item);
      else if (d >= startOfWeek) thisWeek.push(item);
      else lastWeek.push(item);
    }

    return { today, thisWeek, lastWeek };
  };

  const recentActivity = getRecentActivity();
  const hasActivity = recentActivity.today.length > 0 || recentActivity.thisWeek.length > 0 || recentActivity.lastWeek.length > 0;

  const displayLeads = preferredRoles.length > 0
    ? recentLeads
      .filter((lead) =>
        preferredRoles.some((role) =>
          lead.title?.toLowerCase().includes(role.toLowerCase())
        )
      )
      .slice(0, 10)
    : recentLeads.slice(0, 10);

  // Status display mapping
  const statusColumns = [
    { id: "saved", title: "Saved" },
    { id: "contacted", title: "Contacted" },
    { id: "applied", title: "Applied" },
    { id: "interviewing", title: "Interviewing" },
    { id: "offer", title: "Offer" },
  ];

  if (loading) {
    return (
      <div className="container">
        <div className="main">
          <div className="section">
            <div className="section-header">
              <span>Loading...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="main">
        <div className="section">
          <div className="section-header">
            <span>Pipeline <TourTooltip text="Your active lead counts by stage. Click any stage to open your pipeline." align="left" /></span>
            <Link href="/pipeline">view pipeline</Link>
          </div>

          {/* Stage counts */}
          <div className="pipeline-counts">
            {statusColumns.map((column) => {
              const count = getStageCount(column.id);
              return (
                <Link key={column.id} href="/pipeline" className="pipeline-count-item">
                  <span className="pipeline-count-number">{count}</span>
                  <span className="pipeline-count-label">{column.title}</span>
                </Link>
              );
            })}
          </div>

          {/* Needs attention callouts */}
          {Object.keys(attentionByStage).length > 0 && (
            <div className="attention-section">
              <div className="attention-header">Needs Attention <TourTooltip text="Leads idle longer than expected for their stage — these need a follow-up or status update." /></div>
              {statusColumns.map((column) => {
                const items = attentionByStage[column.id];
                if (!items || items.length === 0) return null;
                const count = items.length;
                const isExpanded = expandedGroups[`attention-${column.id}`];
                return (
                  <div key={column.id}>
                    <div
                      className="attention-callout attention-callout-toggle"
                      onClick={() => setExpandedGroups(prev => ({ ...prev, [`attention-${column.id}`]: !prev[`attention-${column.id}`] }))}
                    >
                      <span className="attention-count">{count}</span>
                      <span className="attention-callout-text">{column.title.toLowerCase()} lead{count !== 1 ? "s" : ""} {stageActionLabels[column.id]} (idle {stageThresholds[column.id]}+ days)</span>
                      <span className="activity-group-toggle">{isExpanded ? "−" : "+"}</span>
                    </div>
                    {isExpanded && items.map((item) => (
                      <div
                        key={item.leadId}
                        className="list-item attention-lead-item"
                        onClick={() => router.push(`/leads/${item.leadId}`)}
                      >
                        <div className="item-content">
                          <div className="item-title">
                            <Link href={`/leads/${item.leadId}`}>{item.company} - {item.title}</Link>
                          </div>
                          <div className="item-meta">idle {item.daysIdle} day{item.daysIdle !== 1 ? "s" : ""}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="section">
          <NetworkAnalysisCard onboardingCompleted={onboardingCompleted} />
        </div>

        <div className="two-col">
          <div className="list-section">
            <div className="section-header">
              <span>Recent Activity <TourTooltip text="Status changes and actions across your pipeline, grouped by when they happened." align="left" /></span>
              <Link href="/pipeline">view pipeline</Link>
            </div>
            {hasActivity ? (
              <>
                {recentActivity.today.length > 0 && (
                  <>
                    <div
                      className={`activity-group-label${recentActivity.today.length > 10 ? ' activity-group-collapsible' : ''}`}
                      onClick={recentActivity.today.length > 10 ? () => setExpandedGroups(prev => ({ ...prev, today: !prev.today })) : undefined}
                    >
                      <span>Today{recentActivity.today.length > 10 ? ` (${recentActivity.today.length})` : ''}</span>
                      {recentActivity.today.length > 10 && (
                        <span className="activity-group-toggle">{expandedGroups.today ? "−" : "+"}</span>
                      )}
                    </div>
                    {(expandedGroups.today ? recentActivity.today : recentActivity.today.slice(0, 10)).map((item, i) => (
                      <div key={`today-${i}`} className="list-item" onClick={() => router.push(`/leads/${item.leadId}`)}>
                        <div className="item-content">
                          <div className="item-title">
                            <Link href={`/leads/${item.leadId}`}>{item.company} - {item.title}</Link>
                          </div>
                          <div className="item-meta">{item.description}</div>
                        </div>
                      </div>
                    ))}
                    {!expandedGroups.today && recentActivity.today.length > 10 && (
                      <div
                        className="activity-group-collapsible"
                        style={{ fontSize: '8pt', color: '#828282', padding: '4px 8px', cursor: 'pointer' }}
                        onClick={() => setExpandedGroups(prev => ({ ...prev, today: true }))}
                      >
                        +{recentActivity.today.length - 10} more
                      </div>
                    )}
                  </>
                )}
                {recentActivity.thisWeek.length > 0 && (
                  <>
                    <div
                      className="activity-group-label activity-group-collapsible"
                      onClick={() => setExpandedGroups(prev => ({ ...prev, thisWeek: !prev.thisWeek }))}
                    >
                      <span>This Week ({recentActivity.thisWeek.length})</span>
                      <span className="activity-group-toggle">{expandedGroups.thisWeek ? "−" : "+"}</span>
                    </div>
                    {expandedGroups.thisWeek && recentActivity.thisWeek.map((item, i) => (
                      <div key={`week-${i}`} className="list-item" onClick={() => router.push(`/leads/${item.leadId}`)}>
                        <div className="item-content">
                          <div className="item-title">
                            <Link href={`/leads/${item.leadId}`}>{item.company} - {item.title}</Link>
                          </div>
                          <div className="item-meta">{item.description}</div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
                {recentActivity.lastWeek.length > 0 && (
                  <>
                    <div
                      className="activity-group-label activity-group-collapsible"
                      onClick={() => setExpandedGroups(prev => ({ ...prev, lastWeek: !prev.lastWeek }))}
                    >
                      <span>Last Week ({recentActivity.lastWeek.length})</span>
                      <span className="activity-group-toggle">{expandedGroups.lastWeek ? "−" : "+"}</span>
                    </div>
                    {expandedGroups.lastWeek && recentActivity.lastWeek.map((item, i) => (
                      <div key={`last-${i}`} className="list-item" onClick={() => router.push(`/leads/${item.leadId}`)}>
                        <div className="item-content">
                          <div className="item-title">
                            <Link href={`/leads/${item.leadId}`}>{item.company} - {item.title}</Link>
                          </div>
                          <div className="item-meta">{item.description}</div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </>
            ) : (
              <div className="list-item">
                <div className="item-content">
                  <div className="item-title">
                    <span style={{ color: "#828282", fontStyle: "italic" }}>
                      No recent activity
                    </span>
                  </div>
                  <div className="item-meta">
                    Activity from your pipeline will show here
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="list-section">
            <div className="section-header">
              <span>New Leads for You <TourTooltip text="The latest leads matching your target roles and location preferences." align="right" /></span>
              <Link href="/leads">view all leads</Link>
            </div>
            {displayLeads.length > 0 ? (
              displayLeads.map((lead, index) => (
                <div key={lead._id} className="list-item">
                  <div className="item-number">{index + 1}.</div>
                  <div className="item-content">
                    <div className="item-title">
                      <Link href={`/leads/${lead._id}`}>{lead.title}</Link>
                    </div>
                    <div className="item-meta">
                      {lead.company} | {lead.location} |{" "}
                      <span className="job-comp">
                        {lead.compensation?.raw || "N/A"}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="list-item">
                <div className="item-content">
                  <div className="item-title">
                    <span style={{ color: "#828282", fontStyle: "italic" }}>
                      No leads available yet
                    </span>
                  </div>
                  <div className="item-meta">
                    Check back soon for new opportunities
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>


      </div>
    </div>
  );
};

export default Home;

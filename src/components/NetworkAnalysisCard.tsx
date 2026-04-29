"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import api from "@/api/client";
import BellCurveChart from "./BellCurveChart";
import TourTooltip from "./TourTooltip";
import "./BellCurveChart.css";
import "./NetworkAnalysisCard.css";
import type { ScoreBucket } from "@/lib/scoring";

type ScoreLeadsResponse = {
  distribution: ScoreBucket[];
  scoredLeads: { id: string; score: number }[];
  hasConnections: boolean;
  totalLeads: number;
};

type Props = {
  onboardingCompleted: boolean;
  /** Renders a smaller, tighter version of the card (used on /network) */
  compact?: boolean;
  /** If provided, shows a Re-run button in the card header */
  onRerun?: () => void;
  rerunLoading?: boolean;
  /** If provided, shows an upload button in the card header (after connections exist) */
  onUpload?: () => void;
  /** Called once scores are loaded — surfaces scoredLeads to the parent */
  onScoresLoaded?: (leads: { id: string; score: number }[]) => void;
  /** If provided, clicking a bar calls this instead of navigating to /leads */
  onBarClick?: (range: [number, number]) => void;
  /** Highlights the active bar and dims others */
  activeScoreRange?: [number, number] | null;
};

export default function NetworkAnalysisCard({
  onboardingCompleted, compact, onRerun, rerunLoading, onUpload,
  onScoresLoaded, onBarClick, activeScoreRange,
}: Props) {
  const [data, setData] = useState<ScoreLeadsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!onboardingCompleted) {
      setLoading(false);
      return;
    }
    api.scoreLeads.get()
      .then((res) => {
        const d = res as ScoreLeadsResponse;
        setData(d);
        onScoresLoaded?.(d.scoredLeads);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [onboardingCompleted]);

  const totalScored = data?.distribution.reduce((sum, b) => sum + b.count, 0) ?? 0;
  const strongCount = data?.distribution.find((b) => b.zone === "high")?.count ?? 0;

  const cardClass = ["na-card", compact ? "na-card--compact" : ""].filter(Boolean).join(" ");
  const blankCardClass = ["na-card", "na-card--blank", compact ? "na-card--compact" : ""].filter(Boolean).join(" ");

  // ── Blank: onboarding not done ────────────────────────────────────────────
  if (!onboardingCompleted) {
    return (
      <div className={blankCardClass}>
        <div className="na-card-header">
          <span className="na-card-title">Lead Analysis</span>
        </div>
        <div className="na-blank-body">
          <div className="na-blank-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4l3 3" />
            </svg>
          </div>
          <p className="na-blank-text">
            Complete setup to see your lead match analysis.
          </p>
          <Link href="/network" className="na-blank-btn">Complete setup</Link>
        </div>
      </div>
    );
  }

  // ── Blank: loading ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={blankCardClass}>
        <div className="na-card-header">
          <span className="na-card-title">Lead Analysis</span>
        </div>
        <div className="na-blank-body na-blank-body--loading">
          <div className="na-skeleton na-skeleton--chart" />
        </div>
      </div>
    );
  }

  // ── Blank: no connections uploaded ───────────────────────────────────────
  if (!data?.hasConnections) {
    return (
      <div className={blankCardClass}>
        <div className="na-card-header">
          <span className="na-card-title">Lead Analysis</span>
        </div>
        <div className="na-blank-body">
          <div className="na-blank-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <p className="na-blank-text">
            Upload your LinkedIn connections to see how your network overlaps with open roles.
          </p>
          {!compact && <Link href="/network" className="na-blank-btn">Go to Network →</Link>}
        </div>
      </div>
    );
  }

  // ── Populated: show chart ─────────────────────────────────────────────────
  return (
    <div className={cardClass}>
      <div className="na-card-header">
        <span className="na-card-title">
          Lead Analysis
          <TourTooltip
            text="Each lead is scored 0–100 across role fit, compensation, location, network connections, referrals, and recency. Low = 0–39, Moderate = 40–79, Strong = 80–100."
            align="left"
          />
        </span>
        <div className="na-card-header-actions">
          {onRerun && (
            <button
              className="btn btn-secondary na-rerun-btn"
              onClick={onRerun}
              disabled={rerunLoading}
            >
              {rerunLoading ? "Running..." : "Re-run"}
            </button>
          )}
          {onUpload && (
            <button
              className="btn btn-secondary na-rerun-btn"
              onClick={onUpload}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Upload new Connections.csv
            </button>
          )}
          {!compact && (
            <Link href="/network" className="na-card-link">view network</Link>
          )}
        </div>
      </div>

      {strongCount > 0 && (
        <div className="na-callout">
          <strong>{strongCount}</strong> lead{strongCount !== 1 ? "s" : ""} with strong network overlap
        </div>
      )}

      <BellCurveChart
        distribution={data.distribution}
        compact={compact}
        onBarClick={onBarClick}
        activeRange={activeScoreRange}
      />

      <p className="na-footer-note">
        Scored across {totalScored.toLocaleString()} leads using your profile, network, and referrals.
      </p>
    </div>
  );
}

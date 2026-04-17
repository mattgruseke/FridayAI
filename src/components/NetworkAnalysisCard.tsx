"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import api from "@/api/client";
import BellCurveChart from "./BellCurveChart";
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
};

export default function NetworkAnalysisCard({ onboardingCompleted }: Props) {
  const [data, setData] = useState<ScoreLeadsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!onboardingCompleted) {
      setLoading(false);
      return;
    }
    api.scoreLeads.get()
      .then((res) => setData(res as ScoreLeadsResponse))
      .catch(() => {}) // fail silently — card stays in blank state
      .finally(() => setLoading(false));
  }, [onboardingCompleted]);

  const totalScored = data?.distribution.reduce((sum, b) => sum + b.count, 0) ?? 0;
  const strongCount = data?.distribution.find((b) => b.zone === "high")?.count ?? 0;

  // ── Blank: onboarding not done ────────────────────────────────────────────
  if (!onboardingCompleted) {
    return (
      <div className="na-card na-card--blank">
        <div className="na-card-header">
          <span className="na-card-title">Network Analysis</span>
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
      <div className="na-card na-card--blank">
        <div className="na-card-header">
          <span className="na-card-title">Network Analysis</span>
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
      <div className="na-card na-card--blank">
        <div className="na-card-header">
          <span className="na-card-title">Network Analysis</span>
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
          <Link href="/network" className="na-blank-btn">Go to Network →</Link>
        </div>
      </div>
    );
  }

  // ── Populated: show chart ─────────────────────────────────────────────────
  return (
    <div className="na-card">
      <div className="na-card-header">
        <span className="na-card-title">Network Analysis</span>
        <Link href="/network" className="na-card-link">view network</Link>
      </div>

      {strongCount > 0 && (
        <div className="na-callout">
          <strong>{strongCount}</strong> lead{strongCount !== 1 ? "s" : ""} with strong network overlap
        </div>
      )}

      <BellCurveChart distribution={data.distribution} />

      <p className="na-footer-note">
        Scored across {totalScored.toLocaleString()} leads using your profile, network, and referrals.
      </p>
    </div>
  );
}

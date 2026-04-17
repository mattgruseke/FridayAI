"use client";

import { useState } from "react";
import api from "@/api/client";
import "./Tour.css";

type TourStep = {
  icon: React.ReactNode;
  title: string;
  description: string;
};

const TOUR_STEPS: TourStep[] = [
  {
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
    title: "Your Dashboard",
    description: "See your pipeline at a glance — active lead counts, recent activity, leads that need attention, and new leads matching your role preferences.",
  },
  {
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="5" height="18" rx="1" />
        <rect x="10" y="7" width="5" height="14" rx="1" />
        <rect x="17" y="5" width="5" height="16" rx="1" />
      </svg>
    ),
    title: "Pipeline",
    description: "Track every lead as it moves through stages — Saved, Contacted, Applied, Interviewing, and Offer. Stay on top of follow-ups and never let a lead go cold.",
  },
  {
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
    ),
    title: "Leads",
    description: "Browse all available job leads, filtered to your role and location preferences. Save leads to start tracking them, or add them directly to a list.",
  },
  {
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <circle cx="3" cy="6" r="1" fill="currentColor" />
        <circle cx="3" cy="12" r="1" fill="currentColor" />
        <circle cx="3" cy="18" r="1" fill="currentColor" />
      </svg>
    ),
    title: "Lists",
    description: "Organize leads into named collections — \"Dream companies\", \"Apply this week\", or anything that fits your process. Share lists or keep them private.",
  },
  {
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: "Network",
    description: "Upload your LinkedIn connections CSV and GigFrog cross-references them against every open lead — so you always know who you know at each company before you apply.",
  },
  {
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
        <polyline points="16 11 18 13 22 9" />
      </svg>
    ),
    title: "Referrals",
    description: "Track people who've agreed to refer you at specific companies. Link them to open leads and keep notes so nothing falls through the cracks.",
  },
];

type Props = {
  onDismiss: () => void;
};

export default function TourModal({ onDismiss }: Props) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const current = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      handleFinish();
    } else {
      setStep((s) => s + 1);
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      await api.profile.completeTour();
    } catch {
      // best effort
    }
    onDismiss();
  };

  return (
    <div className="modal-overlay tour-overlay">
      <div className="modal-content tour-modal">
        <div className="tour-icon">{current.icon}</div>

        <div className="tour-header">
          <h2 className="tour-title">{current.title}</h2>
          <p className="tour-description">{current.description}</p>
        </div>

        {/* Step dots */}
        <div className="tour-dots">
          {TOUR_STEPS.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`tour-dot ${i === step ? "tour-dot--active" : i < step ? "tour-dot--done" : ""}`}
              onClick={() => setStep(i)}
              aria-label={`Go to step ${i + 1}`}
            />
          ))}
        </div>

        <div className="tour-footer">
          <button
            type="button"
            className="tour-btn-primary"
            onClick={handleNext}
            disabled={saving}
          >
            {isLast ? (saving ? "Saving…" : "Get started →") : "Next →"}
          </button>
          {!isLast && (
            <button
              type="button"
              className="tour-btn-skip"
              onClick={handleFinish}
              disabled={saving}
            >
              Skip tour
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

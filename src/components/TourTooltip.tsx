"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import "./Tour.css";

type Props = {
  text: string;
  align?: "center" | "left" | "right";
};

export default function TourTooltip({ text, align = "center" }: Props) {
  const { onboardingCompleted, onboardingSkipped } = useAuth();
  const [visible, setVisible] = useState(false);

  // Only render once the user has completed or skipped onboarding
  if (!onboardingCompleted && !onboardingSkipped) return null;

  const alignClass =
    align === "left" ? "tour-tip-wrap--left" :
    align === "right" ? "tour-tip-wrap--right" : "";

  return (
    <span
      className={`tour-tip-wrap ${alignClass}`}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <span className="tour-tip-badge" aria-label={text}>?</span>
      {visible && (
        <span className="tour-tip-popup" role="tooltip">{text}</span>
      )}
    </span>
  );
}

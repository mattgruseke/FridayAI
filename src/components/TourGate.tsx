"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import TourModal from "./TourModal";

export default function TourGate() {
  const { isAuthenticated, onboardingCompleted, onboardingSkipped, tourCompleted, refreshProfile } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const eligible = onboardingCompleted || onboardingSkipped;
    if (isAuthenticated && eligible && !tourCompleted) {
      setShow(true);
    }
  }, [isAuthenticated, onboardingCompleted, onboardingSkipped, tourCompleted]);

  if (!show) return null;

  const handleDismiss = async () => {
    setShow(false);
    await refreshProfile();
  };

  return <TourModal onDismiss={handleDismiss} />;
}

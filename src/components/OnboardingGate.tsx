"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import OnboardingModal from "./OnboardingModal";

export default function OnboardingGate() {
  const { isAuthenticated, onboardingCompleted, onboardingSkipped, refreshProfile } = useAuth();
  const router = useRouter();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isAuthenticated && !onboardingCompleted && !onboardingSkipped) {
      setShow(true);
    }
  }, [isAuthenticated, onboardingCompleted, onboardingSkipped]);

  if (!show) return null;

  const handleDismiss = async () => {
    setShow(false);
    await refreshProfile();
    router.push("/");
  };

  return <OnboardingModal onDismiss={handleDismiss} />;
}

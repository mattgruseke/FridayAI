"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { onboardingAPI } from "@/api/client";

const ROLE_CHIPS = [
  "Solutions Engineer",
  "Sales Engineer",
  "Technical Account Manager",
  "Customer Success Manager",
  "Customer Success Engineer",
  "Solutions Architect",
  "Implementation Specialist",
  "Software Engineer",
  "Product Manager",
  "DevOps / Platform Engineer",
  "Data Engineer",
  "UX / Product Designer",
];

type OnboardingModalProps = {
  onDismiss: () => void | Promise<void>;
  mode?: "onboarding" | "edit";
  initialRoles?: string[];
};

type CompletedResult = {
  listId: string;
  leadCount: number;
};

export default function OnboardingModal({
  onDismiss,
  mode = "onboarding",
  initialRoles = [],
}: OnboardingModalProps) {
  const router = useRouter();
  const isEdit = mode === "edit";

  const knownInitial = initialRoles.filter((r) => ROLE_CHIPS.includes(r));
  const customInitial = initialRoles.filter((r) => r !== "Remote" && r !== "Hybrid" && !ROLE_CHIPS.includes(r));

  const [selectedRoles, setSelectedRoles] = useState<string[]>(knownInitial);
  const [remoteOnly, setRemoteOnly] = useState(initialRoles.includes("Remote"));
  const [hybridSelected, setHybridSelected] = useState(initialRoles.includes("Hybrid"));
  const [otherSelected, setOtherSelected] = useState(customInitial.length > 0);
  const [customRoles, setCustomRoles] = useState<string[]>(customInitial.length > 0 ? customInitial : [""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [completed, setCompleted] = useState<CompletedResult | null>(null);

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const toggleOther = () => {
    setOtherSelected((prev) => {
      if (prev) setCustomRoles([""]);
      return !prev;
    });
  };

  const updateCustomRole = (index: number, value: string) => {
    setCustomRoles((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  const addCustomRole = () => setCustomRoles((prev) => [...prev, ""]);

  const removeCustomRole = (index: number) =>
    setCustomRoles((prev) => prev.filter((_, i) => i !== index));

  const allRoles = [
    ...selectedRoles,
    ...(remoteOnly ? ["Remote"] : []),
    ...(hybridSelected ? ["Hybrid"] : []),
    ...customRoles.map((r) => r.trim()).filter(Boolean),
  ];

  const handleSubmit = async () => {
    if (allRoles.length === 0) {
      setError("Please select at least one role.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      if (isEdit) {
        await onboardingAPI.saveRoles(allRoles);
        setSaved(true);
        setTimeout(() => {
          setSaved(false);
          onDismiss();
        }, 1200);
      } else {
        const result = await onboardingAPI.complete(allRoles) as { list?: { _id?: string }; leadCount?: number };
        // Show success screen before dismissing (onDismiss unmounts the gate)
        setCompleted({
          listId: result?.list?._id ?? "",
          leadCount: result?.leadCount ?? 0,
        });
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    try {
      await onboardingAPI.skip();
    } catch {
      // best effort
    }
    onDismiss();
  };

  const handleSeeList = async () => {
    await onDismiss();
    if (completed?.listId) {
      router.push(`/lists/${completed.listId}`);
    }
  };

  const handleGoDashboard = async () => {
    await onDismiss();
    router.push("/");
  };

  // Success screen shown after onboarding completes
  if (completed) {
    return (
      <div className="modal-overlay onboarding-overlay">
        <div className="modal-content onboarding-modal onboarding-modal--success">
          <div className="onboarding-success-icon">
            <img src="/frog.svg" alt="GigFrog" width={48} height={48} />
          </div>
          <h2 className="onboarding-title" style={{ fontSize: "1.4rem" }}>Your list is ready!</h2>
          <p className="onboarding-subtitle">
            We found <strong>{completed.leadCount}</strong> lead{completed.leadCount !== 1 ? "s" : ""} matching your criteria and saved them to your first list.
          </p>
          <div className="onboarding-footer" style={{ marginTop: 28 }}>
            <button
              type="button"
              className="onboarding-btn-primary"
              onClick={handleSeeList}
            >
              See My List →
            </button>
            <button
              type="button"
              className="onboarding-btn-skip"
              onClick={handleGoDashboard}
            >
              Go to dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay onboarding-overlay">
      <div className="modal-content onboarding-modal">
        {!isEdit && (
          <div className="onboarding-header">
            <div className="onboarding-logo">
              <img src="/frog.svg" alt="GigFrog" width={48} height={48} />
            </div>
            <h2 className="onboarding-title">Welcome to GigFrog</h2>
            <p className="onboarding-subtitle">
              Finding a job sucks. GigFrog helps you find better leads, reach the right people, and track everything in one place — so you get more interviews, faster. Let's get started.
            </p>
          </div>
        )}

        {isEdit && (
          <div className="onboarding-header">
            <h2 className="onboarding-title" style={{ fontSize: "1.2rem" }}>
              Configure Preferences
            </h2>
          </div>
        )}

        <div className="onboarding-body">
          <p className="onboarding-label">Which roles are you looking for?</p>
          <div className="onboarding-chips">
            {ROLE_CHIPS.map((role) => (
              <button
                key={role}
                type="button"
                className={`onboarding-chip ${selectedRoles.includes(role) ? "onboarding-chip--selected" : ""}`}
                onClick={() => toggleRole(role)}
              >
                {role}
              </button>
            ))}
            <button
              type="button"
              className={`onboarding-chip ${otherSelected ? "onboarding-chip--selected" : ""}`}
              onClick={toggleOther}
            >
              Other
            </button>
          </div>

          <p className="onboarding-label" style={{ marginTop: 16 }}>Work location preference</p>
          <div className="onboarding-chips">
            <button
              type="button"
              className={`onboarding-chip onboarding-chip--remote ${remoteOnly ? "onboarding-chip--selected" : ""}`}
              onClick={() => setRemoteOnly((v) => !v)}
            >
              Remote
            </button>
            <button
              type="button"
              className={`onboarding-chip onboarding-chip--remote ${hybridSelected ? "onboarding-chip--selected" : ""}`}
              onClick={() => setHybridSelected((v) => !v)}
            >
              Hybrid
            </button>
          </div>

          {otherSelected && (
            <div className="onboarding-custom-roles">
              {customRoles.map((role, i) => (
                <div key={i} className="onboarding-custom-role-row">
                  <input
                    type="text"
                    className="modal-input onboarding-custom-input"
                    placeholder="e.g. Presales Consultant"
                    value={role}
                    onChange={(e) => updateCustomRole(i, e.target.value)}
                  />
                  {customRoles.length > 1 && (
                    <button
                      type="button"
                      className="onboarding-remove-role"
                      onClick={() => removeCustomRole(i)}
                      aria-label="Remove"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
              <button type="button" className="onboarding-add-role" onClick={addCustomRole}>
                + Add another
              </button>
            </div>
          )}

          {error && <p className="onboarding-error">{error}</p>}
        </div>

        <div className="onboarding-footer">
          <button
            type="button"
            className="onboarding-btn-primary"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "Finding leads…" : saved ? "Saved!" : isEdit ? "Save Roles" : "Get Started"}
          </button>
          {!isEdit ? (
            <button
              type="button"
              className="onboarding-btn-skip"
              onClick={handleSkip}
              disabled={loading}
            >
              Skip for now
            </button>
          ) : (
            <button
              type="button"
              className="onboarding-btn-skip"
              onClick={onDismiss}
              disabled={loading}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

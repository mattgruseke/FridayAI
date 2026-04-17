"use client";

import { useState } from "react";
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

const COMP_RANGES = [
  "$50k – $100k",
  "$101k – $150k",
  "$151k – $200k",
  "$201k+",
];

const SITUATION_OPTIONS = [
  { value: "laid_off", label: "Just laid off", sub: "Let's move fast" },
  { value: "active", label: "Actively searching", sub: "Employed but ready to move" },
  { value: "passive", label: "Open to opportunities", sub: "Passively looking" },
  { value: "exploring", label: "Just exploring", sub: "Not in a rush" },
];

const TOTAL_STEPS = 6;

// Step routing:
//   Non laid-off: 1=welcome, 2=situation, 3=roles, 4=comp, 5=location, 6=linkedin
//   Laid-off:     1=welcome, 2=situation, 3=linkedin, 4=roles, 5=comp, 6=location
type StepName = "welcome" | "situation" | "roles" | "comp" | "location" | "linkedin";

function getStepName(step: number, laidOff: boolean): StepName {
  if (step === 1) return "welcome";
  if (step === 2) return "situation";
  if (!laidOff) {
    if (step === 3) return "roles";
    if (step === 4) return "comp";
    if (step === 5) return "location";
    return "linkedin";
  } else {
    if (step === 3) return "linkedin";
    if (step === 4) return "roles";
    if (step === 5) return "comp";
    return "location";
  }
}

type OnboardingModalProps = {
  onDismiss: () => void | Promise<void>;
  mode?: "onboarding" | "edit";
  initialRoles?: string[];
  initialCompensation?: string[];
};

export default function OnboardingModal({
  onDismiss,
  mode = "onboarding",
  initialRoles = [],
  initialCompensation = [],
}: OnboardingModalProps) {
  const isEdit = mode === "edit";

  const knownInitial = initialRoles.filter((r) => ROLE_CHIPS.includes(r));
  const customInitial = initialRoles.filter(
    (r) =>
      r !== "Remote" &&
      r !== "Hybrid" &&
      r !== "Onsite" &&
      !ROLE_CHIPS.includes(r)
  );

  // Edit mode starts at step 3 (roles) — situation step is onboarding-only
  const [step, setStep] = useState(isEdit ? 3 : 1);
  const [jobSituation, setJobSituation] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>(knownInitial);
  const [selectedComp, setSelectedComp] = useState<string[]>(
    initialCompensation.filter((c) => COMP_RANGES.includes(c))
  );
  const [remoteOnly, setRemoteOnly] = useState(initialRoles.includes("Remote"));
  const [hybridSelected, setHybridSelected] = useState(
    initialRoles.includes("Hybrid")
  );
  const [onsiteSelected, setOnsiteSelected] = useState(
    initialRoles.includes("Onsite")
  );
  const [otherSelected, setOtherSelected] = useState(customInitial.length > 0);
  const [customRoles, setCustomRoles] = useState<string[]>(
    customInitial.length > 0 ? customInitial : [""]
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const isLaidOff = jobSituation === "laid_off";
  const stepName = getStepName(step, isLaidOff);

  const toggleRole = (role: string) =>
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );

  const toggleComp = (range: string) =>
    setSelectedComp((prev) =>
      prev.includes(range) ? prev.filter((r) => r !== range) : [...prev, range]
    );

  const toggleOther = () => {
    setOtherSelected((prev) => {
      if (prev) setCustomRoles([""]);
      return !prev;
    });
  };

  const updateCustomRole = (index: number, value: string) =>
    setCustomRoles((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });

  const allRoles = [
    ...selectedRoles,
    ...(remoteOnly ? ["Remote"] : []),
    ...(hybridSelected ? ["Hybrid"] : []),
    ...(onsiteSelected ? ["Onsite"] : []),
    ...customRoles.map((r) => r.trim()).filter(Boolean),
  ];

  const handleNext = () => {
    if (stepName === "situation" && !jobSituation) {
      setError("Please select your current situation.");
      return;
    }
    if (stepName === "roles" && allRoles.length === 0) {
      setError("Please select at least one role.");
      return;
    }
    setError("");
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    setError("");
    setStep((s) => s - 1);
  };

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
        await onboardingAPI.complete(allRoles, selectedComp);
        onDismiss();
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

  const stepDots = !isEdit ? (
    <div className="onboarding-steps">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <span
          key={i}
          className={`onboarding-dot ${step === i + 1 ? "onboarding-dot--active" : step > i + 1 ? "onboarding-dot--done" : ""}`}
        />
      ))}
    </div>
  ) : null;

  // ── Step 1: Welcome ──
  if (stepName === "welcome") {
    return (
      <div className="modal-overlay onboarding-overlay">
        <div className="modal-content onboarding-modal">
          <div className="onboarding-header">
            <div className="onboarding-logo">
              <img src="/frog.svg" alt="GigFrog" width={48} height={48} />
            </div>
            <h2 className="onboarding-title">Welcome to GigFrog</h2>
            <p className="onboarding-subtitle">
              Finding a job sucks. GigFrog helps you find better leads, reach
              the right people, and track everything in one place — so you get
              more interviews, faster.
            </p>
          </div>
          {stepDots}
          <div className="onboarding-footer" style={{ marginTop: 28 }}>
            <button
              type="button"
              className="onboarding-btn-primary"
              onClick={() => setStep(2)}
            >
              Let's get started →
            </button>
            <button
              type="button"
              className="onboarding-btn-skip"
              onClick={handleSkip}
            >
              Skip setup
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: Job Situation ──
  if (stepName === "situation") {
    return (
      <div className="modal-overlay onboarding-overlay">
        <div className="modal-content onboarding-modal">
          <div className="onboarding-header">
            <h2 className="onboarding-title">What's your current situation?</h2>
            <p className="onboarding-subtitle">
              This helps us tailor your experience and surface what matters most right now.
            </p>
          </div>
          {stepDots}
          <div className="onboarding-body">
            <div className="onboarding-situation-options">
              {SITUATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`onboarding-situation-option ${jobSituation === opt.value ? "onboarding-situation-option--selected" : ""}`}
                  onClick={() => setJobSituation(opt.value)}
                >
                  <div className="onboarding-situation-text">
                    <span className="onboarding-situation-label">{opt.label}</span>
                    {opt.sub && (
                      <span className="onboarding-situation-sub">{opt.sub}</span>
                    )}
                  </div>
                  <div className={`onboarding-situation-radio ${jobSituation === opt.value ? "onboarding-situation-radio--selected" : ""}`} />
                </button>
              ))}
            </div>
            {error && <p className="onboarding-error">{error}</p>}
          </div>
          <div className="onboarding-footer">
            <button
              type="button"
              className="onboarding-btn-primary"
              onClick={handleNext}
            >
              Next →
            </button>
            <button
              type="button"
              className="onboarding-btn-skip"
              onClick={handleBack}
            >
              ← Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── LinkedIn step (step 3 for laid-off, step 6 for everyone else) ──
  if (stepName === "linkedin") {
    const isEarly = isLaidOff; // shown mid-flow for laid-off users
    return (
      <div className="modal-overlay onboarding-overlay">
        <div className="modal-content onboarding-modal">
          <div className="onboarding-header">
            <h2 className="onboarding-title">
              {isEarly ? "Start your network export — now" : "Unlock your network"}
            </h2>
            <p className="onboarding-subtitle">
              {isEarly
                ? "LinkedIn exports can take up to 24 hours. Since you're between roles, start this request today so your connections are ready the moment you need them."
                : "GigFrog can cross-reference your LinkedIn connections against hiring companies — so you always know who to reach out to."}
            </p>
          </div>
          {stepDots}
          <div className="onboarding-body">
            <div className="onboarding-linkedin-steps">
              <div className="onboarding-linkedin-step">
                <span className="onboarding-linkedin-num">1</span>
                <span>
                  Go to{" "}
                  <a
                    href="https://www.linkedin.com/mypreferences/d/categories/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    LinkedIn → Settings → Data Privacy
                  </a>
                </span>
              </div>
              <div className="onboarding-linkedin-step">
                <span className="onboarding-linkedin-num">2</span>
                <span>Click <strong>Data Privacy</strong> → <strong>Download my data</strong> → select <strong>Download larger data archive...</strong> → Click <strong>Request archive</strong></span>
              </div>
              <div className="onboarding-linkedin-step">
                <span className="onboarding-linkedin-num">3</span>
                <span>LinkedIn will email you a download link — <strong>this can take up to 24 hours</strong></span>
              </div>
              <div className="onboarding-linkedin-step">
                <span className="onboarding-linkedin-num">4</span>
                <span>Come back and upload the <strong>Connections.csv</strong> in the <strong>Network</strong> tab</span>
              </div>
            </div>
          </div>
          <div className="onboarding-footer">
            <button
              type="button"
              className="onboarding-btn-primary"
              onClick={isEarly ? handleNext : handleSubmit}
              disabled={loading}
            >
              {isEarly
                ? "Got it — let's keep going →"
                : loading
                  ? "Saving…"
                  : "Got it, I'll upload when ready"}
            </button>
            <button
              type="button"
              className="onboarding-btn-skip"
              onClick={handleBack}
            >
              ← Back
            </button>
          </div>
          {!isEarly && error && (
            <p className="onboarding-error" style={{ textAlign: "center", marginTop: 8 }}>
              {error}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Roles step ──
  if (stepName === "roles") {
    return (
      <div className="modal-overlay onboarding-overlay">
        <div className="modal-content onboarding-modal">
          {!isEdit && (
            <div className="onboarding-header">
              <h2 className="onboarding-title">What roles are you targeting?</h2>
              <p className="onboarding-subtitle">
                Select all that apply — we'll use this to surface the most
                relevant leads.
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
          {stepDots}
          <div className="onboarding-body">
            <p className="onboarding-label">Target roles</p>
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
                        onClick={() =>
                          setCustomRoles((prev) =>
                            prev.filter((_, idx) => idx !== i)
                          )
                        }
                        aria-label="Remove"
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path
                            d="M1 1l12 12M13 1L1 13"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="onboarding-add-role"
                  onClick={() => setCustomRoles((prev) => [...prev, ""])}
                >
                  + Add another
                </button>
              </div>
            )}

            {error && <p className="onboarding-error">{error}</p>}
          </div>

          <div className="onboarding-footer">
            {!isEdit ? (
              <>
                <button
                  type="button"
                  className="onboarding-btn-primary"
                  onClick={handleNext}
                >
                  Next →
                </button>
                <button
                  type="button"
                  className="onboarding-btn-skip"
                  onClick={handleBack}
                >
                  ← Back
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="onboarding-btn-primary"
                  onClick={handleSubmit}
                  disabled={loading}
                >
                  {loading ? "Saving…" : saved ? "Saved!" : "Save Roles"}
                </button>
                <button
                  type="button"
                  className="onboarding-btn-skip"
                  onClick={onDismiss}
                  disabled={loading}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Compensation step ──
  if (stepName === "comp") {
    return (
      <div className="modal-overlay onboarding-overlay">
        <div className="modal-content onboarding-modal">
          <div className="onboarding-header">
            <h2 className="onboarding-title">What's your compensation target?</h2>
            <p className="onboarding-subtitle">
              Select one or more ranges — we'll use this to prioritize leads.
            </p>
          </div>
          {stepDots}
          <div className="onboarding-body">
            <div className="onboarding-chips">
              {COMP_RANGES.map((range) => (
                <button
                  key={range}
                  type="button"
                  className={`onboarding-chip ${selectedComp.includes(range) ? "onboarding-chip--selected" : ""}`}
                  onClick={() => toggleComp(range)}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
          <div className="onboarding-footer">
            <button
              type="button"
              className="onboarding-btn-primary"
              onClick={handleNext}
            >
              Next →
            </button>
            <button
              type="button"
              className="onboarding-btn-skip"
              onClick={handleBack}
            >
              ← Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Location step ──
  if (stepName === "location") {
    return (
      <div className="modal-overlay onboarding-overlay">
        <div className="modal-content onboarding-modal">
          <div className="onboarding-header">
            <h2 className="onboarding-title">Work location preference</h2>
            <p className="onboarding-subtitle">
              Select all that work for you.
            </p>
          </div>
          {stepDots}
          <div className="onboarding-body">
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
              <button
                type="button"
                className={`onboarding-chip onboarding-chip--remote ${onsiteSelected ? "onboarding-chip--selected" : ""}`}
                onClick={() => setOnsiteSelected((v) => !v)}
              >
                Onsite
              </button>
            </div>
          </div>
          <div className="onboarding-footer">
            {isLaidOff ? (
              <button
                type="button"
                className="onboarding-btn-primary"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? "Saving…" : "Finish setup"}
              </button>
            ) : (
              <button
                type="button"
                className="onboarding-btn-primary"
                onClick={handleNext}
              >
                Next →
              </button>
            )}
            <button
              type="button"
              className="onboarding-btn-skip"
              onClick={handleBack}
            >
              ← Back
            </button>
          </div>
          {isLaidOff && error && (
            <p className="onboarding-error" style={{ textAlign: "center", marginTop: 8 }}>
              {error}
            </p>
          )}
        </div>
      </div>
    );
  }

  return null;
}

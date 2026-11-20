"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import api from "../api/client";
import type { IntakeProvider } from "../api/client";
import { useToast } from "../hooks/useToast";
import { getErrorMessage } from "../lib/errors";
import {
  HOME_MANAGER_AGENT as AGENT,
  hasInspectionReport,
  INSPECTION_REPORT_FIELD,
  INSPECTION_REPORT_NAME,
  INSPECTION_REPORT_PATH,
  isAnswered,
  isCovered,
  PROVIDER_CATEGORIES,
  TIER_A,
  TIER_B,
} from "@/config/homeManagerIntake";
import type { Question } from "@/config/homeManagerIntake";

// Home Manager intake (see 01_home_manager.md, Parts 3, 4, 6 and 7).
// One question per screen. Answers autosave via /api/intake and are loaded
// back on open.

type Provider = IntakeProvider;

const emptyProvider = (): Provider => ({ name: "", category: "", contact: "" });

const filled = (v: string | undefined) => !!v && v.trim() !== "";

type Step =
  | { kind: "question"; q: Question; required: boolean }
  | { kind: "inspection" }
  | { kind: "providers" }
  | { kind: "checkpoint" }
  | { kind: "done" };

// Tier A in interview order (inspection report after move-in date, providers
// before known_problems), a checkpoint once the agent can activate, then Tier B.
const STEPS: Step[] = [
  ...TIER_A.slice(0, 4).map((q) => ({ kind: "question" as const, q, required: true })),
  { kind: "inspection" },
  ...TIER_A.slice(4, 5).map((q) => ({ kind: "question" as const, q, required: true })),
  { kind: "providers" },
  ...TIER_A.slice(5).map((q) => ({ kind: "question" as const, q, required: true })),
  { kind: "checkpoint" },
  ...TIER_B.map((q) => ({ kind: "question" as const, q, required: false })),
  { kind: "done" },
];

const CHECKPOINT = STEPS.findIndex((s) => s.kind === "checkpoint");
const DONE = STEPS.length - 1;

const INSPECTION_COVERS = TIER_B.filter((q) => q.inInspection);

const REPORT_ACCEPT = "application/pdf,image/jpeg,image/png,image/heic";

const Intake = () => {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [providers, setProviders] = useState<Provider[]>([emptyProvider()]);
  const [stepIndex, setStepIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  // JSON of the last payload saved or loaded, so autosave only fires on real changes.
  const lastSaved = useRef<string | null>(null);
  const { showToast, toastElement } = useToast();

  // Load saved answers once.
  useEffect(() => {
    api.intake
      .get(AGENT)
      .then((saved) => {
        const savedAnswers = saved?.answers ?? {};
        const savedProviders = saved?.known_providers ?? [];
        lastSaved.current = JSON.stringify({
          answers: savedAnswers,
          known_providers: savedProviders,
        });
        if (!saved) return;
        setAnswers(savedAnswers);
        if (savedProviders.length) setProviders(savedProviders);
        setSavedAt(saved.updated_at);
        setSaveState("saved");
      })
      .catch((err) => showToast(getErrorMessage(err), "error"))
      .finally(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const payload = () => ({
    answers,
    known_providers: providers.filter((p) => filled(p.name)),
  });

  const save = async () => {
    const data = payload();
    setSaveState("saving");
    try {
      const { updated_at } = await api.intake.save(AGENT, data);
      lastSaved.current = JSON.stringify(data);
      setSavedAt(updated_at);
      setSaveState("saved");
    } catch (err) {
      setSaveState("error");
      showToast(getErrorMessage(err), "error");
    }
  };

  // Autosave shortly after any change.
  useEffect(() => {
    if (!loaded || JSON.stringify(payload()) === lastSaved.current) return;
    const timer = setTimeout(save, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, providers, loaded]);

  const step = STEPS[stepIndex];
  const hasProvider = providers.some((p) => filled(p.name));

  const set = (field: string, value: string) =>
    setAnswers((prev) => ({ ...prev, [field]: value }));

  const updateProvider = (index: number, patch: Partial<Provider>) =>
    setProviders((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));

  const hasReport = hasInspectionReport(answers);

  // With a report uploaded, questions it usually answers are skipped (unless
  // they were already answered by hand).
  const isSkipped = (i: number) => {
    const s = STEPS[i];
    return s.kind === "question" && !!s.q.inInspection && hasReport && !isAnswered(s.q, answers);
  };

  const goTo = (index: number) => setStepIndex(Math.max(0, Math.min(DONE, index)));
  const next = () => {
    let i = stepIndex + 1;
    while (i < DONE && isSkipped(i)) i++;
    goTo(i);
  };
  const back = () => {
    let i = stepIndex - 1;
    while (i > 0 && isSkipped(i)) i--;
    goTo(i);
  };

  // Part 7 completeness. known_providers counts as a Tier A field.
  const tierAMissing =
    TIER_A.filter((q) => !isAnswered(q, answers)).length + (hasProvider ? 0 : 1);
  const tierBTotal = TIER_B.reduce((sum, q) => sum + (q.weight ?? 0), 0);
  const tierBDone = TIER_B.reduce(
    (sum, q) => sum + (isCovered(q, answers) ? q.weight ?? 0 : 0),
    0
  );
  const tierBRemaining = TIER_B.filter((q) => !isCovered(q, answers)).length;
  const tierBReport = hasReport
    ? TIER_B.filter((q) => q.inInspection && !isAnswered(q, answers)).length
    : 0;

  const status =
    tierAMissing > 0
      ? {
          state: "not-active",
          label: "Not active",
          copy: `Home Manager needs ${tierAMissing} more answer${tierAMissing === 1 ? "" : "s"} before it can start.`,
        }
      : tierBDone / tierBTotal >= 0.6
        ? { state: "well-fed", label: "Well-fed", copy: "Home Manager knows your house well." }
        : { state: "active", label: "Active", copy: "Home Manager is running." };

  const canAdvance =
    step.kind === "question"
      ? !step.required || isAnswered(step.q, answers)
      : step.kind === "providers"
        ? hasProvider
        : true;

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const previous = answers[INSPECTION_REPORT_PATH];
      const { name, path } = await api.intake.uploadReport(file);
      setAnswers((prev) => ({
        ...prev,
        [INSPECTION_REPORT_FIELD]: "Yes",
        [INSPECTION_REPORT_NAME]: name,
        [INSPECTION_REPORT_PATH]: path,
      }));
      if (previous) api.intake.deleteReport(previous).catch(() => {});
      showToast("Inspection report uploaded");
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveReport = async () => {
    const path = answers[INSPECTION_REPORT_PATH];
    try {
      if (path) await api.intake.deleteReport(path);
      setAnswers((prev) => ({
        ...prev,
        [INSPECTION_REPORT_NAME]: "",
        [INSPECTION_REPORT_PATH]: "",
      }));
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    }
  };

  const handleSave = async () => {
    await save();
    showToast("Answers saved");
  };

  const saveLabel =
    saveState === "saving"
      ? "Saving…"
      : saveState === "error"
        ? "Not saved"
        : saveState === "saved" && savedAt
          ? `Saved ${new Date(savedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
          : "";

  // Enter moves on from single-line inputs.
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (canAdvance) next();
    }
  };

  const renderInput = (q: Question) => {
    const value = answers[q.field] ?? "";

    if (q.type === "select") {
      return (
        <div className="bubbles" role="radiogroup" aria-label={q.label}>
          {q.options!.map((o) => (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={value === o}
              className={`bubble${value === o ? " bubble--selected" : ""}`}
              onClick={() => {
                set(q.field, o);
                next();
              }}
            >
              {o}
            </button>
          ))}
        </div>
      );
    }
    if (q.type === "address") {
      return (
        <div className="address-fields">
          {q.parts!.map((p, i) => (
            <label key={p.field} className={`address-field address-field--${p.field}`}>
              <span className="address-label">{p.label}</span>
              <input
                id={i === 0 ? q.field : p.field}
                className="input"
                value={answers[p.field] ?? ""}
                placeholder={p.placeholder}
                autoComplete={p.autoComplete}
                inputMode={p.inputMode}
                autoFocus={i === 0}
                onChange={(e) => set(p.field, e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </label>
          ))}
        </div>
      );
    }
    if (q.type === "textarea") {
      return (
        <textarea
          id={q.field}
          className="input textarea"
          rows={5}
          value={value}
          placeholder={q.placeholder}
          autoFocus
          onChange={(e) => set(q.field, e.target.value)}
        />
      );
    }
    return (
      <input
        id={q.field}
        className="input"
        type={q.type}
        value={value}
        placeholder={q.placeholder}
        autoFocus
        onChange={(e) => set(q.field, e.target.value)}
        onKeyDown={handleKeyDown}
      />
    );
  };

  const renderProviders = () => (
    <>
      <h2 className="step-question">Who already takes care of things here?</h2>
      <p className="step-hint">Even two or three. Landscaper, plumber, whoever plowed last winter.</p>
      <div className="provider-rows">
        {providers.map((p, i) => (
          <div key={i} className="provider-row">
            <input
              className="input"
              placeholder="Name or company"
              aria-label="Provider name"
              value={p.name}
              autoFocus={i === providers.length - 1}
              onChange={(e) => updateProvider(i, { name: e.target.value })}
            />
            <select
              className="input"
              aria-label="What they do"
              value={p.category}
              onChange={(e) => updateProvider(i, { category: e.target.value })}
            >
              <option value="">What they do…</option>
              {PROVIDER_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              className="input"
              placeholder="Phone or email (optional)"
              aria-label="Provider contact"
              value={p.contact}
              onChange={(e) => updateProvider(i, { contact: e.target.value })}
            />
            <button
              type="button"
              className="btn-link btn-link--danger"
              onClick={() => setProviders((prev) => prev.filter((_, j) => j !== i))}
              disabled={providers.length === 1}
            >
              remove
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="btn-secondary"
        onClick={() => setProviders((prev) => [...prev, emptyProvider()])}
      >
        + Add another
      </button>
    </>
  );

  const renderInspection = () => {
    const choice = answers[INSPECTION_REPORT_FIELD];
    return (
      <>
        <h2 className="step-question">Do you have a home inspection report?</h2>
        <p className="step-hint">
          If you upload it, you can probably skip about {INSPECTION_COVERS.length} questions. Things
          like the electrical panel, water heater, roof, sump pump and drainage are usually all in
          there.
        </p>
        {hasReport ? (
          <div className="report-file">
            <span className="report-file-name">📄 {answers[INSPECTION_REPORT_NAME]}</span>
            <label className="btn-link">
              {uploading ? "Uploading…" : "Replace"}
              <input type="file" accept={REPORT_ACCEPT} onChange={handleUpload} hidden disabled={uploading} />
            </label>
            <button type="button" className="btn-link btn-link--danger" onClick={handleRemoveReport}>
              remove
            </button>
          </div>
        ) : (
          <>
            <div className="bubbles" role="radiogroup" aria-label="Do you have a home inspection report?">
              {[
                { value: "Yes", label: "Yes" },
                { value: "No", label: "No / not sure" },
              ].map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={choice === o.value}
                  className={`bubble${choice === o.value ? " bubble--selected" : ""}`}
                  onClick={() => {
                    set(INSPECTION_REPORT_FIELD, o.value);
                    if (o.value === "No") next();
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {choice === "Yes" && (
              <label className={`report-drop${uploading ? " report-drop--busy" : ""}`}>
                <span className="report-drop-title">
                  {uploading ? "Uploading…" : "Choose your inspection report"}
                </span>
                <span className="report-drop-sub">PDF or photos (JPG, PNG, HEIC), up to 25 MB</span>
                <input type="file" accept={REPORT_ACCEPT} onChange={handleUpload} hidden disabled={uploading} />
              </label>
            )}
          </>
        )}
      </>
    );
  };

  const renderStep = () => {
    switch (step.kind) {
      case "inspection":
        return renderInspection();
      case "question":
        return (
          <>
            <h2 className="step-question">
              <label htmlFor={step.q.field}>{step.q.label}</label>
            </h2>
            {step.q.hint && <p className="step-hint">{step.q.hint}</p>}
            {renderInput(step.q)}
          </>
        );
      case "providers":
        return renderProviders();
      case "checkpoint":
        return (
          <>
            <h2 className="step-question">That&apos;s enough to get started.</h2>
            <p className="step-hint">
              {status.copy} There are {tierBRemaining} more questions that make it noticeably
              sharper — skip any you don&apos;t know, or stop here and come back later.
            </p>
            <div className="step-choices">
              <button type="button" className="btn" onClick={next}>
                Keep going
              </button>
              <button type="button" className="btn-secondary" onClick={() => goTo(DONE)}>
                Finish for now
              </button>
            </div>
          </>
        );
      case "done":
        return (
          <>
            <h2 className="step-question">{status.copy}</h2>
            <p className="step-hint">
              {tierAMissing > 0
                ? "Go back and fill in the basics to switch it on."
                : `You answered ${TIER_B.filter((q) => isAnswered(q, answers)).length} of ${TIER_B.length} follow-up questions${tierBReport ? `, and your inspection report covers ${tierBReport} more` : ""}. You can come back to the rest any time.`}
            </p>
            <div className="step-choices">
              <button type="button" className="btn" onClick={handleSave}>
                Save answers
              </button>
              <button type="button" className="btn-secondary" onClick={() => goTo(0)}>
                Review from the start
              </button>
            </div>
          </>
        );
    }
  };

  const inTierA = stepIndex < CHECKPOINT;
  const stage = inTierA ? "The basics" : stepIndex < DONE ? "Make it sharper" : "Done";
  // Tier B position among the questions not skipped for the inspection report.
  const tierBSteps = STEPS.map((_, i) => i).filter((i) => i > CHECKPOINT && i < DONE && !isSkipped(i));
  const stageCount = inTierA
    ? `${stepIndex + 1} of ${CHECKPOINT}`
    : step.kind === "question"
      ? `${tierBSteps.indexOf(stepIndex) + 1} of ${tierBSteps.length}`
      : "";
  const showNav = step.kind === "question" || step.kind === "providers" || step.kind === "inspection";
  const optional = (step.kind === "question" && !step.required) || step.kind === "inspection";

  return (
    <div className="container">
      <div className="main">
        <div className="section intake">
          <div className="section-header">
            <span>Home Manager intake</span>
            <div className="intake-header-right">
              {saveLabel && <span className="item-meta">{saveLabel}</span>}
              <span className={`status-pill status-pill--${status.state}`}>{status.label}</span>
            </div>
          </div>

          <div
            className="step-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={DONE}
            aria-valuenow={stepIndex}
          >
            <div className="step-progress-bar" style={{ width: `${(stepIndex / DONE) * 100}%` }} />
          </div>

          {!loaded ? (
            <div className="step-body">
              <p className="muted">Loading…</p>
            </div>
          ) : (
            <div className="step-body" key={stepIndex}>
              <div className="step-meta">
                <span>{stage}</span>
                {stageCount && <span>{stageCount}</span>}
                {optional && <span>Optional</span>}
              </div>
              {renderStep()}
            </div>
          )}

          {loaded && showNav && (
            <div className="step-nav">
              <button
                type="button"
                className="btn-link"
                onClick={back}
                disabled={stepIndex === 0}
              >
                ← Back
              </button>
              <div className="step-nav-right">
                {optional && (
                  <button type="button" className="btn-secondary" onClick={next}>
                    Skip
                  </button>
                )}
                <button type="button" className="btn" onClick={next} disabled={!canAdvance}>
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {toastElement}
    </div>
  );
};

export default Intake;

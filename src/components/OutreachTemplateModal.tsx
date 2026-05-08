"use client";

import { useState, useEffect } from "react";
import api from "@/api/client";
import "./OutreachTemplateModal.css";

type UserTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
  createdAt: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  initialSubject: string;
  initialBody: string;
  /** Called after the user clicks Copy (for activity logging etc.) */
  onCopied?: () => void;
};

export default function OutreachTemplateModal({ open, onClose, initialSubject, initialBody, onCopied }: Props) {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [templates, setTemplates] = useState<UserTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSubject(initialSubject);
    setBody(initialBody);
    setCopied(false);
    setShowSaveForm(false);
    setTemplateName("");
    setSavedFeedback(false);
    setLoadingTemplates(true);
    api.userTemplates.getAll()
      .then((res) => setTemplates((res as UserTemplate[]) ?? []))
      .catch(() => {})
      .finally(() => setLoadingTemplates(false));
  }, [open]);

  async function handleCopy() {
    const text = body;
    try { await navigator.clipboard.writeText(text); } catch { }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopied?.();
  }

  async function handleSave() {
    const name = templateName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const saved = (await api.userTemplates.create({ name, subject, body })) as UserTemplate;
      setTemplates((prev) => [saved, ...prev]);
      setSavedFeedback(true);
      setShowSaveForm(false);
      setTemplateName("");
      setTimeout(() => setSavedFeedback(false), 2000);
    } catch {}
    setSaving(false);
  }

  async function handleDeleteTemplate(id: string) {
    await api.userTemplates.delete(id).catch(() => {});
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  function loadTemplate(t: UserTemplate) {
    setSubject(t.subject);
    setBody(t.body);
  }

  if (!open) return null;

  return (
    <div className="otm-overlay" onClick={onClose}>
      <div className="otm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="otm-header">
          <span className="otm-title">Outreach Template</span>
          <button className="otm-close" onClick={onClose}>×</button>
        </div>

        {/* Saved templates */}
        {!loadingTemplates && templates.length > 0 && (
          <div className="otm-saved-row">
            <span className="otm-saved-label">Saved templates</span>
            <div className="otm-saved-list">
              {templates.map((t) => (
                <div key={t.id} className="otm-saved-chip">
                  <button className="otm-saved-chip-name" onClick={() => loadTemplate(t)}>
                    {t.name}
                  </button>
                  <button className="otm-saved-chip-delete" onClick={() => handleDeleteTemplate(t.id)} title="Delete template">×</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Subject */}
        <div className="otm-field">
          <label className="otm-field-label">Subject</label>
          <input
            className="otm-input"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject"
          />
        </div>

        {/* Body */}
        <div className="otm-field otm-field--body">
          <label className="otm-field-label">Message</label>
          <textarea
            className="otm-textarea"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>

        {/* Footer */}
        <div className="otm-footer">
          <div className="otm-footer-left">
            {showSaveForm ? (
              <div className="otm-save-form">
                <input
                  autoFocus
                  className="otm-input otm-save-name-input"
                  type="text"
                  placeholder="Template name"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setShowSaveForm(false); }}
                />
                <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !templateName.trim()}>
                  {saving ? "Saving..." : "Save"}
                </button>
                <button className="btn btn-sm" onClick={() => setShowSaveForm(false)}>Cancel</button>
              </div>
            ) : (
              <button className="btn btn-sm" onClick={() => setShowSaveForm(true)}>
                {savedFeedback ? "✓ Saved!" : "Save as template"}
              </button>
            )}
          </div>

          <div className="otm-footer-right">
            <button className="btn btn-sm" onClick={onClose}>Cancel</button>
            <button
              className={`btn btn-primary btn-sm${copied ? " otm-copied" : ""}`}
              onClick={handleCopy}
            >
              {copied ? "✓ Copied!" : "Copy"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

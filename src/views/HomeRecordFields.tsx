"use client";

import { useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import api from "../api/client";
import type { Receipt } from "../api/client";
import { RECEIPT_ACCEPT } from "../config/homeRecords";
import { getErrorMessage } from "../lib/errors";
import "./HomeRecords.css";

// ─── Shared bits for the Capital Improvements and Maintenance pages ────────

export type ShowToast = (message: string, type?: "success" | "error" | "info") => void;

export const Field = ({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: ReactNode;
}) => (
  <label className={`record-field${wide ? " record-field--wide" : ""}`}>
    <span className="record-label">{label}</span>
    {children}
  </label>
);

// The receipts on a form that hasn't been saved. Files upload as soon as they're
// picked. A saved record's files stay until the save goes through (the API then
// deletes any taken off the record); files added in this form are cleaned up here
// if they're removed or the form is cancelled.
export const useReceiptDraft = (initial: Receipt[], showToast: ShowToast) => {
  const [receipts, setReceipts] = useState(initial);
  const [uploading, setUploading] = useState(false);

  const isNew = (receipt: Receipt) => !initial.some((r) => r.path === receipt.path);

  const add = async (files: File[]) => {
    setUploading(true);
    for (const file of files) {
      try {
        const receipt = await api.home.uploadReceipt(file);
        setReceipts((prev) => [...prev, receipt]);
      } catch (err) {
        showToast(getErrorMessage(err), "error");
      }
    }
    setUploading(false);
  };

  const remove = (receipt: Receipt) => {
    setReceipts((prev) => prev.filter((r) => r.path !== receipt.path));
    if (isNew(receipt)) api.home.deleteReceipt(receipt.path).catch(() => {});
  };

  const discard = () => {
    receipts.filter(isNew).forEach((r) => api.home.deleteReceipt(r.path).catch(() => {}));
  };

  return { receipts, uploading, add, remove, discard };
};

export const ReceiptsField = ({ draft }: { draft: ReturnType<typeof useReceiptDraft> }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handlePick = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // so picking the same file again still fires
    if (files.length > 0) draft.add(files);
  };

  return (
    <div className="record-field record-field--wide">
      <span className="record-label">Receipts and documents</span>
      {draft.receipts.length > 0 && (
        <ul className="receipt-list">
          {draft.receipts.map((receipt) => (
            <li key={receipt.path} className="receipt-item">
              <a href={api.home.receiptUrl(receipt.path)} target="_blank" rel="noreferrer">
                {receipt.name}
              </a>
              <button
                type="button"
                className="btn-link btn-link--danger"
                aria-label={`Remove ${receipt.name}`}
                onClick={() => draft.remove(receipt)}
              >
                remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div>
        <input
          ref={inputRef}
          className="receipt-input"
          type="file"
          accept={RECEIPT_ACCEPT}
          multiple
          aria-label="Attach receipts"
          onChange={handlePick}
        />
        <button
          type="button"
          className="record-secondary"
          disabled={draft.uploading}
          onClick={() => inputRef.current?.click()}
        >
          {draft.uploading ? "Uploading..." : "Attach files"}
        </button>
        <span className="record-hint">PDF, JPG, PNG or HEIC, up to 25 MB each</span>
      </div>
    </div>
  );
};

// The paperclip and count shown in a table row.
export const ReceiptCount = ({ count }: { count: number }) =>
  count === 0 ? (
    <span className="muted">—</span>
  ) : (
    <span className="receipt-count" title={`${count} ${count === 1 ? "file" : "files"} attached`}>
      <svg
        width="13"
        height="13"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M13.5 7.5 8 13a3.2 3.2 0 0 1-4.5-4.5l6-6a2.1 2.1 0 0 1 3 3l-6 6a1 1 0 0 1-1.5-1.5l5.5-5.5" />
      </svg>
      {count}
      <span className="sr-only"> {count === 1 ? "file" : "files"} attached</span>
    </span>
  );

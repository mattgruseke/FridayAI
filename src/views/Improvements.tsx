"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import api from "../api/client";
import type { HomeImprovement, HomeImprovementInput } from "../api/client";
import {
  formatDate,
  formatMoney,
  IMPROVEMENT_TYPES,
  improvementTypeLabel,
  parseCost,
} from "../config/homeRecords";
import type { ImprovementType } from "../config/homeRecords";
import { useToast } from "../hooks/useToast";
import { getErrorMessage } from "../lib/errors";
import { Field, ReceiptCount, ReceiptsField, useReceiptDraft } from "./HomeRecordFields";
import type { ShowToast } from "./HomeRecordFields";

type SortKey = "completed_on" | "title" | "cost";
type Sort = { key: SortKey; descending: boolean };

const COLUMN_COUNT = 6;

// Entries without a value always sort last, whichever way the column is sorted.
const compare = (a: HomeImprovement, b: HomeImprovement, { key, descending }: Sort) => {
  const [x, y] = [a[key], b[key]];
  if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1;
  const order = typeof x === "number" ? x - (y as number) : String(x).localeCompare(String(y));
  return descending ? -order : order;
};

const ImprovementForm = ({
  improvement,
  onSaved,
  onDeleted,
  onCancel,
  showToast,
}: {
  improvement?: HomeImprovement;
  onSaved: (saved: HomeImprovement) => void;
  onDeleted?: () => void;
  onCancel: () => void;
  showToast: ShowToast;
}) => {
  const [title, setTitle] = useState(improvement?.title ?? "");
  const [type, setType] = useState<ImprovementType>(improvement?.type ?? "improvement");
  const [completedOn, setCompletedOn] = useState(improvement?.completed_on ?? "");
  const [cost, setCost] = useState(improvement?.cost?.toFixed(2) ?? "");
  const [doneBy, setDoneBy] = useState(improvement?.done_by ?? "");
  const [warrantyUntil, setWarrantyUntil] = useState(improvement?.warranty_until ?? "");
  const [notes, setNotes] = useState(improvement?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const draft = useReceiptDraft(improvement?.receipts ?? [], showToast);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsedCost = parseCost(cost);
    if (parsedCost === undefined) {
      showToast("Enter the cost as a number, like 18000 or $18,000.50", "error");
      return;
    }
    const input: HomeImprovementInput = {
      title,
      type,
      completed_on: completedOn || null,
      cost: parsedCost,
      done_by: doneBy || null,
      warranty_until: warrantyUntil || null,
      notes: notes || null,
      receipts: draft.receipts,
    };
    setSaving(true);
    try {
      onSaved(
        improvement
          ? await api.home.improvements.update(improvement.id, input)
          : await api.home.improvements.create(input)
      );
    } catch (err) {
      showToast(getErrorMessage(err), "error");
      setSaving(false);
    }
  };

  return (
    <form className="record-form" onSubmit={handleSubmit}>
      <Field label="Project" wide>
        <input
          className="input"
          type="text"
          required
          autoFocus
          maxLength={200}
          value={title}
          placeholder="New roof, finished garage, replaced fridge..."
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>
      <Field label="Type">
        <select className="input" value={type} onChange={(e) => setType(e.target.value as ImprovementType)}>
          {IMPROVEMENT_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Date completed">
        <input className="input" type="date" value={completedOn} onChange={(e) => setCompletedOn(e.target.value)} />
      </Field>
      <Field label="Cost">
        <input
          className="input"
          type="text"
          inputMode="decimal"
          value={cost}
          placeholder="$0.00"
          onChange={(e) => setCost(e.target.value)}
        />
      </Field>
      <Field label="Done by">
        <input
          className="input"
          type="text"
          maxLength={200}
          value={doneBy}
          placeholder="Contractor, store, or yourself"
          onChange={(e) => setDoneBy(e.target.value)}
        />
      </Field>
      <Field label="Warranty until">
        <input
          className="input"
          type="date"
          value={warrantyUntil}
          onChange={(e) => setWarrantyUntil(e.target.value)}
        />
      </Field>
      <Field label="Notes" wide>
        <textarea
          className="input record-textarea"
          rows={3}
          maxLength={5000}
          value={notes}
          placeholder="Model and serial numbers, permit details, what was done..."
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>
      <ReceiptsField draft={draft} />
      <div className="record-actions">
        <button className="btn" type="submit" disabled={saving || draft.uploading}>
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          className="btn-link"
          onClick={() => {
            draft.discard();
            onCancel();
          }}
        >
          cancel
        </button>
        {improvement && onDeleted && (
          <button
            type="button"
            className="btn-link btn-link--danger record-delete"
            onClick={async () => {
              if (!window.confirm(`Delete "${improvement.title}" and its attached files?`)) return;
              try {
                await api.home.improvements.delete(improvement.id);
                draft.discard();
                onDeleted();
              } catch (err) {
                showToast(getErrorMessage(err), "error");
              }
            }}
          >
            delete entry
          </button>
        )}
      </div>
    </form>
  );
};

// A log of everything put into the house, with receipts, to have on hand at sale time.
const Improvements = () => {
  const [improvements, setImprovements] = useState<HomeImprovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<Sort>({ key: "completed_on", descending: true });
  // Which form is open: "new", an entry's id, or none. Other rows wait until it's
  // saved or cancelled, so a stray click can't lose what's been typed.
  const [open, setOpen] = useState<string | null>(null);
  const { showToast, toastElement } = useToast();

  useEffect(() => {
    api.home.improvements
      .getAll()
      .then(setImprovements)
      .catch((err) => showToast(getErrorMessage(err), "error"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sorted = useMemo(
    () => [...improvements].sort((a, b) => compare(a, b, sort)),
    [improvements, sort]
  );

  const totalFor = (type?: ImprovementType) =>
    improvements
      .filter((i) => !type || i.type === type)
      .reduce((sum, i) => sum + (i.cost ?? 0), 0);

  const handleSaved = (saved: HomeImprovement) => {
    setImprovements((prev) =>
      prev.some((i) => i.id === saved.id)
        ? prev.map((i) => (i.id === saved.id ? saved : i))
        : [...prev, saved]
    );
    setOpen(null);
    showToast("Saved");
  };

  const sortHeader = (key: SortKey, label: string, className?: string) => (
    <th
      className={className}
      aria-sort={sort.key === key ? (sort.descending ? "descending" : "ascending") : undefined}
    >
      <button
        type="button"
        className="record-sort"
        onClick={() =>
          setSort((prev) =>
            prev.key === key
              ? { key, descending: !prev.descending }
              : { key, descending: key !== "title" }
          )
        }
      >
        {label}
        {sort.key === key && <span aria-hidden="true">{sort.descending ? " ↓" : " ↑"}</span>}
      </button>
    </th>
  );

  return (
    <div className="container">
      <div className="main">
        <div className="section">
          <div className="section-header">
            <span>Capital improvements</span>
            <button className="btn" type="button" disabled={open !== null} onClick={() => setOpen("new")}>
              Add entry
            </button>
          </div>

          {open === "new" && (
            <ImprovementForm
              onSaved={handleSaved}
              onCancel={() => setOpen(null)}
              showToast={showToast}
            />
          )}

          {!loading && improvements.length > 0 && (
            <>
              <div className="record-stats">
                <div className="record-stat">
                  <span className="record-label">Total logged</span>
                  <span className="record-stat-value">{formatMoney(totalFor())}</span>
                </div>
                {IMPROVEMENT_TYPES.map((t) => (
                  <div key={t.id} className="record-stat">
                    <span className="record-label">{t.label}s</span>
                    <span className="record-stat-value">{formatMoney(totalFor(t.id))}</span>
                  </div>
                ))}
              </div>
              <p className="record-disclaimer">
                A running record, not tax advice. Ask your tax preparer which entries count toward your
                home&apos;s cost basis when you sell.
              </p>
            </>
          )}

          {loading ? (
            <div className="list-item">
              <div className="item-meta">Loading...</div>
            </div>
          ) : improvements.length === 0 ? (
            open === null && (
              <div className="list-item">
                <div className="item-content">
                  <div className="item-title muted">No entries yet</div>
                  <div className="item-meta">
                    Log projects and big purchases, like a new roof, a finished garage or a replaced oven.
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="record-table-wrap">
              <table className="record-table">
                <thead>
                  <tr>
                    {sortHeader("completed_on", "Date")}
                    {sortHeader("title", "Project")}
                    <th className="record-hide-phone">Type</th>
                    {sortHeader("cost", "Cost", "record-number")}
                    <th className="record-hide-phone">Done by</th>
                    <th>Files</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((item) => (
                    <ImprovementRow
                      key={item.id}
                      item={item}
                      isOpen={open === item.id}
                      locked={open !== null}
                      onOpen={() => setOpen(item.id)}
                      onSaved={handleSaved}
                      onDeleted={() => {
                        setImprovements((prev) => prev.filter((i) => i.id !== item.id));
                        setOpen(null);
                        showToast("Entry deleted");
                      }}
                      onCancel={() => setOpen(null)}
                      showToast={showToast}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {toastElement}
    </div>
  );
};

const ImprovementRow = ({
  item,
  isOpen,
  locked,
  onOpen,
  onSaved,
  onDeleted,
  onCancel,
  showToast,
}: {
  item: HomeImprovement;
  isOpen: boolean;
  locked: boolean;
  onOpen: () => void;
  onSaved: (saved: HomeImprovement) => void;
  onDeleted: () => void;
  onCancel: () => void;
  showToast: ShowToast;
}) => {
  const details = [
    item.warranty_until && `Warranty until ${formatDate(item.warranty_until)}`,
    item.notes && "Has notes",
  ].filter(Boolean);

  return (
    <>
      <tr className={isOpen ? "record-row--open" : undefined}>
        <td className="record-nowrap">{formatDate(item.completed_on)}</td>
        <td>
          <button
            type="button"
            className="record-open"
            aria-expanded={isOpen}
            disabled={locked}
            onClick={onOpen}
          >
            {item.title}
          </button>
          {details.length > 0 && <div className="item-meta">{details.join(" · ")}</div>}
        </td>
        <td className="record-hide-phone">{improvementTypeLabel(item.type)}</td>
        <td className="record-number">{formatMoney(item.cost)}</td>
        <td className="record-hide-phone">{item.done_by ?? <span className="muted">—</span>}</td>
        <td>
          <ReceiptCount count={item.receipts.length} />
        </td>
      </tr>
      {isOpen && (
        <tr>
          <td colSpan={COLUMN_COUNT} className="record-form-cell">
            <ImprovementForm
              improvement={item}
              onSaved={onSaved}
              onDeleted={onDeleted}
              onCancel={onCancel}
              showToast={showToast}
            />
          </td>
        </tr>
      )}
    </>
  );
};

export default Improvements;

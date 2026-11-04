"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import api from "../api/client";
import type {
  MaintenanceItem,
  MaintenanceItemInput,
  MaintenanceService,
  MaintenanceServiceInput,
} from "../api/client";
import {
  addMonths,
  dueState,
  formatDate,
  formatMoney,
  frequencyLabel,
  MAINTENANCE_FREQUENCIES,
  parseCost,
  SUGGESTED_MAINTENANCE,
  today,
} from "../config/homeRecords";
import { useToast } from "../hooks/useToast";
import { getErrorMessage } from "../lib/errors";
import { Field, ReceiptCount, ReceiptsField, useReceiptDraft } from "./HomeRecordFields";
import type { ShowToast } from "./HomeRecordFields";

// Which form is open. Only one at a time, and other rows wait until it's saved or
// cancelled, so a stray click can't lose what's been typed.
type OpenForm =
  | { kind: "editItem"; id: string }
  | { kind: "logService"; itemId?: string }
  | { kind: "editService"; id: string }
  | null;

const DUE_LABELS = { overdue: "Overdue", soon: "Due soon", ok: "On track" };

const frequencyValue = (months: number | null) => (months === null ? "" : String(months));
const frequencyFromValue = (value: string) => (value === "" ? null : Number(value));

const FrequencySelect = ({
  months,
  onChange,
}: {
  months: number | null;
  onChange: (months: number | null) => void;
}) => (
  <select
    className="input"
    aria-label="How often"
    value={frequencyValue(months)}
    onChange={(e) => onChange(frequencyFromValue(e.target.value))}
  >
    {MAINTENANCE_FREQUENCIES.map((f) => (
      <option key={f.label} value={frequencyValue(f.months)}>
        {f.label}
      </option>
    ))}
  </select>
);

const ItemForm = ({
  item,
  serviceCount,
  onSaved,
  onDeleted,
  onCancel,
  showToast,
}: {
  item: MaintenanceItem;
  serviceCount: number;
  onSaved: (saved: MaintenanceItem) => void;
  onDeleted: () => void;
  onCancel: () => void;
  showToast: ShowToast;
}) => {
  const [title, setTitle] = useState(item.title);
  const [months, setMonths] = useState(item.interval_months);
  const [notes, setNotes] = useState(item.notes ?? "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input: MaintenanceItemInput = { title, interval_months: months, notes: notes || null };
    setSaving(true);
    try {
      onSaved(await api.home.maintenance.update(item.id, input));
    } catch (err) {
      showToast(getErrorMessage(err), "error");
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const warning =
      serviceCount > 0
        ? `Delete "${item.title}"? This also permanently deletes its ${serviceCount} logged ${
            serviceCount === 1 ? "service" : "services"
          } and their attached files.`
        : `Delete "${item.title}"?`;
    if (!window.confirm(warning)) return;
    try {
      await api.home.maintenance.delete(item.id);
      onDeleted();
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    }
  };

  return (
    <form className="record-form" onSubmit={handleSubmit}>
      <Field label="Item">
        <input
          className="input"
          type="text"
          required
          autoFocus
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>
      <Field label="How often">
        <FrequencySelect months={months} onChange={setMonths} />
      </Field>
      <Field label="Notes" wide>
        <textarea
          className="input record-textarea"
          rows={3}
          maxLength={5000}
          value={notes}
          placeholder="Filter size, access details, what the service covers..."
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>
      <div className="record-actions">
        <button className="btn" type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </button>
        <button type="button" className="btn-link" onClick={onCancel}>
          cancel
        </button>
        <button type="button" className="btn-link btn-link--danger record-delete" onClick={handleDelete}>
          delete item
        </button>
      </div>
    </form>
  );
};

const ServiceForm = ({
  service,
  items,
  defaultItemId,
  onSaved,
  onDeleted,
  onCancel,
  showToast,
}: {
  service?: MaintenanceService;
  items: MaintenanceItem[];
  defaultItemId?: string;
  onSaved: (saved: MaintenanceService) => void;
  onDeleted?: () => void;
  onCancel: () => void;
  showToast: ShowToast;
}) => {
  const [itemId, setItemId] = useState(service?.item_id ?? defaultItemId ?? items[0]?.id ?? "");
  const [serviceOn, setServiceOn] = useState(service?.service_on ?? today());
  const [provider, setProvider] = useState(service?.provider ?? "");
  const [cost, setCost] = useState(service?.cost?.toFixed(2) ?? "");
  const [notes, setNotes] = useState(service?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const draft = useReceiptDraft(service?.receipts ?? [], showToast);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsedCost = parseCost(cost);
    if (parsedCost === undefined) {
      showToast("Enter the cost as a number, like 250 or $1,250.00", "error");
      return;
    }
    const input: MaintenanceServiceInput = {
      item_id: itemId,
      service_on: serviceOn,
      provider: provider || null,
      cost: parsedCost,
      notes: notes || null,
      receipts: draft.receipts,
    };
    setSaving(true);
    try {
      onSaved(
        service
          ? await api.home.services.update(service.id, input)
          : await api.home.services.create(input)
      );
    } catch (err) {
      showToast(getErrorMessage(err), "error");
      setSaving(false);
    }
  };

  return (
    <form className="record-form" onSubmit={handleSubmit}>
      <Field label="Item">
        <select className="input" value={itemId} onChange={(e) => setItemId(e.target.value)}>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Date of service">
        <input
          className="input"
          type="date"
          required
          max={today()}
          value={serviceOn}
          onChange={(e) => setServiceOn(e.target.value)}
        />
      </Field>
      <Field label="Provider">
        <input
          className="input"
          type="text"
          maxLength={200}
          value={provider}
          placeholder="Company, or yourself"
          onChange={(e) => setProvider(e.target.value)}
        />
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
      <Field label="Notes" wide>
        <textarea
          className="input record-textarea"
          rows={3}
          maxLength={5000}
          value={notes}
          placeholder="What was done, anything they flagged..."
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
        {service && onDeleted && (
          <button
            type="button"
            className="btn-link btn-link--danger record-delete"
            onClick={async () => {
              if (!window.confirm("Delete this service and its attached files?")) return;
              try {
                await api.home.services.delete(service.id);
                draft.discard();
                onDeleted();
              } catch (err) {
                showToast(getErrorMessage(err), "error");
              }
            }}
          >
            delete service
          </button>
        )}
      </div>
    </form>
  );
};

// What needs doing and when, plus the record of every service: the home's upkeep history.
const Maintenance = () => {
  const [items, setItems] = useState<MaintenanceItem[]>([]);
  const [services, setServices] = useState<MaintenanceService[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<OpenForm>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newMonths, setNewMonths] = useState<number | null>(12);
  const [adding, setAdding] = useState(false);
  const [historyFilter, setHistoryFilter] = useState("");
  const { showToast, toastElement } = useToast();

  useEffect(() => {
    Promise.all([api.home.maintenance.getAll(), api.home.services.getAll()])
      .then(([loadedItems, loadedServices]) => {
        setItems(loadedItems);
        setServices(loadedServices);
      })
      .catch((err) => showToast(getErrorMessage(err), "error"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Next due counts from the last service actually done, so a late visit moves the
  // schedule. Overdue first, then soonest, then items with no history, then as-needed.
  const schedule = useMemo(() => {
    const rows = items.map((item) => {
      const lastDone = services
        .filter((s) => s.item_id === item.id)
        .reduce<string | null>((latest, s) => (!latest || s.service_on > latest ? s.service_on : latest), null);
      const nextDue = lastDone && item.interval_months ? addMonths(lastDone, item.interval_months) : null;
      return { item, lastDone, nextDue };
    });
    const rank = ({ item, nextDue }: (typeof rows)[number]) =>
      nextDue ?? (item.interval_months ? "9999-01-01" : "9999-12-31");
    return rows.sort(
      (a, b) => rank(a).localeCompare(rank(b)) || a.item.title.localeCompare(b.item.title)
    );
  }, [items, services]);

  const suggestions = SUGGESTED_MAINTENANCE.filter(
    (s) => !items.some((i) => i.title.toLowerCase() === s.title.toLowerCase())
  );

  const history = useMemo(
    () =>
      services
        .filter((s) => !historyFilter || s.item_id === historyFilter)
        .sort(
          (a, b) => b.service_on.localeCompare(a.service_on) || b.created_at.localeCompare(a.created_at)
        ),
    [services, historyFilter]
  );

  const historyTotal = history.reduce((sum, s) => sum + (s.cost ?? 0), 0);
  const itemTitle = (id: string) => items.find((i) => i.id === id)?.title ?? "—";

  const addItem = async (title: string, interval_months: number | null) => {
    setAdding(true);
    try {
      const created = await api.home.maintenance.create({ title, interval_months, notes: null });
      setItems((prev) => [...prev, created]);
      return true;
    } catch (err) {
      showToast(getErrorMessage(err), "error");
      return false;
    } finally {
      setAdding(false);
    }
  };

  const handleAddSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    if (await addItem(newTitle, newMonths)) setNewTitle("");
  };

  const handleServiceSaved = (saved: MaintenanceService) => {
    setServices((prev) =>
      prev.some((s) => s.id === saved.id)
        ? prev.map((s) => (s.id === saved.id ? saved : s))
        : [...prev, saved]
    );
    setOpen(null);
    showToast("Service saved");
  };

  const locked = open !== null;
  const close = () => setOpen(null);

  return (
    <div className="container">
      <div className="main">
        <div className="section">
          <div className="section-header">
            <span>Maintenance schedule</span>
          </div>

          <form className="inline-form record-add-form" onSubmit={handleAddSubmit}>
            <input
              className="input"
              type="text"
              maxLength={200}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Add something that needs regular upkeep..."
              aria-label="New maintenance item"
            />
            <div className="record-inline-select">
              <FrequencySelect months={newMonths} onChange={setNewMonths} />
            </div>
            <button className="btn" type="submit" disabled={adding || !newTitle.trim()}>
              Add
            </button>
          </form>

          {!loading && suggestions.length > 0 && (
            <div className="record-suggestions">
              <span className="record-label">Suggested</span>
              {suggestions.map((s) => (
                <button
                  key={s.title}
                  type="button"
                  className="record-chip"
                  disabled={adding}
                  onClick={() => addItem(s.title, s.interval_months)}
                >
                  + {s.title} <span className="muted">· {frequencyLabel(s.interval_months).toLowerCase()}</span>
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="list-item">
              <div className="item-meta">Loading...</div>
            </div>
          ) : items.length === 0 ? (
            <div className="list-item">
              <div className="item-content">
                <div className="item-title muted">Nothing on the schedule yet</div>
                <div className="item-meta">Add your own above, or pick from the suggestions.</div>
              </div>
            </div>
          ) : (
            <div className="record-table-wrap">
              <table className="record-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="record-hide-phone">How often</th>
                    <th className="record-hide-phone">Last done</th>
                    <th>Next due</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {schedule.map(({ item, lastDone, nextDue }) => {
                    const editing = open?.kind === "editItem" && open.id === item.id;
                    const logging = open?.kind === "logService" && open.itemId === item.id;
                    const due = nextDue ? dueState(nextDue) : null;
                    return (
                      <Fragment key={item.id}>
                        <tr className={editing || logging ? "record-row--open" : undefined}>
                          <td>
                            <button
                              type="button"
                              className="record-open"
                              aria-expanded={editing}
                              disabled={locked}
                              onClick={() => setOpen({ kind: "editItem", id: item.id })}
                            >
                              {item.title}
                            </button>
                            {item.notes && <div className="item-meta">Has notes</div>}
                          </td>
                          <td className="record-hide-phone record-nowrap">
                            {frequencyLabel(item.interval_months)}
                          </td>
                          <td className="record-hide-phone record-nowrap">{formatDate(lastDone)}</td>
                          <td className="record-nowrap">
                            {nextDue && due ? (
                              <>
                                {formatDate(nextDue)}{" "}
                                <span className={`record-due record-due--${due}`}>{DUE_LABELS[due]}</span>
                              </>
                            ) : (
                              <span className="muted">
                                {item.interval_months ? "No service logged" : "As needed"}
                              </span>
                            )}
                          </td>
                          <td className="record-actions-cell">
                            <button
                              type="button"
                              className="btn-link"
                              disabled={locked}
                              aria-label={`Log service for ${item.title}`}
                              onClick={() => setOpen({ kind: "logService", itemId: item.id })}
                            >
                              log service
                            </button>
                          </td>
                        </tr>
                        {editing && (
                          <tr>
                            <td colSpan={5} className="record-form-cell">
                              <ItemForm
                                item={item}
                                serviceCount={services.filter((s) => s.item_id === item.id).length}
                                onSaved={(saved) => {
                                  setItems((prev) => prev.map((i) => (i.id === saved.id ? saved : i)));
                                  close();
                                  showToast("Saved");
                                }}
                                onDeleted={() => {
                                  setItems((prev) => prev.filter((i) => i.id !== item.id));
                                  setServices((prev) => prev.filter((s) => s.item_id !== item.id));
                                  if (historyFilter === item.id) setHistoryFilter("");
                                  close();
                                  showToast("Item deleted");
                                }}
                                onCancel={close}
                                showToast={showToast}
                              />
                            </td>
                          </tr>
                        )}
                        {logging && (
                          <tr>
                            <td colSpan={5} className="record-form-cell">
                              <ServiceForm
                                items={items}
                                defaultItemId={item.id}
                                onSaved={handleServiceSaved}
                                onCancel={close}
                                showToast={showToast}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="section">
          <div className="section-header">
            <span>Service history</span>
            <button
              className="btn"
              type="button"
              disabled={locked || items.length === 0}
              onClick={() => setOpen({ kind: "logService" })}
            >
              Log service
            </button>
          </div>

          {open?.kind === "logService" && !open.itemId && (
            <ServiceForm
              items={items}
              onSaved={handleServiceSaved}
              onCancel={close}
              showToast={showToast}
            />
          )}

          {!loading && services.length > 0 && (
            <div className="record-history-bar">
              <select
                className="input"
                aria-label="Filter by item"
                value={historyFilter}
                onChange={(e) => setHistoryFilter(e.target.value)}
              >
                <option value="">All items</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
              <span className="item-meta">
                {history.length} {history.length === 1 ? "service" : "services"} ·{" "}
                {formatMoney(historyTotal)}
              </span>
            </div>
          )}

          {loading ? (
            <div className="list-item">
              <div className="item-meta">Loading...</div>
            </div>
          ) : services.length === 0 ? (
            <div className="list-item">
              <div className="item-content">
                <div className="item-title muted">No services logged yet</div>
                <div className="item-meta">
                  Each visit you log here builds your home&apos;s upkeep record and sets the next due date.
                </div>
              </div>
            </div>
          ) : (
            <div className="record-table-wrap">
              <table className="record-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Item</th>
                    <th className="record-hide-phone">Provider</th>
                    <th className="record-number">Cost</th>
                    <th>Files</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((service) => {
                    const editing = open?.kind === "editService" && open.id === service.id;
                    return (
                      <Fragment key={service.id}>
                        <tr className={editing ? "record-row--open" : undefined}>
                          <td className="record-nowrap">{formatDate(service.service_on)}</td>
                          <td>
                            <button
                              type="button"
                              className="record-open"
                              aria-expanded={editing}
                              disabled={locked}
                              onClick={() => setOpen({ kind: "editService", id: service.id })}
                            >
                              {itemTitle(service.item_id)}
                            </button>
                            {service.notes && <div className="item-meta">Has notes</div>}
                          </td>
                          <td className="record-hide-phone">
                            {service.provider ?? <span className="muted">—</span>}
                          </td>
                          <td className="record-number">{formatMoney(service.cost)}</td>
                          <td>
                            <ReceiptCount count={service.receipts.length} />
                          </td>
                        </tr>
                        {editing && (
                          <tr>
                            <td colSpan={5} className="record-form-cell">
                              <ServiceForm
                                service={service}
                                items={items}
                                onSaved={handleServiceSaved}
                                onDeleted={() => {
                                  setServices((prev) => prev.filter((s) => s.id !== service.id));
                                  close();
                                  showToast("Service deleted");
                                }}
                                onCancel={close}
                                showToast={showToast}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
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

export default Maintenance;

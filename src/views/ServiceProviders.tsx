"use client";

import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import Link from "next/link";
import api from "../api/client";
import type { Item, ServiceProvider, ServiceProviderInput } from "../api/client";
import { PROVIDER_CATEGORIES } from "../config/homeManagerIntake";
import { telHref } from "../config/homeRecords";
import { useToast } from "../hooks/useToast";
import { getErrorMessage } from "../lib/errors";
import { Field } from "./HomeRecordFields";
import type { ShowToast } from "./HomeRecordFields";

const OTHER = "Other";

// Saved under a trade that's since been renamed or removed: shown with Other.
const groupOf = (provider: ServiceProvider) =>
  PROVIDER_CATEGORIES.includes(provider.category) ? provider.category : OTHER;


const ProviderForm = ({
  provider,
  category,
  onSaved,
  onDeleted,
  onCancel,
  showToast,
}: {
  provider?: ServiceProvider;
  category?: string; // preset for a new provider
  onSaved: (saved: ServiceProvider) => void;
  onDeleted?: () => void;
  onCancel: () => void;
  showToast: ShowToast;
}) => {
  const [name, setName] = useState(provider?.name ?? "");
  const [trade, setTrade] = useState(provider?.category ?? category ?? "");
  const [company, setCompany] = useState(provider?.company ?? "");
  const [phone, setPhone] = useState(provider?.phone ?? "");
  const [email, setEmail] = useState(provider?.email ?? "");
  const [website, setWebsite] = useState(provider?.website ?? "");
  const [notes, setNotes] = useState(provider?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input: ServiceProviderInput = {
      name,
      category: trade,
      company: company || null,
      phone: phone || null,
      email: email || null,
      website: website || null,
      notes: notes || null,
    };
    setSaving(true);
    try {
      onSaved(
        provider ? await api.home.providers.update(provider.id, input) : await api.home.providers.create(input)
      );
    } catch (err) {
      showToast(getErrorMessage(err), "error");
      setSaving(false);
    }
  };

  return (
    <form className="record-form" onSubmit={handleSubmit}>
      <Field label="Name">
        <input
          className="input"
          type="text"
          required
          autoFocus
          maxLength={200}
          value={name}
          placeholder="Person or company"
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field label="What they do">
        <select className="input" required value={trade} onChange={(e) => setTrade(e.target.value)}>
          <option value="" disabled>
            Pick one
          </option>
          {/* Keeps a trade that's no longer on the list, rather than quietly changing it. */}
          {provider && !PROVIDER_CATEGORIES.includes(provider.category) && (
            <option value={provider.category}>{provider.category}</option>
          )}
          {PROVIDER_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Company">
        <input
          className="input"
          type="text"
          maxLength={200}
          value={company}
          placeholder="If it's a person at a company"
          onChange={(e) => setCompany(e.target.value)}
        />
      </Field>
      <Field label="Phone">
        <input
          className="input"
          type="tel"
          maxLength={50}
          value={phone}
          placeholder="(203) 555-0100"
          onChange={(e) => setPhone(e.target.value)}
        />
      </Field>
      <Field label="Email">
        <input
          className="input"
          type="email"
          maxLength={200}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Field label="Website">
        <input
          className="input"
          type="text"
          inputMode="url"
          maxLength={500}
          value={website}
          placeholder="smithplumbing.com"
          onChange={(e) => setWebsite(e.target.value)}
        />
      </Field>
      <Field label="Notes" wide>
        <textarea
          className="input record-textarea"
          rows={3}
          maxLength={5000}
          value={notes}
          placeholder="Account number, who referred them, how they bill, what they've done here..."
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
        {provider && onDeleted && (
          <button
            type="button"
            className="btn-link btn-link--danger record-delete"
            onClick={async () => {
              if (!window.confirm(`Delete ${provider.name}? Any tasks assigned to them stay, unassigned.`)) return;
              try {
                await api.home.providers.delete(provider.id);
                onDeleted();
              } catch (err) {
                showToast(getErrorMessage(err), "error");
              }
            }}
          >
            delete
          </button>
        )}
      </div>
    </form>
  );
};

const ProviderRow = ({
  provider,
  tasks,
  isOpen,
  locked,
  onOpen,
  form,
}: {
  provider: ServiceProvider;
  tasks: Item[]; // their open tasks
  isOpen: boolean;
  locked: boolean;
  onOpen: () => void;
  form: ReactNode;
}) => (
  <div className={`provider-row${isOpen ? " provider-row--open" : ""}`}>
    <div className="provider-summary">
      <div className="provider-who">
        <button type="button" className="record-open" aria-expanded={isOpen} disabled={locked} onClick={onOpen}>
          {provider.name}
        </button>
        {provider.company && <div className="item-meta">{provider.company}</div>}
        {provider.notes && <div className="item-meta provider-notes">{provider.notes}</div>}
      </div>
      <div className="provider-contact">
        {provider.phone && <a href={telHref(provider.phone)}>{provider.phone}</a>}
        {provider.email && <a href={`mailto:${provider.email}`}>{provider.email}</a>}
        {provider.website && (
          <a href={provider.website} target="_blank" rel="noreferrer">
            {provider.website.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "")}
          </a>
        )}
        {!provider.phone && !provider.email && !provider.website && (
          <span className="muted">No contact details yet</span>
        )}
      </div>
    </div>
    {tasks.length > 0 && (
      <div className="provider-tasks">
        <span className="record-label">Open tasks</span>
        {tasks.map((task) => (
          <Link key={task.id} href={`/tasks#task-${task.id}`} className="provider-task">
            {task.title}
          </Link>
        ))}
      </div>
    )}
    {isOpen && form}
  </div>
);

// Everyone you call for the house, by trade, so a task can be handed to the right one.
const ServiceProviders = () => {
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [tasks, setTasks] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  // Which form is open: "new", a provider's id, or none.
  const [open, setOpen] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState<string | undefined>();
  const { showToast, toastElement } = useToast();

  useEffect(() => {
    Promise.all([api.home.providers.getAll(), api.items.getAll().catch(() => [] as Item[])])
      .then(([saved, items]) => {
        setProviders(saved);
        setTasks(items);
      })
      .catch((err) => showToast(getErrorMessage(err), "error"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startNew = (category?: string) => {
    setNewCategory(category);
    setOpen("new");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSaved = (saved: ServiceProvider) => {
    setProviders((prev) =>
      prev.some((p) => p.id === saved.id) ? prev.map((p) => (p.id === saved.id ? saved : p)) : [...prev, saved]
    );
    setOpen(null);
    showToast("Saved");
  };

  const groups = PROVIDER_CATEGORIES.map((category) => ({
    category,
    rows: providers
      .filter((p) => groupOf(p) === category)
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((g) => g.rows.length > 0);

  const missing = PROVIDER_CATEGORIES.filter(
    (c) => c !== OTHER && !providers.some((p) => p.category === c)
  );

  const openTasksFor = (id: string) => tasks.filter((t) => !t.done && t.provider_id === id);

  return (
    <div className="container">
      <div className="main">
        <div className="section">
          <div className="section-header">
            <span>Service providers</span>
            <button className="btn" type="button" disabled={open !== null} onClick={() => startNew()}>
              Add provider
            </button>
          </div>

          {open === "new" && (
            <ProviderForm
              category={newCategory}
              onSaved={handleSaved}
              onCancel={() => setOpen(null)}
              showToast={showToast}
            />
          )}

          {!loading && missing.length > 0 && (
            <div className="record-suggestions">
              <span className="record-label">
                {providers.length === 0 ? "Start with who you already use:" : "Still need someone for:"}
              </span>
              {missing.map((category) => (
                <button
                  key={category}
                  type="button"
                  className="record-chip"
                  disabled={open !== null}
                  onClick={() => startNew(category)}
                >
                  + {category}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="list-item">
              <div className="item-meta">Loading...</div>
            </div>
          ) : providers.length === 0 ? (
            open === null && (
              <div className="list-item">
                <div className="item-content">
                  <div className="item-title muted">No providers yet</div>
                  <div className="item-meta">
                    Add the plumber, electrician, oil company and everyone else you call for the house. Then
                    assign them to tasks from the Tasks page.
                  </div>
                </div>
              </div>
            )
          ) : (
            groups.map((group) => (
              <div key={group.category} className="provider-group">
                <div className="provider-group-head">
                  {group.category} <span className="provider-count">{group.rows.length}</span>
                </div>
                {group.rows.map((provider) => (
                  <ProviderRow
                    key={provider.id}
                    provider={provider}
                    tasks={openTasksFor(provider.id)}
                    isOpen={open === provider.id}
                    locked={open !== null}
                    onOpen={() => setOpen(provider.id)}
                    form={
                      <ProviderForm
                        provider={provider}
                        onSaved={handleSaved}
                        onDeleted={() => {
                          setProviders((prev) => prev.filter((p) => p.id !== provider.id));
                          setTasks((prev) =>
                            prev.map((t) => (t.provider_id === provider.id ? { ...t, provider_id: null } : t))
                          );
                          setOpen(null);
                          showToast("Provider deleted");
                        }}
                        onCancel={() => setOpen(null)}
                        showToast={showToast}
                      />
                    }
                  />
                ))}
              </div>
            ))
          )}
        </div>
      </div>
      {toastElement}
    </div>
  );
};

export default ServiceProviders;

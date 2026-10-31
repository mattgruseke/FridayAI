"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import type { Restaurant, RestaurantInput } from "../api/client";
import { CUISINES, OCCASIONS, SERVICES, TOWNS, cuisineLabel } from "../config/restaurants";
import type { Cuisine, Occasion, Service } from "../config/restaurants";

// ─── Shared bits for the Restaurants pages ─────────────────────────────────

// "Steakhouse · Darien · 5 min drive · $$$$"
export const restaurantMeta = (r: Restaurant) =>
  [r.style || cuisineLabel(r.cuisine), r.location, r.distance, r.price ? "$".repeat(r.price) : null]
    .filter(Boolean)
    .join(" · ");

export const formatRating = (rating: number | null) =>
  rating == null ? "—" : Number.isInteger(rating) ? String(rating) : rating.toFixed(1);

type ChipOption<T extends string> = { id: T; label: string };

type ChipsProps<T extends string> = {
  options: readonly ChipOption<T>[];
  selected: T[];
  onToggle: (id: T) => void;
  wide?: boolean;
  label?: string;
};

// Row of toggle buttons (the filter chips and the form's multi-selects).
export const Chips = <T extends string>({ options, selected, onToggle, wide, label }: ChipsProps<T>) => (
  <div className="tag-filter" role="group" aria-label={label}>
    {options.map((o) => {
      const on = selected.includes(o.id);
      return (
        <button
          key={o.id}
          type="button"
          className={`tag-chip${wide ? " tag-chip--wide" : ""}${on ? " tag-chip--on" : ""}`}
          aria-pressed={on}
          onClick={() => onToggle(o.id)}
        >
          {o.label}
        </button>
      );
    })}
  </div>
);

export const toggleIn = <T,>(list: T[], value: T) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

// ─── Add / edit form ───────────────────────────────────────────────────────

const PRICES = [1, 2, 3, 4].map((n) => ({ id: String(n), label: "$".repeat(n) }));

type FormState = {
  name: string;
  cuisine: Cuisine;
  style: string;
  location: string;
  distance: string;
  price: string; // "" | "1".."4"
  occasions: Occasion[];
  services: Service[];
  tags: string; // comma separated
  note: string;
  usual_order: string;
  booking_label: string;
  booking_url: string;
};

const toForm = (r?: Restaurant): FormState => ({
  name: r?.name ?? "",
  cuisine: r?.cuisine ?? "other",
  style: r?.style ?? "",
  location: r?.location ?? "",
  distance: r?.distance ?? "",
  price: r?.price ? String(r.price) : "",
  occasions: r?.occasions ?? [],
  services: r?.services ?? [],
  tags: r?.tags.join(", ") ?? "",
  note: r?.note ?? "",
  usual_order: r?.usual_order ?? "",
  booking_label: r?.booking_label ?? "",
  booking_url: r?.booking_url ?? "",
});

const fromForm = (f: FormState): RestaurantInput => ({
  name: f.name.trim(),
  cuisine: f.cuisine,
  style: f.style.trim() || null,
  location: f.location.trim() || null,
  distance: f.distance.trim() || null,
  price: f.price ? Number(f.price) : null,
  occasions: f.occasions,
  services: f.services,
  tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
  note: f.note.trim() || null,
  usual_order: f.usual_order.trim() || null,
  booking_label: f.booking_label.trim() || null,
  booking_url: f.booking_url.trim() || null,
});

type RestaurantFormProps = {
  initial?: Restaurant;
  submitLabel: string;
  onSubmit: (data: RestaurantInput) => Promise<void>;
  onCancel: () => void;
};

const RestaurantForm = ({ initial, submitLabel, onSubmit, onCancel }: RestaurantFormProps) => {
  const [form, setForm] = useState<FormState>(() => toForm(initial));
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const text = (key: keyof FormState, label: string, placeholder = "", multiline = false, list?: string) => (
    <label className="rf-field">
      <span className="rf-label">{label}</span>
      {multiline ? (
        <textarea
          className="input rf-textarea"
          rows={3}
          value={form[key] as string}
          placeholder={placeholder}
          onChange={(e) => set(key, e.target.value)}
        />
      ) : (
        <input
          className="input"
          value={form[key] as string}
          placeholder={placeholder}
          list={list}
          onChange={(e) => set(key, e.target.value)}
        />
      )}
    </label>
  );

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await onSubmit(fromForm(form));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="rest-form" onSubmit={handleSubmit}>
      <div className="rf-grid">
        {text("name", "Name *", "Roots Prime")}
        {text("style", "Style", "Steakhouse, Seafood, Tapas…")}
        {text("location", "Location", "Darien", false, "rf-towns")}
        <datalist id="rf-towns">
          {TOWNS.map((t) => (
            <option key={t.id} value={t.id} />
          ))}
        </datalist>
        {text("distance", "Distance", "5 min drive")}
      </div>

      <div className="rf-field">
        <span className="rf-label">Cuisine</span>
        <Chips options={CUISINES} selected={[form.cuisine]} onToggle={(id) => set("cuisine", id)} label="Cuisine" />
      </div>

      <div className="rf-row">
        <div className="rf-field">
          <span className="rf-label">Occasion</span>
          <Chips
            wide
            options={OCCASIONS}
            selected={form.occasions}
            onToggle={(id) => set("occasions", toggleIn(form.occasions, id))}
            label="Occasion"
          />
        </div>
        <div className="rf-field">
          <span className="rf-label">Service</span>
          <Chips
            wide
            options={SERVICES}
            selected={form.services}
            onToggle={(id) => set("services", toggleIn(form.services, id))}
            label="Service"
          />
        </div>
        <div className="rf-field">
          <span className="rf-label">Price</span>
          <Chips
            wide
            options={PRICES}
            selected={[form.price]}
            onToggle={(id) => set("price", form.price === id ? "" : id)}
            label="Price"
          />
        </div>
      </div>

      {text("tags", "Tags", "Good bar, Walkable, Hard to book")}
      {text("note", "Notes", "What makes this place worth remembering?", true)}
      {text("usual_order", "What we usually order", "Ribeye, split the sundae…", true)}

      <div className="rf-grid">
        {text("booking_label", "Booking button", "Book via OpenTable")}
        {text("booking_url", "Booking link", "https://www.opentable.com/…")}
      </div>

      <div className="rf-actions">
        <button className="btn" type="submit" disabled={saving || !form.name.trim()}>
          {saving ? "Saving..." : submitLabel}
        </button>
        <button className="btn-link" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
};

export default RestaurantForm;

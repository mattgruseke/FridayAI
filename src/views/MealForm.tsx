"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Meal, MealIngredient, MealInput } from "../api/client";
import { formatMinutes, INGREDIENT_GROUPS, isOnHandGroup, MEAL_CUISINES, MEAL_METHODS } from "../config/meals";
import type { IngredientGroup, MealCuisine, MealMethod } from "../config/meals";
import { Chips, toggleIn } from "./RestaurantForm";

type IngredientRow = { rowId: number; name: string; quantity: string; group: IngredientGroup };

type FormState = {
  name: string;
  cuisine: MealCuisine;
  methods: MealMethod[];
  prep: string;
  cook: string;
  servings: string;
  ingredients: IngredientRow[];
  tags: string; // comma separated
  notes: string;
  recipe_url: string;
};

const numberOrNull = (value: string) => (value.trim() === "" ? null : Number(value));

const fromForm = (f: FormState): MealInput => ({
  name: f.name.trim(),
  cuisine: f.cuisine,
  methods: f.methods,
  prep_minutes: numberOrNull(f.prep),
  cook_minutes: numberOrNull(f.cook),
  servings: numberOrNull(f.servings),
  ingredients: f.ingredients
    .filter((i) => i.name.trim())
    .map(
      (i): MealIngredient => ({ name: i.name.trim(), quantity: i.quantity.trim() || null, group: i.group })
    ),
  tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
  notes: f.notes.trim() || null,
  recipe_url: f.recipe_url.trim() || null,
});

const MealForm = ({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Meal;
  submitLabel: string;
  onSubmit: (data: MealInput) => Promise<void>;
  onCancel: () => void;
}) => {
  const nextRowId = useRef(0);
  const newRow = (group: IngredientGroup, name = "", quantity = ""): IngredientRow => ({
    rowId: nextRowId.current++,
    name,
    quantity,
    group,
  });

  const [form, setForm] = useState<FormState>(() => ({
    name: initial?.name ?? "",
    cuisine: initial?.cuisine ?? "american",
    methods: initial?.methods ?? [],
    prep: initial?.prep_minutes != null ? String(initial.prep_minutes) : "",
    cook: initial?.cook_minutes != null ? String(initial.cook_minutes) : "",
    servings: initial?.servings != null ? String(initial.servings) : "",
    ingredients: (initial?.ingredients ?? []).map((i) => newRow(i.group, i.name, i.quantity ?? "")),
    tags: initial?.tags.join(", ") ?? "",
    notes: initial?.notes ?? "",
    recipe_url: initial?.recipe_url ?? "",
  }));
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const updateRow = (rowId: number, change: Partial<IngredientRow>) =>
    set(
      "ingredients",
      form.ingredients.map((row) => (row.rowId === rowId ? { ...row, ...change } : row))
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

  const minutesField = (key: "prep" | "cook", label: string) => {
    const minutes = Number(form[key]);
    return (
      <label className="rf-field">
        <span className="rf-label">{label}</span>
        <input
          className="input"
          type="number"
          min={0}
          max={2880}
          step={1}
          value={form[key]}
          placeholder="Minutes"
          onChange={(e) => set(key, e.target.value)}
        />
        {minutes >= 60 && <span className="item-meta">{formatMinutes(minutes)}</span>}
      </label>
    );
  };

  return (
    <form className="rest-form" onSubmit={handleSubmit}>
      <label className="rf-field">
        <span className="rf-label">Meal *</span>
        <input
          className="input"
          value={form.name}
          maxLength={120}
          placeholder="Chicken tacos"
          onChange={(e) => set("name", e.target.value)}
        />
      </label>

      <div className="rf-grid">
        {minutesField("prep", "Prep time (minutes)")}
        {minutesField("cook", "Cook time (minutes)")}
        <label className="rf-field">
          <span className="rf-label">Servings</span>
          <input
            className="input"
            type="number"
            min={1}
            max={100}
            step={1}
            value={form.servings}
            onChange={(e) => set("servings", e.target.value)}
          />
        </label>
      </div>

      <div className="rf-field">
        <span className="rf-label">How it&apos;s made</span>
        <Chips
          wide
          options={MEAL_METHODS}
          selected={form.methods}
          onToggle={(id) => set("methods", toggleIn(form.methods, id))}
          label="How it's made"
        />
      </div>

      <div className="rf-field">
        <span className="rf-label">Cuisine</span>
        <Chips options={MEAL_CUISINES} selected={[form.cuisine]} onToggle={(id) => set("cuisine", id)} label="Cuisine" />
      </div>

      <div className="rf-field">
        <span className="rf-label">Ingredients</span>
        <p className="item-meta meal-form-help">
          Pantry items and spices are assumed to be on hand, so they only go on the grocery order if you say you&apos;re
          out.
        </p>
        {INGREDIENT_GROUPS.map((group) => {
          const rows = form.ingredients.filter((row) => row.group === group.id);
          return (
            <div key={group.id} className="meal-form-group">
              <div className="meal-form-group-head">
                {group.label}
                {isOnHandGroup(group.id) && <span className="item-meta"> · on hand</span>}
              </div>
              {rows.map((row) => (
                <div key={row.rowId} className="meal-ingredient-row">
                  <input
                    className="input"
                    aria-label={`${group.label}: amount`}
                    maxLength={60}
                    value={row.quantity}
                    placeholder="Amount"
                    onChange={(e) => updateRow(row.rowId, { quantity: e.target.value })}
                  />
                  <input
                    className="input"
                    aria-label={`${group.label}: ingredient`}
                    maxLength={120}
                    value={row.name}
                    placeholder="Ingredient"
                    onChange={(e) => updateRow(row.rowId, { name: e.target.value })}
                  />
                  <button
                    type="button"
                    className="btn-link btn-link--danger"
                    aria-label={`Remove ${row.name || "ingredient"}`}
                    onClick={() =>
                      set(
                        "ingredients",
                        form.ingredients.filter((r) => r.rowId !== row.rowId)
                      )
                    }
                  >
                    remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn-link meal-add-ingredient"
                onClick={() => set("ingredients", [...form.ingredients, newRow(group.id)])}
              >
                + add to {group.label.toLowerCase()}
              </button>
            </div>
          );
        })}
      </div>

      <label className="rf-field">
        <span className="rf-label">Directions and notes</span>
        <textarea
          className="input rf-textarea"
          rows={4}
          value={form.notes}
          placeholder="How you make it, what the kid will actually eat..."
          onChange={(e) => set("notes", e.target.value)}
        />
      </label>

      <div className="rf-grid">
        <label className="rf-field">
          <span className="rf-label">Recipe link</span>
          <input
            className="input"
            value={form.recipe_url}
            placeholder="https://..."
            onChange={(e) => set("recipe_url", e.target.value)}
          />
        </label>
        <label className="rf-field">
          <span className="rf-label">Tags</span>
          <input
            className="input"
            value={form.tags}
            placeholder="Kid friendly, Freezes well"
            onChange={(e) => set("tags", e.target.value)}
          />
        </label>
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

export default MealForm;

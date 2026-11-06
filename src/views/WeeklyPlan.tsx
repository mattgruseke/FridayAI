"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import api, { DINNER_PLANS, LOCATION_KINDS, PARENT_IDS } from "../api/client";
import type {
  CalendarEvent,
  ChildcareOverride,
  ChildcarePerson,
  ChildcareSchedule,
  DinnerPlan,
  GroceryWeekDraft,
  Item,
  LocationKind,
  Meal,
  ParentId,
  PlanDay,
  PlanDayInput,
  PlannerDinner,
  PlannerLocation,
  PlannerSettings,
  PlannerSettingsInput,
  PlannerStandardDay,
  PlannerWork,
} from "../api/client";
import {
  addDays,
  formatDay,
  formatTime,
  holidaysOn,
  inkFor,
  normalizeTime,
  PERSON_COLORS,
  planFor,
  gapsIn,
  toMinutes,
  weekDates,
  weekdayOf,
  WEEKDAYS,
} from "../config/familyCalendar";
import type { DayPlan } from "../config/familyCalendar";
import { formatDate, today } from "../config/homeRecords";
import {
  childcareUnplanned,
  cleanWork,
  dayIssues,
  DEFAULT_PLANNER_SETTINGS,
  DINNER_PLAN_LABELS,
  emptyDinner,
  emptyWork,
  LOCATION_KIND_LABELS,
  rangeLabel,
  standardDayLabel,
  standardDaysFor,
  workLines,
  workProblem,
} from "../config/weeklyPlan";
import {
  buildGroceryList,
  grocerySummary,
  mealTimes,
  sortMeals,
  suggestDinners,
} from "../config/meals";
import type { DinnerSuggestion } from "../config/meals";
import { getErrorMessage } from "../lib/errors";
import GroceryPanel from "./GroceryPanel";
import { Field } from "./HomeRecordFields";
import type { ShowToast } from "./HomeRecordFields";

const shortDay = (date: string) => WEEKDAYS[weekdayOf(date)].slice(0, 3);

const blockLabel = (start: string, end: string) => rangeLabel(toMinutes(start), toMinutes(end));

// ─── Work fields, shared by day editing and standard days ──────────────────

const WorkFields = ({
  work,
  kind,
  onChange,
}: {
  work: PlannerWork;
  kind: LocationKind | undefined;
  onChange: (work: PlannerWork) => void;
}) => {
  if (!kind || kind === "off") return null;
  const timeField = (label: string, field: "leave_at" | "start" | "end" | "home_at") => (
    <Field label={label}>
      <input
        className="input"
        type="time"
        value={work[field] ?? ""}
        onChange={(e) => onChange({ ...work, [field]: e.target.value || null })}
      />
    </Field>
  );
  return (
    <div className="wp-times">
      {kind === "commute" && (
        <Field label="How you get there">
          <input
            className="input"
            type="text"
            maxLength={80}
            value={work.commute ?? ""}
            placeholder="7:22 train, drive..."
            onChange={(e) => onChange({ ...work, commute: e.target.value || null })}
          />
        </Field>
      )}
      {kind === "commute" && timeField("Leave home", "leave_at")}
      {timeField("Start work", "start")}
      {timeField("Finish work", "end")}
      {kind === "commute" && timeField("Back home", "home_at")}
    </div>
  );
};

// ─── Parents and locations ─────────────────────────────────────────────────

const SetupPanel = ({
  row,
  settings,
  onSaved,
  onCancel,
  showToast,
}: {
  row: PlannerSettings | null;
  settings: PlannerSettingsInput;
  onSaved: (saved: PlannerSettings) => void;
  onCancel: () => void;
  showToast: ShowToast;
}) => {
  const [parents, setParents] = useState(settings.parents);
  const [locations, setLocations] = useState(settings.locations);
  const [standardDays, setStandardDays] = useState(settings.standard_days);
  const [saving, setSaving] = useState(false);

  const activeLocations = locations.filter((l) => !l.archived);

  const updateStandardDay = (id: string, change: Partial<PlannerStandardDay>) =>
    setStandardDays((prev) => prev.map((s) => (s.id === id ? { ...s, ...change } : s)));

  // Each parent has one standard, so marking one unmarks the rest.
  const makeStandard = (day: PlannerStandardDay) =>
    setStandardDays((prev) =>
      prev.map((s) => (s.parent_id === day.parent_id ? { ...s, is_default: s.id === day.id } : s))
    );

  const addStandardDay = (parent: ParentId) => {
    const location = activeLocations.find((l) => l.kind === "commute") ?? activeLocations[0];
    setStandardDays((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        parent_id: parent,
        is_default: !prev.some((s) => s.parent_id === parent && s.is_default),
        work: { ...emptyWork(), location_id: location?.id ?? null },
      },
    ]);
  };

  // A parent who still has standard days keeps a marked one.
  const withStandardMarked = (days: PlannerStandardDay[]) =>
    days.map((day, index) =>
      !day.is_default &&
      !days.some((s) => s.parent_id === day.parent_id && s.is_default) &&
      days.findIndex((s) => s.parent_id === day.parent_id) === index
        ? { ...day, is_default: true }
        : day
    );

  const removeStandardDay = (id: string) =>
    setStandardDays((prev) => withStandardMarked(prev.filter((s) => s.id !== id)));

  const removeLocation = (id: string) => {
    updateLocation(id, { archived: true });
    setStandardDays((prev) => withStandardMarked(prev.filter((s) => s.work.location_id !== id)));
  };

  const updateLocation = (id: string, change: Partial<PlannerLocation>) =>
    setLocations((prev) => prev.map((l) => (l.id === id ? { ...l, ...change } : l)));

  const addLocation = () =>
    setLocations((prev) => {
      const used = prev.filter((l) => !l.archived).map((l) => l.color);
      const color = (PERSON_COLORS.find((c) => !used.includes(c.hex)) ?? PERSON_COLORS[0]).hex;
      return [...prev, { id: crypto.randomUUID(), name: "", kind: "commute", color, archived: false }];
    });

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = { parents, locations, standard_days: standardDays };
    setSaving(true);
    try {
      onSaved(row ? await api.planner.settings.update(row.id, input) : await api.planner.settings.create(input));
    } catch (err) {
      showToast(getErrorMessage(err), "error");
      setSaving(false);
    }
  };

  return (
    <form className="fc-editor" onSubmit={handleSubmit}>
      <div className="fc-subhead">Parents</div>
      <div className="wp-parent-names">
        {parents.map((parent, index) => (
          <Field key={parent.id} label={`Parent ${index + 1}`}>
            <input
              className="input"
              type="text"
              required
              maxLength={80}
              value={parent.name}
              onChange={(e) =>
                setParents((prev) => prev.map((p) => (p.id === parent.id ? { ...p, name: e.target.value } : p)))
              }
            />
          </Field>
        ))}
      </div>
      <p className="item-meta fc-help">
        Use the same name as on the Childcare tab, and the plan can flag a parent who&apos;s covering childcare while at
        the office.
      </p>

      <div className="fc-subhead">Work locations</div>
      {locations
        .filter((l) => !l.archived)
        .map((location) => (
          <div key={location.id} className="wp-location-row">
            <input
              className="input"
              type="text"
              required
              maxLength={80}
              aria-label="Location name"
              placeholder="Location name"
              value={location.name}
              onChange={(e) => updateLocation(location.id, { name: e.target.value })}
            />
            <select
              className="input"
              aria-label={`What ${location.name || "this location"} involves`}
              value={location.kind}
              onChange={(e) => updateLocation(location.id, { kind: e.target.value as LocationKind })}
            >
              {LOCATION_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {LOCATION_KIND_LABELS[kind]}
                </option>
              ))}
            </select>
            <div className="fc-swatches" role="group" aria-label={`Color for ${location.name || "this location"}`}>
              {PERSON_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  className={`fc-swatch${location.color === c.hex ? " fc-swatch--on" : ""}`}
                  style={{ background: c.hex }}
                  aria-label={`Color ${c.hex}`}
                  aria-pressed={location.color === c.hex}
                  onClick={() => updateLocation(location.id, { color: c.hex })}
                />
              ))}
            </div>
            <button
              type="button"
              className="btn-link btn-link--danger"
              aria-label={`Remove ${location.name || "this location"}`}
              onClick={() => removeLocation(location.id)}
            >
              remove
            </button>
          </div>
        ))}
      <button type="button" className="btn-link fc-add-block" onClick={addLocation}>
        + add location
      </button>
      <p className="item-meta fc-help">Removing a location keeps it on past days, but it won&apos;t be offered for new ones.</p>

      <div className="fc-subhead">Standard days</div>
      <p className="item-meta fc-help">
        Save your usual days, like one for each train you take. The one marked Standard is what Apply standard days fills
        in. Picking a location on any day fills in the times saved for it, and you can still change them.
      </p>
      {parents.map((parent) => (
        <div key={parent.id} className="wp-editor-section">
          <div className="record-label">{parent.name || "Parent"}</div>
          {standardDays
            .filter((s) => s.parent_id === parent.id)
            .map((day, index) => {
              const label = `${parent.name || "Parent"}'s standard day ${index + 1}`;
              return (
                <div key={day.id} className="wp-standard-day">
                  <div className="wp-location-row">
                    <select
                      className="input"
                      aria-label={`${label}: location`}
                      value={day.work.location_id ?? ""}
                      onChange={(e) =>
                        updateStandardDay(day.id, { work: { ...day.work, location_id: e.target.value } })
                      }
                    >
                      {activeLocations.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name || "New location"}
                        </option>
                      ))}
                    </select>
                    <label className="fc-check">
                      <input
                        type="radio"
                        name={`standard-${parent.id}`}
                        checked={day.is_default}
                        onChange={() => makeStandard(day)}
                      />
                      Standard
                    </label>
                    <button
                      type="button"
                      className="btn-link btn-link--danger"
                      aria-label={`Remove ${label}`}
                      onClick={() => removeStandardDay(day.id)}
                    >
                      remove
                    </button>
                  </div>
                  <WorkFields
                    work={day.work}
                    kind={locations.find((l) => l.id === day.work.location_id)?.kind}
                    onChange={(work) => updateStandardDay(day.id, { work })}
                  />
                </div>
              );
            })}
          <button
            type="button"
            className="btn-link fc-add-block"
            disabled={activeLocations.length === 0}
            onClick={() => addStandardDay(parent.id)}
          >
            + add a standard day for {parent.name || "this parent"}
          </button>
        </div>
      ))}

      <div className="record-actions">
        <button className="btn" type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </button>
        {row && (
          <button type="button" className="btn-link" onClick={onCancel}>
            cancel
          </button>
        )}
      </div>
    </form>
  );
};

// ─── Editing a day ─────────────────────────────────────────────────────────

const WorkEditor = ({
  name,
  work,
  locations,
  standardDays,
  onChange,
}: {
  name: string;
  work: PlannerWork;
  locations: PlannerLocation[];
  standardDays: PlannerStandardDay[];
  onChange: (work: PlannerWork) => void;
}) => {
  const kind = locations.find((l) => l.id === work.location_id)?.kind;

  // Switching location brings in that location's saved times, if there are any, since
  // the old location's times no longer apply. Nothing's kept until the day is saved.
  const pickLocation = (location: PlannerLocation) => {
    const saved = standardDays.filter((s) => s.work.location_id === location.id);
    const match = saved.find((s) => s.is_default) ?? saved[0];
    onChange(match ? { ...match.work } : { ...work, location_id: location.id });
  };

  return (
    <div className="wp-editor-section">
      <div className="fc-subhead">{name}&apos;s work</div>
      <div className="wp-options" role="group" aria-label={`${name}'s work location`}>
        {locations
          .filter((l) => !l.archived || l.id === work.location_id)
          .map((location) => {
            const on = work.location_id === location.id;
            return (
              <button
                key={location.id}
                type="button"
                className="wp-option"
                style={on ? { background: location.color, borderColor: location.color, color: inkFor(location.color), fontWeight: 600 } : undefined}
                aria-pressed={on}
                onClick={() => (on ? onChange({ ...work, location_id: null }) : pickLocation(location))}
              >
                {location.name}
              </button>
            );
          })}
      </div>
      {standardDays.length > 0 && (
        <div className="wp-options" role="group" aria-label={`Fill in ${name}'s day from a standard day`}>
          <span className="record-label wp-options-label">Standard days</span>
          {standardDays.map((day) => (
            <button key={day.id} type="button" className="record-chip" onClick={() => onChange({ ...day.work })}>
              {standardDayLabel(day, locations)}
            </button>
          ))}
        </div>
      )}
      <WorkFields work={work} kind={kind} onChange={onChange} />
    </div>
  );
};

const DinnerEditor = ({
  dinner,
  settings,
  meals,
  suggestions,
  onChange,
}: {
  dinner: PlannerDinner;
  settings: PlannerSettingsInput;
  meals: Meal[];
  suggestions: DinnerSuggestion[];
  onChange: (dinner: PlannerDinner) => void;
}) => {
  const picked = meals.find((m) => m.id === dinner.meal_id);
  const pick = (meal: Meal) => onChange({ ...dinner, plan: "cook", meal: meal.name, meal_id: meal.id });
  const showPicker = !picked && (dinner.plan === null || dinner.plan === "cook" || dinner.plan === "undecided");

  return (
  <div className="wp-editor-section">
    <div className="fc-subhead">Dinner</div>
    <div className="wp-options" role="group" aria-label="Dinner plan">
      {DINNER_PLANS.map((plan: DinnerPlan) => (
        <button
          key={plan}
          type="button"
          className={`wp-option${dinner.plan === plan ? " wp-option--on" : ""}`}
          aria-pressed={dinner.plan === plan}
          onClick={() => {
            const next = dinner.plan === plan ? null : plan;
            // Only cooking a meal brings in its groceries, so anything else unlinks it.
            onChange(
              next !== "cook" && dinner.meal_id
                ? { ...dinner, plan: next, meal: null, meal_id: null }
                : { ...dinner, plan: next }
            );
          }}
        >
          {DINNER_PLAN_LABELS[plan]}
        </button>
      ))}
    </div>

    {showPicker && suggestions.length > 0 && (
      <>
        <div className="record-label">Suggestions</div>
        <div className="wp-suggestions" role="group" aria-label="Suggested dinners">
          {suggestions.map(({ meal, reason }) => (
            <button key={meal.id} type="button" className="wp-suggestion" onClick={() => pick(meal)}>
              {meal.name}
              <span className="wp-suggestion-why">{reason}</span>
            </button>
          ))}
        </div>
      </>
    )}

    {showPicker && meals.length === 0 && (
      <p className="item-meta fc-help">
        No meals to suggest yet.{" "}
        <Link href="/food" target="_blank">
          Add some in Food
        </Link>
      </p>
    )}

    <div className="wp-times">
      {picked ? (
        <div className="wp-meal-picked">
          <span className="wp-strong">{picked.name}</span>
          {mealTimes(picked) && <span className="item-meta">{mealTimes(picked)}</span>}
          <Link href={`/food/${picked.id}`} target="_blank">
            view meal
          </Link>
          <button
            type="button"
            className="btn-link"
            onClick={() => onChange({ ...dinner, meal: null, meal_id: null })}
          >
            change
          </button>
        </div>
      ) : (
        <>
          {showPicker && meals.length > 0 && (
            <Field label="Pick from your meals">
              <select
                className="input"
                value=""
                onChange={(e) => {
                  const meal = meals.find((m) => m.id === e.target.value);
                  if (meal) pick(meal);
                }}
              >
                <option value="">Choose a meal...</option>
                {meals.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Or type what's for dinner">
            <input
              className="input"
              type="text"
              maxLength={200}
              value={dinner.meal ?? ""}
              placeholder="Thai from Rye Ridge, leftovers..."
              onChange={(e) => onChange({ ...dinner, meal: e.target.value || null })}
            />
          </Field>
        </>
      )}
      <Field label="Who's handling it">
        <select
          className="input"
          value={dinner.owner ?? ""}
          onChange={(e) => onChange({ ...dinner, owner: (e.target.value || null) as ParentId | null })}
        >
          <option value="">Nobody yet</option>
          {settings.parents.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
    </div>
    <div className="record-label">Home for dinner?</div>
    {settings.parents.map((parent) => (
      <div key={parent.id} className="wp-home-row" role="group" aria-label={`Is ${parent.name} home for dinner?`}>
        <span className="wp-home-name">{parent.name}</span>
        {[true, false].map((value) => {
          const on = dinner.home[parent.id] === value;
          return (
            <button
              key={String(value)}
              type="button"
              className={`wp-option${on ? " wp-option--on" : ""}`}
              aria-pressed={on}
              onClick={() => {
                const home = { ...dinner.home };
                if (on) delete home[parent.id];
                else home[parent.id] = value;
                onChange({ ...dinner, home });
              }}
            >
              {value ? "Home" : "Not home"}
            </button>
          );
        })}
      </div>
    ))}
  </div>
  );
};

const SUGGESTIONS_SHOWN = 4;

const DayEditor = ({
  date,
  row,
  settings,
  care,
  nameOf,
  meals,
  days,
  onSaved,
  onCleared,
  onCancel,
  onEditChildcare,
  showToast,
}: {
  date: string;
  row: PlanDay | undefined;
  settings: PlannerSettingsInput;
  care: DayPlan;
  nameOf: (personId: string) => string;
  meals: Meal[];
  days: PlanDay[];
  onSaved: (saved: PlanDay, goToNextDay: boolean) => void;
  onCleared: () => void;
  onCancel: () => void;
  onEditChildcare: (date: string) => void;
  showToast: ShowToast;
}) => {
  const [work, setWork] = useState<Record<ParentId, PlannerWork>>(() => ({
    parent_1: { ...emptyWork(), ...row?.work.parent_1 },
    parent_2: { ...emptyWork(), ...row?.work.parent_2 },
  }));
  const [dinner, setDinner] = useState<PlannerDinner>(() => ({ ...emptyDinner(), ...row?.dinner }));
  const [note, setNote] = useState(row?.note ?? "");
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    ref.current?.scrollIntoView({ block: "nearest" });
  }, []);

  const buildInput = (): PlanDayInput => ({
    plan_on: date,
    work: {
      parent_1: cleanWork(work.parent_1, settings.locations),
      parent_2: cleanWork(work.parent_2, settings.locations),
    },
    dinner,
    note: note || null,
  });

  const savedSnapshot = useRef(JSON.stringify(buildInput()));
  const isDirty = () => JSON.stringify(buildInput()) !== savedSnapshot.current;

  const save = async (goToNextDay: boolean) => {
    const input = buildInput();
    for (const parent of settings.parents) {
      const problem = workProblem(input.work[parent.id] as PlannerWork);
      if (problem) {
        showToast(`${parent.name}: ${problem}`, "error");
        return;
      }
    }
    setSaving(true);
    try {
      onSaved(row ? await api.planner.days.update(row.id, input) : await api.planner.days.create(input), goToNextDay);
    } catch (err) {
      showToast(getErrorMessage(err), "error");
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!row || !window.confirm(`Clear everything planned for ${formatDay(date)}?`)) return;
    try {
      await api.planner.days.delete(row.id);
      onCleared();
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    }
  };

  const gaps = gapsIn(care);

  return (
    <form
      ref={ref}
      className="fc-editor"
      onSubmit={(e) => {
        e.preventDefault();
        save(false);
      }}
    >
      <div className="fc-title wp-editor-title">{formatDay(date)}</div>

      {settings.parents.map((parent) => (
        <WorkEditor
          key={parent.id}
          name={parent.name}
          work={work[parent.id]}
          locations={settings.locations}
          standardDays={standardDaysFor(parent.id, settings)}
          onChange={(next) => setWork((prev) => ({ ...prev, [parent.id]: next }))}
        />
      ))}

      <div className="wp-editor-section">
        <div className="wp-editor-head">
          <div className="fc-subhead">Childcare</div>
          <button
            type="button"
            className="btn-link"
            onClick={() => {
              if (!isDirty() || window.confirm("Leave without saving your changes to this day?")) {
                onEditChildcare(date);
              }
            }}
          >
            change in Childcare
          </button>
        </div>
        <div className="item-meta">
          {care.blocks.map((b) => `${nameOf(b.person_id)} ${blockLabel(b.start, b.end)}`).join(" · ") ||
            "Nobody scheduled"}
          {gaps.length > 0 && (
            <span className="fc-gap-text">
              {" "}
              · {gaps.map((g) => `Gap ${rangeLabel(g.start, g.end)}`).join(", ")}
            </span>
          )}
        </div>
      </div>

      <DinnerEditor
        dinner={dinner}
        settings={settings}
        meals={meals}
        suggestions={suggestDinners({
          date,
          day: { work, dinner },
          settings,
          meals,
          days,
          excludeIds: weekDates(date).flatMap((d) => {
            const id = days.find((row) => row.plan_on === d)?.dinner?.meal_id;
            return id && d !== date ? [id] : [];
          }),
        }).slice(0, SUGGESTIONS_SHOWN)}
        onChange={setDinner}
      />

      <Field label="Notes for this day">
        <input
          className="input"
          type="text"
          maxLength={2000}
          value={note}
          placeholder="Anything else to sort out..."
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>

      <div className="record-actions">
        <button className="btn" type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </button>
        {weekdayOf(date) !== 0 && (
          <button type="button" className="record-secondary" disabled={saving} onClick={() => save(true)}>
            Save, next day
          </button>
        )}
        <button type="button" className="btn-link" onClick={onCancel}>
          cancel
        </button>
        {row && (
          <button type="button" className="btn-link btn-link--danger record-delete" onClick={handleClear}>
            clear this day
          </button>
        )}
      </div>
    </form>
  );
};

// ─── Showing the week ──────────────────────────────────────────────────────

const NotPlanned = ({ past }: { past: boolean }) =>
  past ? <span className="wp-empty">—</span> : <span className="wp-missing">Not planned</span>;

const WorkCell = ({ work, location, past }: { work?: PlannerWork; location?: PlannerLocation; past: boolean }) => {
  if (!work || !location) return <NotPlanned past={past} />;
  return (
    <>
      <span className="wp-location" style={{ background: location.color, color: inkFor(location.color) }}>
        {location.name}
      </span>
      {workLines(work).map((line) => (
        <span key={line}>{line}</span>
      ))}
    </>
  );
};

const DinnerCell = ({
  dinner,
  settings,
  past,
  suggestion,
}: {
  dinner?: PlannerDinner;
  settings: PlannerSettingsInput;
  past: boolean;
  suggestion?: Meal;
}) => {
  if (!dinner?.plan) {
    return (
      <>
        <NotPlanned past={past} />
        {suggestion && <span className="wp-try">Try: {suggestion.name}</span>}
      </>
    );
  }
  const owner = settings.parents.find((p) => p.id === dinner.owner)?.name;
  const homeNames = (value: boolean) =>
    settings.parents.filter((p) => dinner.home[p.id] === value).map((p) => p.name).join(", ");
  return (
    <>
      <span className={dinner.plan === "undecided" ? "wp-missing" : "wp-strong"}>{DINNER_PLAN_LABELS[dinner.plan]}</span>
      {dinner.meal && <span>{dinner.meal}</span>}
      {owner && <span>{owner} handling</span>}
      {homeNames(true) && <span>Home: {homeNames(true)}</span>}
      {homeNames(false) && <span>Not home: {homeNames(false)}</span>}
    </>
  );
};

const CareCell = ({
  plan,
  unplanned,
  past,
  nameOf,
  colorOf,
}: {
  plan: DayPlan;
  unplanned: boolean;
  past: boolean;
  nameOf: (id: string) => string;
  colorOf: (id: string) => string;
}) => {
  const gaps = gapsIn(plan);
  if (plan.blocks.length === 0 && gaps.length === 0) {
    return unplanned ? <NotPlanned past={past} /> : <span className="wp-empty">Not needed</span>;
  }
  return (
    <>
      {plan.blocks.map((block) => (
        <span key={`${block.person_id}-${block.start}`} className="wp-care-row">
          <span className="fc-swatch fc-swatch--small" style={{ background: colorOf(block.person_id) }} aria-hidden="true" />
          <span>
            <span className="wp-strong">{nameOf(block.person_id)}</span> {blockLabel(block.start, block.end)}
          </span>
        </span>
      ))}
      {gaps.map((gap) => (
        <span key={gap.start} className={past ? "wp-empty" : "wp-missing"}>
          Gap {rangeLabel(gap.start, gap.end)}
        </span>
      ))}
      {plan.override?.note && <span className="wp-note">{plan.override.note}</span>}
    </>
  );
};

type Panel = "setup" | { date: string } | null;

const WeeklyPlan = ({
  showToast,
  onEditChildcare,
  initialWeek,
}: {
  showToast: ShowToast;
  onEditChildcare: (date: string) => void;
  initialWeek?: string;
}) => {
  const now = today();
  const [anchor, setAnchor] = useState(initialWeek ?? now);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [groceryWeeks, setGroceryWeeks] = useState<GroceryWeekDraft[]>([]);
  const [groceriesOpen, setGroceriesOpen] = useState(false);
  const [settingsRow, setSettingsRow] = useState<PlannerSettings | null>(null);
  const [days, setDays] = useState<PlanDay[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Item[]>([]);
  const [people, setPeople] = useState<ChildcarePerson[]>([]);
  const [schedules, setSchedules] = useState<ChildcareSchedule[]>([]);
  const [overrides, setOverrides] = useState<ChildcareOverride[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [panel, setPanel] = useState<Panel>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    Promise.all([
      api.planner.settings.getAll(),
      api.planner.days.getAll(),
      api.calendar.events.getAll(),
      api.items.getAll(),
      api.calendar.people.getAll(),
      api.calendar.schedules.getAll(),
      api.calendar.overrides.getAll(),
      api.meals.getAll(),
      api.groceries.getAll(),
    ])
      .then(([loadedSettings, loadedDays, loadedEvents, items, loadedPeople, loadedSchedules, loadedOverrides, loadedMeals, loadedWeeks]) => {
        setMeals(sortMeals(loadedMeals));
        setGroceryWeeks(loadedWeeks);
        setSettingsRow(loadedSettings[0] ?? null);
        setDays(loadedDays);
        setEvents(loadedEvents);
        setTasks(items);
        setPeople(loadedPeople);
        setSchedules(loadedSchedules);
        setOverrides(loadedOverrides);
        setStatus("ready");
        if (loadedSettings.length === 0) setPanel("setup");
      })
      .catch((err) => {
        // Nothing's shown or editable if this fails, so a partial load can't be saved over real data.
        setStatus("failed");
        showToast(getErrorMessage(err), "error");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const settings: PlannerSettingsInput = settingsRow
    ? { ...settingsRow, standard_days: settingsRow.standard_days ?? [] }
    : DEFAULT_PLANNER_SETTINGS;
  const dates = useMemo(() => weekDates(anchor), [anchor]);

  const dayByDate = useMemo(() => new Map(days.map((d) => [d.plan_on, d])), [days]);
  const personById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const nameOf = (id: string) => personById.get(id)?.name ?? "Unknown";
  const colorOf = (id: string) => personById.get(id)?.color ?? "#64748B";
  const locationOf = (id: string | null | undefined) => settings.locations.find((l) => l.id === id);

  const careOf = (date: string) => planFor(date, schedules, overrides);

  // Days that have already passed aren't worth nagging about.
  const issues = dates
    .filter((date) => date >= now)
    .map((date) => ({
      date,
      list: dayIssues({ date, day: dayByDate.get(date), settings, care: careOf(date), schedules, people }),
    }))
    .filter((entry) => entry.list.length > 0);
  const hasUpcomingDays = dates[dates.length - 1] >= now;

  const weekOf = dates[0];
  const groceryWeek = groceryWeeks.find((w) => w.week_of === weekOf);
  const groceries = buildGroceryList({ dates, days, meals, week: groceryWeek, now });
  const groceryIssue =
    groceries.status === "to_order"
      ? `Order groceries: ${grocerySummary(groceries)}`
      : groceries.status === "changed"
        ? `${groceries.addedSinceOrder.length} new since you ordered`
        : null;

  // One idea for each open dinner, without repeating a meal across the week.
  const tryByDate = useMemo(() => {
    const result = new Map<string, Meal>();
    const used = dates.flatMap((d) => {
      const id = dayByDate.get(d)?.dinner?.meal_id;
      return id ? [id] : [];
    });
    for (const date of dates) {
      const day = dayByDate.get(date);
      if (date < now || day?.dinner?.plan) continue;
      const [best] = suggestDinners({ date, day, settings, meals, days, excludeIds: used });
      if (best) {
        result.set(date, best.meal);
        used.push(best.meal.id);
      }
    }
    return result;
    // settings is rebuilt each render, and settingsRow is what it comes from.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dates, dayByDate, days, meals, now, settingsRow]);

  const openDate = typeof panel === "object" && panel !== null ? panel.date : null;

  const handleDaySaved = (saved: PlanDay, goToNextDay: boolean) => {
    setDays((prev) =>
      prev.some((d) => d.id === saved.id) ? prev.map((d) => (d.id === saved.id ? saved : d)) : [...prev, saved]
    );
    setPanel(goToNextDay ? { date: addDays(saved.plan_on, 1) } : null);
    showToast("Day saved");
  };

  // Fills in this week's blank weekdays from each parent's standard day. It reloads
  // first and skips anything already filled in, so it can't write over a plan.
  const applyStandardDays = async () => {
    const standards = PARENT_IDS.flatMap((id) => standardDaysFor(id, settings).filter((s) => s.is_default));
    if (standards.length === 0) {
      showToast("Set up a standard day first", "error");
      setPanel("setup");
      return;
    }
    setApplying(true);
    try {
      const latest = await api.planner.days.getAll();
      setDays(latest);
      let filled = 0;
      for (const date of dates.slice(0, 5).filter((d) => d >= now)) {
        const row = latest.find((d) => d.plan_on === date);
        const work = { ...row?.work };
        const blanks = standards.filter((s) => !work[s.parent_id]?.location_id);
        if (blanks.length === 0) continue;
        for (const standard of blanks) work[standard.parent_id] = { ...standard.work };
        const input: PlanDayInput = {
          plan_on: date,
          work,
          dinner: { ...emptyDinner(), ...row?.dinner },
          note: row?.note ?? null,
        };
        const saved = row ? await api.planner.days.update(row.id, input) : await api.planner.days.create(input);
        setDays((prev) =>
          prev.some((d) => d.id === saved.id) ? prev.map((d) => (d.id === saved.id ? saved : d)) : [...prev, saved]
        );
        filled += 1;
      }
      showToast(filled > 0 ? `Filled in ${filled} ${filled === 1 ? "day" : "days"}` : "No blank weekdays to fill");
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setApplying(false);
    }
  };

  return (
    <>
      <div className="fc-toolbar">
        <div className="fc-nav">
          <button
            type="button"
            className="record-secondary fc-arrow"
            aria-label="Previous week"
            onClick={() => setAnchor((a) => addDays(a, -7))}
          >
            ‹
          </button>
          <button
            type="button"
            className="record-secondary fc-arrow"
            aria-label="Next week"
            onClick={() => setAnchor((a) => addDays(a, 7))}
          >
            ›
          </button>
          <button type="button" className="record-secondary" onClick={() => setAnchor(now)}>
            This week
          </button>
          <span className="fc-title">
            {formatDate(dates[0])} – {formatDate(dates[6])}
          </span>
        </div>
        <div className="fc-nav">
          <button
            type="button"
            className="record-secondary"
            disabled={status !== "ready" || applying || panel !== null || dates[4] < now}
            onClick={applyStandardDays}
          >
            {applying ? "Applying..." : "Apply standard days"}
          </button>
          <button
            type="button"
            className="record-secondary"
            disabled={status !== "ready" || applying}
            onClick={() => setPanel("setup")}
          >
            Parents &amp; locations
          </button>
        </div>
      </div>

      {status === "loading" && (
        <div className="list-item">
          <div className="item-meta">Loading...</div>
        </div>
      )}

      {status === "failed" && (
        <div className="list-item">
          <div className="item-content">
            <div className="item-title muted">Couldn&apos;t load the weekly plan</div>
            <div className="item-meta">Refresh the page to try again.</div>
          </div>
        </div>
      )}

      {status === "ready" && (
        <>
          {panel === "setup" && (
            <SetupPanel
              row={settingsRow}
              settings={settings}
              onSaved={(saved) => {
                setSettingsRow(saved);
                setPanel(null);
                showToast("Saved");
              }}
              onCancel={() => setPanel(null)}
              showToast={showToast}
            />
          )}

          {openDate && (
            <DayEditor
              key={openDate}
              date={openDate}
              row={dayByDate.get(openDate)}
              settings={settings}
              care={careOf(openDate)}
              nameOf={nameOf}
              meals={meals}
              days={days}
              onSaved={handleDaySaved}
              onCleared={() => {
                setDays((prev) => prev.filter((d) => d.plan_on !== openDate));
                setPanel(null);
                showToast("Day cleared");
              }}
              onCancel={() => setPanel(null)}
              onEditChildcare={onEditChildcare}
              showToast={showToast}
            />
          )}

          {hasUpcomingDays &&
            (issues.length > 0 || groceryIssue ? (
              <div className="wp-issues">
                <div className="fc-subhead">Still to sort out</div>
                <ul className="wp-issue-list">
                  {issues.map(({ date, list }) => (
                    <li key={date} className="wp-issue-row">
                      <button
                        type="button"
                        className="wp-issue-day"
                        aria-label={`Plan ${formatDay(date)}`}
                        onClick={() => setPanel({ date })}
                      >
                        {shortDay(date)} {Number(date.slice(8))}
                      </button>
                      <span className="wp-issue-text">{list.join(" · ")}</span>
                    </li>
                  ))}
                  {groceryIssue && (
                    <li className="wp-issue-row">
                      <button
                        type="button"
                        className="wp-issue-day"
                        aria-label="Open this week's groceries"
                        onClick={() => setGroceriesOpen(true)}
                      >
                        Shop
                      </button>
                      <span className="wp-issue-text">{groceryIssue}</span>
                    </li>
                  )}
                </ul>
              </div>
            ) : (
              <div className="wp-issues wp-issues--clear">Nothing flagged. This week is planned.</div>
            ))}

          {hasUpcomingDays && (
            <div className="wp-groceries">
              <div className="wp-groceries-head">
                <span className="fc-subhead">Groceries</span>
                {groceries.status === "empty" && <span className="item-meta">No meals picked yet</span>}
                {groceries.status === "to_order" && (
                  <span className="item-meta">
                    {grocerySummary(groceries)} · <span className="wp-grocery-state--due">Not ordered</span>
                  </span>
                )}
                {groceries.status === "ordered" && (
                  <span className="item-meta">
                    {grocerySummary(groceries)} · <span className="wp-grocery-state--ok">Ordered</span>
                  </span>
                )}
                {groceries.status === "changed" && (
                  <span className="item-meta">
                    <span className="wp-grocery-state--due">{groceries.addedSinceOrder.length} new since you ordered</span>
                  </span>
                )}
                <button type="button" className="btn-link" aria-expanded={groceriesOpen} onClick={() => setGroceriesOpen((o) => !o)}>
                  {groceriesOpen ? "hide list" : "review list"}
                </button>
              </div>
              {groceriesOpen && (
                <GroceryPanel
                  key={weekOf}
                  weekOf={weekOf}
                  week={groceryWeek}
                  list={groceries}
                  onChange={(next) =>
                    setGroceryWeeks((prev) =>
                      prev.some((w) => w.week_of === next.week_of)
                        ? prev.map((w) => (w.week_of === next.week_of ? next : w))
                        : [...prev, next]
                    )
                  }
                  showToast={showToast}
                />
              )}
            </div>
          )}

          <div className="wp-grid">
            <div className="wp-col wp-labels">
              <div className="wp-label" />
              {settings.parents.map((p) => (
                <div key={p.id} className="wp-label">
                  {p.name}
                </div>
              ))}
              <div className="wp-label">Childcare</div>
              <div className="wp-label">Dinner</div>
              <div className="wp-label">On the calendar</div>
            </div>
            {dates.map((date) => {
              const past = date < now;
              const day = dayByDate.get(date);
              const care = careOf(date);
              const dayEvents = events
                .filter((e) => e.event_on === date)
                .sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));
              const dayTasks = tasks.filter((t) => t.scheduled_on === date && !t.done);
              const cellProps = {
                type: "button" as const,
                className: "wp-cell",
                onClick: () => setPanel({ date }),
              };
              return (
                <div key={date} className="wp-col">
                  <div className={`wp-head${date === now ? " wp-head--today" : ""}`}>
                    <span>{shortDay(date)}</span>
                    <span className="wp-head-date">{Number(date.slice(8))}</span>
                  </div>
                  {PARENT_IDS.map((id) => {
                    const name = settings.parents.find((p) => p.id === id)?.name;
                    return (
                      <button key={id} {...cellProps} aria-label={`Plan ${name}'s work on ${formatDay(date)}`}>
                        <span className="wp-cell-label">{name}</span>
                        <WorkCell work={day?.work[id]} location={locationOf(day?.work[id]?.location_id)} past={past} />
                      </button>
                    );
                  })}
                  <button {...cellProps} aria-label={`Childcare on ${formatDay(date)}`}>
                    <span className="wp-cell-label">Childcare</span>
                    <CareCell
                      plan={care}
                      unplanned={childcareUnplanned(date, care, schedules)}
                      past={past}
                      nameOf={nameOf}
                      colorOf={colorOf}
                    />
                  </button>
                  <button {...cellProps} aria-label={`Plan dinner on ${formatDay(date)}`}>
                    <span className="wp-cell-label">Dinner</span>
                    <DinnerCell dinner={day?.dinner} settings={settings} past={past} suggestion={tryByDate.get(date)} />
                  </button>
                  <div className="wp-cell wp-cell--calendar">
                    <span className="wp-cell-label">On the calendar</span>
                    {holidaysOn(date).map((title) => (
                      <span key={title} className="wp-empty">
                        {title}
                      </span>
                    ))}
                    {dayEvents.map((event) => (
                      <span key={event.id}>
                        <span className="wp-strong">{event.title}</span>
                        {event.start_time && ` ${formatTime(normalizeTime(event.start_time))}`}
                      </span>
                    ))}
                    {dayTasks.map((task) => (
                      <span key={task.id}>
                        Task: {task.title}
                        {task.scheduled_time && ` ${formatTime(normalizeTime(task.scheduled_time))}`}
                      </span>
                    ))}
                    {day?.note && <span className="wp-note">{day.note}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
};

export default WeeklyPlan;

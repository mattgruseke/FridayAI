"use client";

import { useState } from "react";
import Link from "next/link";
import api from "../api/client";
import type { CalendarEvent, Meal, PlanDay, PlanDayInput } from "../api/client";
import { addDays, formatDay, startOfWeek, weekdayOf, WEEKDAYS } from "../config/familyCalendar";
import { today } from "../config/homeRecords";
import { DINNER_PLAN_LABELS, emptyDinner } from "../config/weeklyPlan";
import { getErrorMessage } from "../lib/errors";
import "./HomeRecords.css";

const DAYS_SHOWN = 14;

// Puts a meal on the weekly plan: pick a day, and that day's dinner becomes this meal.
const PlanMealPicker = ({
  meal,
  days,
  onPlanned,
  showToast,
}: {
  meal: Meal;
  days: PlanDay[];
  onPlanned: (saved: PlanDay) => void;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}) => {
  const now = today();
  const [saving, setSaving] = useState(false);
  const [planned, setPlanned] = useState<string | null>(null);
  const dates = Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(now, i));

  const dinnerLabel = (day: PlanDay | undefined) =>
    day?.dinner?.plan ? day.dinner.meal || DINNER_PLAN_LABELS[day.dinner.plan] : null;

  const plan = async (date: string) => {
    setSaving(true);
    try {
      // Reloaded so a dinner planned since this page opened still gets a warning.
      const latest = await api.planner.days.getAll();
      const row = latest.find((d) => d.plan_on === date);
      const current = dinnerLabel(row);
      if (
        current &&
        row?.dinner.meal_id !== meal.id &&
        !window.confirm(`${formatDay(date)} already has ${current} for dinner. Replace it with ${meal.name}?`)
      ) {
        return;
      }
      const input = {
        plan_on: date,
        work: row?.work ?? {},
        dinner: { ...emptyDinner(), ...row?.dinner, plan: "cook" as const, meal: meal.name, meal_id: meal.id },
        dishes: row?.dishes ?? [],
        note: row?.note ?? null,
      };
      const saved = row ? await api.planner.days.update(row.id, input) : await api.planner.days.create(input);
      onPlanned(saved);
      setPlanned(date);
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="meal-picker" role="group" aria-label={`Pick a day for ${meal.name}`}>
      <div className="meal-picker-days">
        {dates.map((date) => {
          const day = days.find((d) => d.plan_on === date);
          const isThis = day?.dinner?.meal_id === meal.id;
          const taken = dinnerLabel(day);
          return (
            <button
              key={date}
              type="button"
              disabled={saving}
              className={`meal-day${isThis ? " meal-day--this" : taken ? " meal-day--taken" : ""}`}
              aria-label={`${formatDay(date)}${taken ? `, currently ${taken}` : ", open"}`}
              title={taken ?? "Open"}
              onClick={() => plan(date)}
            >
              <span className="meal-day-name">{WEEKDAYS[weekdayOf(date)].slice(0, 3)}</span>
              <span className="meal-day-date">{Number(date.slice(8))}</span>
              <span className="meal-day-state">{isThis ? "This" : taken ? "Taken" : "Open"}</span>
            </button>
          );
        })}
      </div>
      {planned && (
        <div className="meal-picker-done">
          On the plan for {formatDay(planned)}.{" "}
          <Link href={`/calendar?view=plan&week=${startOfWeek(planned)}`}>See the weekly plan</Link>
        </div>
      )}
    </div>
  );
};

const UPCOMING_EVENTS = 6;
const EVENT_DAYS_AHEAD = 90;

// Puts a side or dessert on a day, usually for an event. It joins that week's groceries
// and leaves the day's dinner alone. Picking a day it's already on takes it back off.
export const PlanDishPicker = ({
  meal,
  days,
  events,
  onPlanned,
  showToast,
}: {
  meal: Meal;
  days: PlanDay[];
  events: CalendarEvent[];
  onPlanned: (saved: PlanDay) => void;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}) => {
  const now = today();
  const [occasion, setOccasion] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; date: string } | null>(null);
  const dates = Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(now, i));
  const eventsOn = (date: string) => events.filter((e) => e.event_on === date);
  const upcoming = events
    .filter((e) => e.event_on >= now && e.event_on <= addDays(now, EVENT_DAYS_AHEAD))
    .sort((a, b) => a.event_on.localeCompare(b.event_on))
    .slice(0, UPCOMING_EVENTS);

  const toggle = async (date: string, forEvent?: string) => {
    setSaving(true);
    try {
      // Reloaded so this can't write over a plan changed since the page opened.
      const row = (await api.planner.days.getAll()).find((d) => d.plan_on === date);
      const existing = row?.dishes?.find((d) => d.meal_id === meal.id);
      const label = forEvent ?? (occasion.trim() || eventsOn(date)[0]?.title || null);
      const dishes = existing
        ? (row?.dishes ?? []).filter((d) => d.id !== existing.id)
        : [...(row?.dishes ?? []), { id: crypto.randomUUID(), meal_id: meal.id, name: meal.name, occasion: label }];
      const input: PlanDayInput = {
        plan_on: date,
        work: row?.work ?? {},
        dinner: { ...emptyDinner(), ...row?.dinner },
        dishes,
        note: row?.note ?? null,
      };
      const saved = row ? await api.planner.days.update(row.id, input) : await api.planner.days.create(input);
      onPlanned(saved);
      setOccasion("");
      setMessage({
        text: existing
          ? `Taken off ${formatDay(date)}.`
          : `Added for ${formatDay(date)}${label ? `: ${label}` : ""}. Its groceries are on that week's list.`,
        date,
      });
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const onDate = (date: string) => days.find((d) => d.plan_on === date)?.dishes?.some((d) => d.meal_id === meal.id);

  return (
    <div className="meal-picker" role="group" aria-label={`Pick a day for ${meal.name}`}>
      {upcoming.length > 0 && (
        <div className="meal-picker-events" role="group" aria-label="Upcoming events">
          {upcoming.map((event) => (
            <button
              key={event.id}
              type="button"
              disabled={saving}
              className={`record-chip${onDate(event.event_on) ? " meal-event--on" : ""}`}
              onClick={() => toggle(event.event_on, event.title)}
            >
              {WEEKDAYS[weekdayOf(event.event_on)].slice(0, 3)} {Number(event.event_on.slice(8))}: {event.title}
            </button>
          ))}
        </div>
      )}
      <input
        className="input meal-picker-occasion"
        aria-label="What it's for"
        maxLength={200}
        value={occasion}
        placeholder="What's it for? Friend's barbecue..."
        onChange={(e) => setOccasion(e.target.value)}
      />
      <div className="meal-picker-days">
        {dates.map((date) => {
          const isOn = onDate(date);
          const hasEvent = eventsOn(date).length > 0;
          return (
            <button
              key={date}
              type="button"
              disabled={saving}
              className={`meal-day${isOn ? " meal-day--this" : ""}`}
              aria-pressed={Boolean(isOn)}
              aria-label={`${formatDay(date)}${hasEvent ? `, ${eventsOn(date)[0].title}` : ""}`}
              title={eventsOn(date).map((e) => e.title).join(", ") || "Nothing on the calendar"}
              onClick={() => toggle(date)}
            >
              <span className="meal-day-name">{WEEKDAYS[weekdayOf(date)].slice(0, 3)}</span>
              <span className="meal-day-date">{Number(date.slice(8))}</span>
              <span className="meal-day-state">{isOn ? "Added" : hasEvent ? "Event" : "Open"}</span>
            </button>
          );
        })}
      </div>
      {message && (
        <div className="meal-picker-done">
          {message.text} <Link href={`/calendar?view=plan&week=${startOfWeek(message.date)}`}>See the weekly plan</Link>
        </div>
      )}
    </div>
  );
};

export default PlanMealPicker;

"use client";

import { useState } from "react";
import Link from "next/link";
import api from "../api/client";
import type { Meal, PlanDay } from "../api/client";
import { addDays, formatDay, startOfWeek, weekdayOf, WEEKDAYS } from "../config/familyCalendar";
import { today } from "../config/homeRecords";
import { DINNER_PLAN_LABELS, emptyDinner } from "../config/weeklyPlan";
import { getErrorMessage } from "../lib/errors";

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

export default PlanMealPicker;

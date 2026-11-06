"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import api from "../api/client";
import type { CalendarEvent, Meal, MealInput, PlanDay } from "../api/client";
import { formatDay } from "../config/familyCalendar";
import { today } from "../config/homeRecords";
import {
  formatMinutes,
  INGREDIENT_GROUPS,
  isDinnerMeal,
  isOnHandGroup,
  kindLabel,
  linkSource,
  mealCuisineLabel,
  mealKind,
  methodLabel,
  totalMinutes,
} from "../config/meals";
import { useToast } from "../hooks/useToast";
import { getErrorMessage } from "../lib/errors";
import MealForm from "./MealForm";
import PlanMealPicker, { PlanDishPicker } from "./PlanMealPicker";

// One meal: what it takes, what to buy, and a way to put it on the weekly plan.
const MealDetail = ({ id }: { id: string }) => {
  const router = useRouter();
  const now = today();
  const [meal, setMeal] = useState<Meal | null>(null);
  const [days, setDays] = useState<PlanDay[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const { showToast, toastElement } = useToast();

  useEffect(() => {
    Promise.all([api.meals.getAll(), api.planner.days.getAll(), api.calendar.events.getAll()])
      .then(([meals, loadedDays, loadedEvents]) => {
        setMeal(meals.find((m) => m.id === id) ?? null);
        setDays(loadedDays);
        setEvents(loadedEvents);
      })
      .catch((err) => showToast(getErrorMessage(err), "error"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleSave = async (data: MealInput) => {
    try {
      setMeal(await api.meals.update(id, data));
      setEditing(false);
      showToast("Saved");
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    }
  };

  const handleDelete = async () => {
    if (!meal) return;
    if (!window.confirm(`Delete ${meal.name}? Days it's already planned for keep the name, but lose its grocery list.`)) {
      return;
    }
    try {
      await api.meals.delete(id);
      router.push(isDinnerMeal(meal) ? "/food" : "/food?tab=extras");
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    }
  };

  if (loading) {
    return (
      <div className="rest-detail">
        <div className="item-meta">Loading...</div>
        {toastElement}
      </div>
    );
  }

  if (!meal) {
    return (
      <div className="rest-detail">
        <Link href="/food" className="back-link">
          ← Meals and food
        </Link>
        <div className="rest-empty">
          <div className="rest-empty-title">Meal not found</div>
        </div>
        {toastElement}
      </div>
    );
  }

  const total = totalMinutes(meal);
  const isMeal = isDinnerMeal(meal);
  const upsertDay = (saved: PlanDay) =>
    setDays((prev) =>
      prev.some((d) => d.id === saved.id) ? prev.map((d) => (d.id === saved.id ? saved : d)) : [...prev, saved]
    );
  const upcoming = days
    .filter((d) => d.plan_on >= now && (d.dinner?.meal_id === meal.id || d.dishes?.some((x) => x.meal_id === meal.id)))
    .map((d) => d.plan_on)
    .sort();

  return (
    <div className="rest-detail">
      <Link href={isMeal ? "/food" : "/food?tab=extras"} className="back-link">
        ← {isMeal ? "Meals and food" : "Sides & desserts"}
      </Link>

      {editing ? (
        <div className="rest-panel">
          <div className="rest-panel-title">Edit {meal.name}</div>
          <MealForm initial={meal} submitLabel="Save meal" onSubmit={handleSave} onCancel={() => setEditing(false)} />
        </div>
      ) : (
        <>
          <div className="rest-head">
            <div>
              <h1 className="rest-name">{meal.name}</h1>
              <div className="rest-meta">
                {isMeal ? mealCuisineLabel(meal.cuisine) : `${kindLabel(mealKind(meal))} · ${mealCuisineLabel(meal.cuisine)}`}
              </div>
              {(meal.methods.length > 0 || meal.tags.length > 0) && (
                <div className="rc-tags rest-head-tags">
                  {meal.methods.map((m) => (
                    <span key={m} className="rc-tag rc-tag--occasion">
                      {methodLabel(m)}
                    </span>
                  ))}
                  {meal.tags.map((t) => (
                    <span key={t} className="rc-tag">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <div className="meal-link-row">
                {meal.recipe_url ? (
                  <a className="rc-btn rc-btn--book" href={meal.recipe_url} target="_blank" rel="noopener noreferrer">
                    Open on {linkSource(meal.recipe_url)}
                  </a>
                ) : (
                  <button type="button" className="btn-link" onClick={() => setEditing(true)}>
                    + Add a link
                  </button>
                )}
              </div>
            </div>
            {total != null && (
              <div className="rest-rating-box">
                <div className="meal-total">{formatMinutes(total)}</div>
                <div className="rest-rating-lbl">Total</div>
              </div>
            )}
          </div>

          <div className="rest-section">
            <div className="rest-section-title">{isMeal ? "Make it for dinner" : "Make it for something"}</div>
            {upcoming.length > 0 && (
              <p className="item-meta meal-upcoming">On the plan for {upcoming.map(formatDay).join(", ")}</p>
            )}
            {isMeal ? (
              <PlanMealPicker meal={meal} days={days} onPlanned={upsertDay} showToast={showToast} />
            ) : (
              <PlanDishPicker meal={meal} days={days} events={events} onPlanned={upsertDay} showToast={showToast} />
            )}
          </div>

          <div className="rest-section">
            <div className="fact-grid">
              <div>
                <div className="fact-label">Prep time</div>
                <div className="fact-val">{meal.prep_minutes != null ? formatMinutes(meal.prep_minutes) : "—"}</div>
              </div>
              <div>
                <div className="fact-label">Cook time</div>
                <div className="fact-val">{meal.cook_minutes != null ? formatMinutes(meal.cook_minutes) : "—"}</div>
              </div>
              <div>
                <div className="fact-label">Servings</div>
                <div className="fact-val">{meal.servings ?? "—"}</div>
              </div>
            </div>
          </div>

          <div className="rest-section">
            <div className="rest-section-title">Ingredients</div>
            {meal.ingredients.length === 0 ? (
              <p className="item-meta">
                None yet. Add them and this meal&apos;s groceries will show up when you plan it.
              </p>
            ) : (
              INGREDIENT_GROUPS.map((group) => {
                const items = meal.ingredients.filter((i) => i.group === group.id);
                return items.length === 0 ? null : (
                  <div key={group.id} className="grocery-group">
                    <div className="grocery-group-name">
                      {group.label}
                      {isOnHandGroup(group.id) && " · on hand"}
                    </div>
                    <ul className="meal-ingredients">
                      {items.map((item, index) => (
                        <li key={`${item.name}-${index}`}>
                          {item.quantity && <span className="grocery-amount">{item.quantity}</span>} {item.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })
            )}
          </div>

          {meal.notes && (
            <div className="rest-section">
              <div className="rest-section-title">Directions and notes</div>
              <div className="note-text">{meal.notes}</div>
            </div>
          )}

          <div className="rest-detail-actions">
            <button className="btn-link" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button className="btn-link btn-link--danger" onClick={handleDelete}>
              Delete
            </button>
          </div>
        </>
      )}
      {toastElement}
    </div>
  );
};

export default MealDetail;

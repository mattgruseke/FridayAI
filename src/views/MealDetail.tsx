"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import api from "../api/client";
import type { Meal, MealInput, PlanDay } from "../api/client";
import { formatDay } from "../config/familyCalendar";
import { today } from "../config/homeRecords";
import {
  formatMinutes,
  INGREDIENT_GROUPS,
  isOnHandGroup,
  mealCuisineLabel,
  methodLabel,
  totalMinutes,
} from "../config/meals";
import { useToast } from "../hooks/useToast";
import { getErrorMessage } from "../lib/errors";
import MealForm from "./MealForm";
import PlanMealPicker from "./PlanMealPicker";

// One meal: what it takes, what to buy, and a way to put it on the weekly plan.
const MealDetail = ({ id }: { id: string }) => {
  const router = useRouter();
  const now = today();
  const [meal, setMeal] = useState<Meal | null>(null);
  const [days, setDays] = useState<PlanDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const { showToast, toastElement } = useToast();

  useEffect(() => {
    Promise.all([api.meals.getAll(), api.planner.days.getAll()])
      .then(([meals, loadedDays]) => {
        setMeal(meals.find((m) => m.id === id) ?? null);
        setDays(loadedDays);
      })
      .catch((err) => showToast(getErrorMessage(err), "error"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleSave = async (data: MealInput) => {
    try {
      setMeal(await api.meals.update(id, data));
      setEditing(false);
      showToast("Meal saved");
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
      router.push("/food");
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
          ← Food
        </Link>
        <div className="rest-empty">
          <div className="rest-empty-title">Meal not found</div>
        </div>
        {toastElement}
      </div>
    );
  }

  const total = totalMinutes(meal);
  const upcoming = days
    .filter((d) => d.dinner?.meal_id === meal.id && d.plan_on >= now)
    .map((d) => d.plan_on)
    .sort();

  return (
    <div className="rest-detail">
      <Link href="/food" className="back-link">
        ← Food
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
              <div className="rest-meta">{mealCuisineLabel(meal.cuisine)}</div>
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
            </div>
            {total != null && (
              <div className="rest-rating-box">
                <div className="meal-total">{formatMinutes(total)}</div>
                <div className="rest-rating-lbl">Total</div>
              </div>
            )}
          </div>

          <div className="rest-section">
            <div className="rest-section-title">Make it for dinner</div>
            {upcoming.length > 0 && (
              <p className="item-meta meal-upcoming">On the plan for {upcoming.map(formatDay).join(", ")}</p>
            )}
            <PlanMealPicker
              meal={meal}
              days={days}
              onPlanned={(saved) =>
                setDays((prev) =>
                  prev.some((d) => d.id === saved.id) ? prev.map((d) => (d.id === saved.id ? saved : d)) : [...prev, saved]
                )
              }
              showToast={showToast}
            />
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
              {meal.recipe_url && (
                <div>
                  <div className="fact-label">Recipe</div>
                  <a className="fact-val" href={meal.recipe_url} target="_blank" rel="noopener noreferrer">
                    Open recipe
                  </a>
                </div>
              )}
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

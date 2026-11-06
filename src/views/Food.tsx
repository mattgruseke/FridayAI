"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import api from "../api/client";
import type { GroceryWeekDraft, Meal, MealInput, PlanDay } from "../api/client";
import { addDays, formatDay, startOfWeek, weekDates } from "../config/familyCalendar";
import { formatDate, today } from "../config/homeRecords";
import {
  buildGroceryList,
  formatMinutes,
  grocerySummary,
  isOnHandGroup,
  matchesTime,
  MEAL_CUISINES,
  MEAL_METHODS,
  mealCuisineLabel,
  methodLabel,
  sortMeals,
  STARTER_MEALS,
  TIME_FILTERS,
  totalMinutes,
} from "../config/meals";
import type { MealCuisine, MealMethod, TimeFilter } from "../config/meals";
import { useToast } from "../hooks/useToast";
import { getErrorMessage } from "../lib/errors";
import GroceryPanel from "./GroceryPanel";
import Items from "./Items";
import MealForm from "./MealForm";
import PlanMealPicker from "./PlanMealPicker";
import { Chips, toggleIn } from "./RestaurantForm";

const TABS = [
  { id: "meals", label: "Meals" },
  { id: "groceries", label: "Groceries" },
  { id: "tasks", label: "Tasks" },
] as const;

type Tab = (typeof TABS)[number]["id"];

// Food: the list of meals to make, this week's groceries, and any food tasks.
const Food = () => {
  const now = today();
  const [tab, setTab] = useState<Tab>("meals");
  const [meals, setMeals] = useState<Meal[]>([]);
  const [days, setDays] = useState<PlanDay[]>([]);
  const [weeks, setWeeks] = useState<GroceryWeekDraft[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [adding, setAdding] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [methods, setMethods] = useState<MealMethod[]>([]);
  const [times, setTimes] = useState<TimeFilter[]>([]);
  const [cuisines, setCuisines] = useState<MealCuisine[]>([]);
  const [planning, setPlanning] = useState<string | null>(null);
  const [anchor, setAnchor] = useState(now);
  const { showToast, toastElement } = useToast();

  useEffect(() => {
    Promise.all([api.meals.getAll(), api.planner.days.getAll(), api.groceries.getAll()])
      .then(([loadedMeals, loadedDays, loadedWeeks]) => {
        setMeals(loadedMeals);
        setDays(loadedDays);
        setWeeks(loadedWeeks);
        setStatus("ready");
      })
      .catch((err) => {
        setStatus("failed");
        showToast(getErrorMessage(err), "error");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(
    () =>
      sortMeals(meals).filter(
        (m) =>
          (methods.length === 0 || m.methods.some((x) => methods.includes(x))) &&
          (times.length === 0 || times.some((t) => matchesTime(m, t))) &&
          (cuisines.length === 0 || cuisines.includes(m.cuisine))
      ),
    [meals, methods, times, cuisines]
  );

  const filtering = methods.length + times.length + cuisines.length > 0;

  const clearFilters = () => {
    setMethods([]);
    setTimes([]);
    setCuisines([]);
  };

  const handleAdd = async (data: MealInput) => {
    try {
      const created = await api.meals.create(data);
      setMeals((prev) => [...prev, created]);
      setAdding(false);
      showToast(`Added ${created.name}`);
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    }
  };

  const addStarters = async () => {
    setSeeding(true);
    try {
      for (const starter of STARTER_MEALS) {
        const created = await api.meals.create(starter);
        setMeals((prev) => [...prev, created]);
      }
      showToast("Added 5 starter meals");
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setSeeding(false);
    }
  };

  const upsertDay = (saved: PlanDay) =>
    setDays((prev) =>
      prev.some((d) => d.id === saved.id) ? prev.map((d) => (d.id === saved.id ? saved : d)) : [...prev, saved]
    );

  // The next upcoming day this meal is on the plan, for its tile.
  const nextPlanned = (meal: Meal) =>
    days
      .filter((d) => d.dinner?.meal_id === meal.id && d.plan_on >= now)
      .map((d) => d.plan_on)
      .sort()[0];

  const weekOf = startOfWeek(anchor);
  const week = weeks.find((w) => w.week_of === weekOf);
  const groceries = buildGroceryList({ dates: weekDates(anchor), days, meals, week, now });

  return (
    <div className="restaurants">
      <div className="page-head">
        <div>
          <h1 className="page-title">Food</h1>
          <p className="page-sub">The meals you actually make, with what you need to buy for each one.</p>
        </div>
        <div className="view-toggle" role="group" aria-label="Food section">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={tab === t.id ? "view-toggle--active" : undefined}
              aria-pressed={tab === t.id}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "tasks" && <Items category="food" heading="Food tasks" />}

      {tab !== "tasks" && status === "failed" && (
        <div className="rest-empty">
          <div className="rest-empty-title">Couldn&apos;t load your meals</div>
          <div className="item-meta">Refresh the page to try again.</div>
        </div>
      )}

      {tab === "groceries" && status === "ready" && (
        <div className="section">
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
              <span className="fc-title">Week of {formatDate(weekOf)}</span>
            </div>
            <Link className="fc-task-link" href={`/calendar?view=plan&week=${weekOf}`}>
              Open the weekly plan
            </Link>
          </div>
          <GroceryPanel
            key={weekOf}
            weekOf={weekOf}
            week={week}
            list={groceries}
            onChange={(next) =>
              setWeeks((prev) =>
                prev.some((w) => w.week_of === next.week_of)
                  ? prev.map((w) => (w.week_of === next.week_of ? next : w))
                  : [...prev, next]
              )
            }
            showToast={showToast}
          />
        </div>
      )}

      {tab === "meals" && status !== "failed" && (
        <>
          {!adding && (
            <div className="meal-add-row">
              <button className="btn" onClick={() => setAdding(true)}>
                + Add meal
              </button>
              {status === "ready" && groceries.dinners.length > 0 && (
                <button type="button" className="btn-link" onClick={() => setTab("groceries")}>
                  This week&apos;s groceries: {grocerySummary(groceries)}
                </button>
              )}
            </div>
          )}

          {adding && (
            <div className="rest-panel">
              <div className="rest-panel-title">New meal</div>
              <MealForm submitLabel="Add meal" onSubmit={handleAdd} onCancel={() => setAdding(false)} />
            </div>
          )}

          <div className="filter-block">
            <div className="filter-row-label">How it&apos;s made</div>
            <Chips wide options={MEAL_METHODS} selected={methods} onToggle={(id) => setMethods((p) => toggleIn(p, id))} label="How it's made" />
          </div>
          <div className="filter-block">
            <div className="filter-row-label">Total time</div>
            <Chips wide options={TIME_FILTERS} selected={times} onToggle={(id) => setTimes((p) => toggleIn(p, id))} label="Total time" />
          </div>
          <div className="filter-block">
            <div className="filter-row-label">Cuisine</div>
            <Chips options={MEAL_CUISINES} selected={cuisines} onToggle={(id) => setCuisines((p) => toggleIn(p, id))} label="Cuisine" />
          </div>

          <div className="rest-count">
            {status === "loading"
              ? "Loading..."
              : filtering
                ? `${filtered.length} of ${meals.length} meals`
                : `${meals.length} meal${meals.length === 1 ? "" : "s"}`}
            {filtering && (
              <button className="btn-link" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>

          {status === "ready" && meals.length === 0 ? (
            <div className="rest-empty">
              <div className="rest-empty-title">No meals yet</div>
              <div className="item-meta">Add the meals you make, or start with a few easy ones and edit them to match.</div>
              <button type="button" className="record-secondary meal-seed" disabled={seeding} onClick={addStarters}>
                {seeding ? "Adding..." : "Add 5 starter meals"}
              </button>
            </div>
          ) : status === "ready" && filtered.length === 0 ? (
            <div className="rest-empty">
              <div className="rest-empty-title">Nothing matches those filters</div>
              <button className="btn-link" onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          ) : (
            <div className="rest-grid">
              {filtered.map((meal) => {
                const total = totalMinutes(meal);
                const toBuy = meal.ingredients.filter((i) => !isOnHandGroup(i.group)).length;
                const planned = nextPlanned(meal);
                return (
                  <div key={meal.id} className="rest-card">
                    <Link href={`/food/${meal.id}`} className="rc-link">
                      <div className="rc-top">
                        <span className="rc-name">{meal.name}</span>
                        {total != null && <span className="rc-rating">{formatMinutes(total)}</span>}
                      </div>
                      <div className="rc-meta">
                        {[mealCuisineLabel(meal.cuisine), toBuy > 0 ? `${toBuy} to buy` : null].filter(Boolean).join(" · ")}
                      </div>
                      {(meal.methods.length > 0 || meal.tags.length > 0) && (
                        <div className="rc-tags">
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
                      {planned && <div className="rc-note">On the plan for {formatDay(planned)}</div>}
                    </Link>
                    <div className="rc-actions">
                      <button
                        type="button"
                        className="rc-btn rc-btn--book meal-plan-btn"
                        aria-expanded={planning === meal.id}
                        aria-label={`Plan ${meal.name} for dinner`}
                        onClick={() => setPlanning((p) => (p === meal.id ? null : meal.id))}
                      >
                        Plan for dinner
                      </button>
                    </div>
                    {planning === meal.id && (
                      <PlanMealPicker meal={meal} days={days} onPlanned={upsertDay} showToast={showToast} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
      {toastElement}
    </div>
  );
};

export default Food;

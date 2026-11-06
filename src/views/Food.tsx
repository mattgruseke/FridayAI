"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import api from "../api/client";
import type { CalendarEvent, GroceryWeekDraft, Meal, MealInput, PlanDay } from "../api/client";
import { addDays, formatDay, startOfWeek, weekDates } from "../config/familyCalendar";
import { formatDate, today } from "../config/homeRecords";
import {
  buildGroceryList,
  EXTRA_KINDS,
  formatMinutes,
  grocerySummary,
  isDinnerMeal,
  isOnHandGroup,
  kindLabel,
  linkSource,
  matchesTime,
  MEAL_CUISINES,
  MEAL_METHODS,
  mealCuisineLabel,
  mealKind,
  methodLabel,
  sortMeals,
  STARTER_EXTRAS,
  STARTER_MEALS,
  TIME_FILTERS,
  totalMinutes,
} from "../config/meals";
import type { MealCuisine, MealKind, MealMethod, TimeFilter } from "../config/meals";
import { useToast } from "../hooks/useToast";
import { getErrorMessage } from "../lib/errors";
import GroceryPanel from "./GroceryPanel";
import Items from "./Items";
import MealForm from "./MealForm";
import PlanMealPicker, { PlanDishPicker } from "./PlanMealPicker";
import { Chips, toggleIn } from "./RestaurantForm";
import "./FamilyCalendar.css";
import "./HomeRecords.css";

const TABS = [
  { id: "meals", label: "Meals" },
  { id: "extras", label: "Sides & desserts" },
  { id: "groceries", label: "Groceries" },
  { id: "tasks", label: "Tasks" },
] as const;

type Tab = (typeof TABS)[number]["id"];

// Meals and food: meals for the week, sides and desserts to bring places, this week's
// groceries, and any food tasks. Meals and sides & desserts share one list of recipes.
const Food = () => {
  const now = today();
  const [tab, setTab] = useState<Tab>("meals");
  const [meals, setMeals] = useState<Meal[]>([]);
  const [days, setDays] = useState<PlanDay[]>([]);
  const [weeks, setWeeks] = useState<GroceryWeekDraft[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [kinds, setKinds] = useState<MealKind[]>([]);
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
    if (new URLSearchParams(window.location.search).get("tab") === "extras") setTab("extras");
    Promise.all([api.meals.getAll(), api.planner.days.getAll(), api.groceries.getAll(), api.calendar.events.getAll()])
      .then(([loadedMeals, loadedDays, loadedWeeks, loadedEvents]) => {
        setEvents(loadedEvents);
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

  const isExtras = tab === "extras";
  const inTab = useMemo(() => meals.filter((m) => isDinnerMeal(m) !== isExtras), [meals, isExtras]);
  const noun = isExtras ? "recipe" : "meal";

  const filtered = useMemo(
    () =>
      sortMeals(inTab).filter(
        (m) =>
          (!isExtras || kinds.length === 0 || kinds.includes(mealKind(m))) &&
          (methods.length === 0 || m.methods.some((x) => methods.includes(x))) &&
          (times.length === 0 || times.some((t) => matchesTime(m, t))) &&
          (cuisines.length === 0 || cuisines.includes(m.cuisine))
      ),
    [inTab, isExtras, kinds, methods, times, cuisines]
  );

  const filtering = methods.length + times.length + cuisines.length + (isExtras ? kinds.length : 0) > 0;

  const clearFilters = () => {
    setKinds([]);
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
      const starters = isExtras ? STARTER_EXTRAS : STARTER_MEALS;
      for (const starter of starters) {
        const created = await api.meals.create(starter);
        setMeals((prev) => [...prev, created]);
      }
      showToast(`Added ${starters.length} starter ${noun}s`);
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
      .filter((d) => d.plan_on >= now && (d.dinner?.meal_id === meal.id || d.dishes?.some((x) => x.meal_id === meal.id)))
      .map((d) => d.plan_on)
      .sort()[0];

  const weekOf = startOfWeek(anchor);
  const week = weeks.find((w) => w.week_of === weekOf);
  const groceries = buildGroceryList({ dates: weekDates(anchor), days, meals, week, now });

  return (
    <div className="restaurants">
      <div className="page-head food-head">
        <div>
          <h1 className="page-title">Meals and food</h1>
          <p className="page-sub">The meals you actually make, with what you need to buy for each one.</p>
        </div>
        <div className="view-toggle" role="group" aria-label="Meals and food section">
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

      {(tab === "meals" || isExtras) && status !== "failed" && (
        <>
          {isExtras && (
            <p className="page-sub food-tab-intro">
              Corn salad for the barbecue, a pound cake for a dinner party. Not what&apos;s for dinner this week, but still
              on your grocery list when you plan to make them.
            </p>
          )}
          {!adding && (
            <div className="meal-add-row">
              <button className="btn" onClick={() => setAdding(true)}>
                + Add {isExtras ? "side or dessert" : "meal"}
              </button>
              {status === "ready" && groceries.dinners.length + groceries.dishes.length > 0 && (
                <button type="button" className="btn-link" onClick={() => setTab("groceries")}>
                  This week&apos;s groceries: {grocerySummary(groceries)}
                </button>
              )}
            </div>
          )}

          {adding && (
            <div className="rest-panel">
              <div className="rest-panel-title">{isExtras ? "New side or dessert" : "New meal"}</div>
              <MealForm
                key={tab}
                defaultKind={isExtras ? "side" : "meal"}
                submitLabel={`Add ${noun}`}
                onSubmit={handleAdd}
                onCancel={() => setAdding(false)}
              />
            </div>
          )}

          {isExtras && (
            <div className="filter-block">
              <div className="filter-row-label">Type</div>
              <Chips wide options={EXTRA_KINDS} selected={kinds} onToggle={(id) => setKinds((p) => toggleIn(p, id))} label="Type" />
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
                ? `${filtered.length} of ${inTab.length} ${noun}s`
                : `${inTab.length} ${noun}${inTab.length === 1 ? "" : "s"}`}
            {filtering && (
              <button className="btn-link" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>

          {status === "ready" && inTab.length === 0 ? (
            <div className="rest-empty">
              <div className="rest-empty-title">{isExtras ? "No sides or desserts yet" : "No meals yet"}</div>
              <div className="item-meta">
                {isExtras
                  ? "Add the ones you like to bring, or start with a few and edit them to match."
                  : "Add the meals you make, or start with a few easy ones and edit them to match."}
              </div>
              <button type="button" className="record-secondary meal-seed" disabled={seeding} onClick={addStarters}>
                {seeding
                  ? "Adding..."
                  : `Add ${(isExtras ? STARTER_EXTRAS : STARTER_MEALS).length} starter ${noun}s`}
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
            <div className="rest-grid meal-grid">
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
                        {[
                          isExtras ? kindLabel(mealKind(meal)) : null,
                          mealCuisineLabel(meal.cuisine),
                          toBuy > 0 ? `${toBuy} to buy` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
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
                        aria-label={isExtras ? `Make ${meal.name} for something` : `Plan ${meal.name} for dinner`}
                        onClick={() => setPlanning((p) => (p === meal.id ? null : meal.id))}
                      >
                        {isExtras ? "Make it for something" : "Plan for dinner"}
                      </button>
                      {meal.recipe_url && (
                        <a
                          className="rc-btn"
                          href={meal.recipe_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Open ${meal.name} on ${linkSource(meal.recipe_url)}`}
                        >
                          {linkSource(meal.recipe_url)}
                        </a>
                      )}
                    </div>
                    {planning === meal.id &&
                      (isExtras ? (
                        <PlanDishPicker meal={meal} days={days} events={events} onPlanned={upsertDay} showToast={showToast} />
                      ) : (
                        <PlanMealPicker meal={meal} days={days} onPlanned={upsertDay} showToast={showToast} />
                      ))}
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

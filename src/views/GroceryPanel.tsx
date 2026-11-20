"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import api from "../api/client";
import type { GroceryExtra, GroceryWeekDraft, GroceryWeekInput } from "../api/client";
import {
  emptyGroceryWeek,
  groceryText,
  grocerySummary,
  INGREDIENT_GROUPS,
  isOnHandGroup,
  itemAmount,
} from "../config/meals";
import type { GroceryItem, GroceryList, IngredientGroup } from "../config/meals";
import { WEEKDAYS, weekdayOf } from "../config/familyCalendar";
import { getErrorMessage } from "../lib/errors";

const toggled = (list: string[], key: string) =>
  list.includes(key) ? list.filter((k) => k !== key) : [...list, key];

const inputOf = ({ week_of, have, need, extras, ordered_at, ordered_keys }: GroceryWeekDraft): GroceryWeekInput => ({
  week_of,
  have,
  need,
  extras,
  ordered_at,
  ordered_keys,
});

// One week's grocery list. Mount it with key={weekOf}. Saves run one at a time and each
// sends the latest state, so ticking several boxes quickly can't lose any of them.
const GroceryPanel = ({
  weekOf,
  week,
  list,
  onChange,
  showToast,
}: {
  weekOf: string;
  week: GroceryWeekDraft | undefined;
  list: GroceryList;
  onChange: (week: GroceryWeekDraft) => void;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}) => {
  const current = useRef<GroceryWeekDraft>(week ?? emptyGroceryWeek(weekOf));
  const queue = useRef<Promise<void>>(Promise.resolve());
  const [extraName, setExtraName] = useState("");
  const [extraAmount, setExtraAmount] = useState("");
  const [extraGroup, setExtraGroup] = useState<IngredientGroup>("grocery");

  const change = (patch: Partial<GroceryWeekDraft>) => {
    current.current = { ...current.current, ...patch };
    onChange(current.current);
    queue.current = queue.current
      .then(async () => {
        const { id } = current.current;
        const input = inputOf(current.current);
        const saved = id ? await api.groceries.update(id, input) : await api.groceries.create(input);
        if (!id) {
          current.current = { ...current.current, id: saved.id };
          onChange(current.current);
        }
      })
      .catch((err) => showToast(getErrorMessage(err), "error"));
  };

  const addExtra = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!extraName.trim()) return;
    const extra: GroceryExtra = {
      id: crypto.randomUUID(),
      name: extraName.trim(),
      quantity: extraAmount.trim() || null,
      group: extraGroup,
    };
    change({ extras: [...current.current.extras, extra] });
    setExtraName("");
    setExtraAmount("");
  };

  const markOrdered = () => {
    change({ ordered_at: new Date().toISOString(), ordered_keys: list.needed.map((i) => i.key) });
    showToast("Marked as ordered");
  };

  const copyList = async () => {
    try {
      await navigator.clipboard.writeText(groceryText(list, weekOf));
      showToast("List copied");
    } catch {
      showToast("Couldn't copy the list", "error");
    }
  };

  const itemRow = (item: GroceryItem, onHand: boolean) => {
    const checked = onHand ? current.current.need.includes(item.key) : current.current.have.includes(item.key);
    const crossed = !onHand && checked;
    return (
      <li key={item.key} className="grocery-item">
        <label className={`grocery-check${crossed ? " grocery-check--crossed" : ""}`}>
          <input
            type="checkbox"
            checked={checked}
            aria-label={onHand ? `Out of ${item.name}, add it to the order` : `Already have ${item.name}`}
            onChange={() =>
              onHand
                ? change({ need: toggled(current.current.need, item.key) })
                : change({ have: toggled(current.current.have, item.key) })
            }
          />
          <span className="grocery-name">{item.name}</span>
          {item.quantities.length > 0 && <span className="grocery-amount">{itemAmount(item)}</span>}
        </label>
        {item.meals.length > 0 && <span className="grocery-meals">{item.meals.join(", ")}</span>}
        {item.extraId && (
          <button
            type="button"
            className="btn-link btn-link--danger"
            aria-label={`Remove ${item.name}`}
            onClick={() => change({ extras: current.current.extras.filter((x) => x.id !== item.extraId) })}
          >
            remove
          </button>
        )}
      </li>
    );
  };

  return (
    <div className="grocery-panel">
      {list.dinners.length + list.dishes.length > 0 ? (
        <div className="grocery-dinners">
          {[...list.dinners, ...list.dishes].map(({ date, meal }) => (
            <Link key={`${date}-${meal.id}`} className="grocery-dinner" href={`/food/${meal.id}`}>
              <span className="grocery-dinner-day">
                {WEEKDAYS[weekdayOf(date)].slice(0, 3)} {Number(date.slice(8))}
              </span>
              {meal.name}
            </Link>
          ))}
        </div>
      ) : (
        <p className="item-meta">
          No meals picked for the rest of this week. Pick one on a day&apos;s dinner, or from{" "}
          <Link href="/food">Meals and food</Link>, and its groceries show up here.
        </p>
      )}

      {list.toBuy.length > 0 && (
        <>
          <div className="grocery-head">To get</div>
          <p className="item-meta grocery-help">Tick anything you already have and it comes off the order.</p>
          {INGREDIENT_GROUPS.filter((g) => !isOnHandGroup(g.id) || list.toBuy.some((i) => i.group === g.id)).map((group) => {
            const items = list.toBuy.filter((i) => i.group === group.id);
            return items.length === 0 ? null : (
              <div key={group.id} className="grocery-group">
                <div className="grocery-group-name">{group.label}</div>
                <ul className="grocery-items">{items.map((item) => itemRow(item, false))}</ul>
              </div>
            );
          })}
        </>
      )}

      {list.onHand.length > 0 && (
        <>
          <div className="grocery-head">Check you have</div>
          <p className="item-meta grocery-help">Pantry items and spices these meals use. Tick any you&apos;re out of to add them.</p>
          <ul className="grocery-items">{list.onHand.map((item) => itemRow(item, true))}</ul>
        </>
      )}

      <form className="grocery-add" onSubmit={addExtra}>
        <input
          className="input"
          aria-label="Add something else: item"
          maxLength={120}
          value={extraName}
          placeholder="Add something else: milk, paper towels..."
          onChange={(e) => setExtraName(e.target.value)}
        />
        <input
          className="input grocery-add-amount"
          aria-label="Add something else: amount"
          maxLength={60}
          value={extraAmount}
          placeholder="Amount"
          onChange={(e) => setExtraAmount(e.target.value)}
        />
        <select
          className="input grocery-add-group"
          aria-label="Add something else: type"
          value={extraGroup}
          onChange={(e) => setExtraGroup(e.target.value as IngredientGroup)}
        >
          {INGREDIENT_GROUPS.filter((g) => !isOnHandGroup(g.id)).map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
        </select>
        <button className="record-secondary" type="submit" disabled={!extraName.trim()}>
          Add
        </button>
      </form>

      <div className="grocery-actions">
        <span className="grocery-total">{grocerySummary(list)}</span>
        <button type="button" className="record-secondary" disabled={list.needed.length === 0} onClick={copyList}>
          Copy list
        </button>
        {list.status === "ordered" ? (
          <span className="grocery-ordered">
            Ordered {new Date(current.current.ordered_at as string).toLocaleDateString()}
            <button
              type="button"
              className="btn-link"
              onClick={() => change({ ordered_at: null, ordered_keys: [] })}
            >
              undo
            </button>
          </span>
        ) : (
          <button type="button" className="btn" disabled={list.needed.length === 0} onClick={markOrdered}>
            {list.status === "changed" ? `Mark ${list.addedSinceOrder.length} new as ordered` : "Mark as ordered"}
          </button>
        )}
      </div>
    </div>
  );
};

export default GroceryPanel;

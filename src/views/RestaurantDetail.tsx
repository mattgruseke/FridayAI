"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import api from "../api/client";
import type { RestaurantDetail as Detail, RestaurantInput, RestaurantVisit } from "../api/client";
import { cuisineLabel, occasionLabel, serviceLabel } from "../config/restaurants";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../hooks/useToast";
import { getErrorMessage } from "../lib/errors";
import RestaurantForm, { formatRating, restaurantMeta } from "./RestaurantForm";

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// "2026-03-14" → "Mar 2026" (parsed as a local date so it doesn't shift a day)
const formatVisitDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", year: "numeric" });
};

const average = (ratings: number[]) =>
  ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null;

// One restaurant's profile: check-in, key facts, ratings, notes, visits, booking.
const RestaurantDetail = ({ id }: { id: string }) => {
  const router = useRouter();
  const { fullName } = useAuth();
  const [restaurant, setRestaurant] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const { showToast, toastElement } = useToast();

  // Check-in form
  const [rating, setRating] = useState<number | null>(null);
  const [ratedBy, setRatedBy] = useState("");
  const [visitedOn, setVisitedOn] = useState(today);
  const [visitNote, setVisitNote] = useState("");
  const [savingVisit, setSavingVisit] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);

  useEffect(() => {
    api.restaurants
      .get(id)
      .then(setRestaurant)
      .catch((err) => showToast(getErrorMessage(err), "error"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (fullName && !ratedBy) setRatedBy(fullName.split(" ")[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullName]);

  // Average rating per person, in order of first appearance.
  const ratingsByPerson = useMemo(() => {
    const groups = new Map<string, number[]>();
    for (const v of restaurant?.visits ?? []) {
      if (v.rating == null) continue;
      const who = v.rated_by || "You";
      groups.set(who, [...(groups.get(who) ?? []), v.rating]);
    }
    return [...groups].map(([who, ratings]) => ({ who, avg: average(ratings), count: ratings.length }));
  }, [restaurant]);

  const setVisits = (visits: RestaurantVisit[]) =>
    setRestaurant((prev) => {
      if (!prev) return prev;
      const sorted = [...visits].sort(
        (a, b) => b.visited_on.localeCompare(a.visited_on) || b.created_at.localeCompare(a.created_at)
      );
      return {
        ...prev,
        visits: sorted,
        visit_count: sorted.length,
        avg_rating: average(sorted.map((v) => v.rating).filter((r): r is number => r != null)),
      };
    });

  const handleCheckIn = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!restaurant) return;
    setSavingVisit(true);
    try {
      const visit = await api.restaurants.addVisit(restaurant.id, {
        visited_on: visitedOn,
        rating,
        rated_by: ratedBy.trim() || null,
        note: visitNote.trim() || null,
      });
      setVisits([...restaurant.visits, visit]);
      setCheckedIn(true);
      setRating(null);
      setVisitNote("");
      setVisitedOn(today());
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setSavingVisit(false);
    }
  };

  const handleDeleteVisit = async (visit: RestaurantVisit) => {
    if (!restaurant) return;
    const before = restaurant.visits;
    setVisits(before.filter((v) => v.id !== visit.id));
    try {
      await api.restaurants.deleteVisit(visit.id);
    } catch (err) {
      setVisits(before);
      showToast(getErrorMessage(err), "error");
    }
  };

  const handleUpdate = async (data: RestaurantInput) => {
    try {
      const updated = await api.restaurants.update(id, data);
      setRestaurant((prev) => (prev ? { ...prev, ...updated } : prev));
      setEditing(false);
      showToast("Saved");
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    }
  };

  const handleDelete = async () => {
    if (!restaurant || !window.confirm(`Delete ${restaurant.name} and its visit history?`)) return;
    try {
      await api.restaurants.delete(restaurant.id);
      router.push("/restaurants");
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    }
  };

  if (loading || !restaurant) {
    return (
      <div className="rest-detail">
        <Link className="back-link" href="/restaurants">
          ← Back to Restaurants
        </Link>
        <div className="item-meta">{loading ? "Loading..." : "Restaurant not found."}</div>
        {toastElement}
      </div>
    );
  }

  const r = restaurant;
  const facts = [
    { label: "Cuisine", value: r.style ? `${r.style} (${cuisineLabel(r.cuisine)})` : cuisineLabel(r.cuisine) },
    { label: "Occasion", value: r.occasions.map(occasionLabel).join(", ") },
    { label: "Service", value: r.services.map(serviceLabel).join(", ") },
    { label: "Price", value: r.price ? "$".repeat(r.price) : "" },
    { label: "Location", value: [r.location, r.distance].filter(Boolean).join(" · ") },
    { label: "Booking", value: r.booking_label ?? "" },
  ].filter((f) => f.value);

  return (
    <div className="rest-detail">
      <Link className="back-link" href="/restaurants">
        ← Back to Restaurants
      </Link>

      <div className="rest-head">
        <div>
          <h1 className="rest-name">{r.name}</h1>
          <div className="rest-meta">{restaurantMeta(r)}</div>
          {r.tags.length > 0 && (
            <div className="rc-tags rest-head-tags">
              {r.tags.map((t) => (
                <span key={t} className="rc-tag">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="rest-rating-box">
          <div className="rest-rating-num">{formatRating(r.avg_rating)}</div>
          <div className="rest-rating-lbl">Avg Rating</div>
        </div>
      </div>

      {editing ? (
        <div className="rest-panel">
          <div className="rest-panel-title">Edit {r.name}</div>
          <RestaurantForm initial={r} submitLabel="Save changes" onSubmit={handleUpdate} onCancel={() => setEditing(false)} />
        </div>
      ) : (
        <>
          <div className="checkin-card">
            {checkedIn ? (
              <div className="checkin-done">
                ✓ Saved — this makes Friday&apos;s future suggestions smarter.{" "}
                <button className="btn-link" onClick={() => setCheckedIn(false)}>
                  Log another visit
                </button>
              </div>
            ) : (
              <form onSubmit={handleCheckIn}>
                <div className="checkin-head">
                  {r.visit_count === 0 ? "✨ Been here yet? Log your first visit." : "✨ Friday wants to know: how was it?"}
                </div>
                <div className="checkin-sub">
                  A quick rating makes every future suggestion this good or better.
                </div>
                <div className="rate-row" role="group" aria-label="Rating">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`rate-btn${rating === n ? " rate-btn--selected" : ""}`}
                      aria-pressed={rating === n}
                      onClick={() => setRating(rating === n ? null : n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div className="checkin-fields">
                  <input
                    className="input"
                    value={ratedBy}
                    onChange={(e) => setRatedBy(e.target.value)}
                    placeholder="Who's rating?"
                    aria-label="Who's rating"
                  />
                  <input
                    className="input"
                    type="date"
                    value={visitedOn}
                    max={today()}
                    onChange={(e) => setVisitedOn(e.target.value)}
                    aria-label="Visit date"
                    required
                  />
                </div>
                <input
                  className="input checkin-note"
                  value={visitNote}
                  onChange={(e) => setVisitNote(e.target.value)}
                  placeholder="What did you order? Anything worth remembering?"
                  aria-label="Visit note"
                />
                <button className="btn" type="submit" disabled={savingVisit}>
                  {savingVisit ? "Saving..." : `Save to ${r.name}`}
                </button>
              </form>
            )}
          </div>

          {facts.length > 0 && (
            <div className="rest-section">
              <div className="rest-section-title">Key Facts</div>
              <div className="fact-grid">
                {facts.map((f) => (
                  <div key={f.label}>
                    <div className="fact-label">{f.label}</div>
                    <div className="fact-val">{f.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ratingsByPerson.length > 0 && (
            <div className="rest-section">
              <div className="rest-section-title">Ratings</div>
              <div className="rating-split">
                {ratingsByPerson.map((p) => (
                  <div key={p.who}>
                    <div className="rating-who">{p.who}</div>
                    <div className="rating-num">{formatRating(p.avg)}</div>
                    {p.count > 1 && <div className="item-meta">{p.count} visits</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {r.usual_order && (
            <div className="rest-section">
              <div className="rest-section-title">What We Usually Order</div>
              <p className="note-text">{r.usual_order}</p>
            </div>
          )}

          {r.note && (
            <div className="rest-section">
              <div className="rest-section-title">Notes</div>
              <p className="note-text">{r.note}</p>
            </div>
          )}

          <div className="rest-section">
            <div className="rest-section-title">Visit History</div>
            {r.visits.length === 0 ? (
              <p className="note-text">No visits logged yet.</p>
            ) : (
              r.visits.map((v) => (
                <div key={v.id} className="history-item">
                  <div className="history-date">{formatVisitDate(v.visited_on)}</div>
                  <div className="history-text">
                    {v.rating != null && (
                      <span className="history-rating">
                        {v.rated_by ? `${v.rated_by}: ` : ""}★ {v.rating}
                      </span>
                    )}
                    {v.note || (v.rating == null ? "Visited" : "")}
                  </div>
                  <button className="btn-link btn-link--danger" onClick={() => handleDeleteVisit(v)}>
                    delete
                  </button>
                </div>
              ))
            )}
          </div>

          {r.booking_url && (
            <div className="rest-section">
              <div className="rest-section-title">Book</div>
              <a className="btn rest-book-btn" href={r.booking_url} target="_blank" rel="noopener noreferrer">
                {r.booking_label || "Book a table"}
              </a>
            </div>
          )}

          <div className="rest-detail-actions">
            <button className="btn-link" onClick={() => setEditing(true)}>
              Edit restaurant
            </button>
            <button className="btn-link btn-link--danger" onClick={handleDelete}>
              Delete restaurant
            </button>
          </div>
        </>
      )}
      {toastElement}
    </div>
  );
};

export default RestaurantDetail;

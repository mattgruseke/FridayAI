"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import api from "../api/client";
import type { Restaurant, RestaurantInput } from "../api/client";
import { CUISINES, OCCASIONS, SERVICES, TOWNS, inTown, occasionLabel } from "../config/restaurants";
import type { Cuisine, Occasion, Service, Town } from "../config/restaurants";
import { useToast } from "../hooks/useToast";
import { getErrorMessage } from "../lib/errors";
import RestaurantForm, { Chips, formatRating, restaurantMeta, toggleIn } from "./RestaurantForm";

// Restaurants list: location / cuisine / occasion / service chips filter the tiles below.
// Within a row, chips are OR'd; across rows, AND'd; an empty row matches all.
const Restaurants = () => {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [towns, setTowns] = useState<Town[]>([]);
  const [cuisines, setCuisines] = useState<Cuisine[]>([]);
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const { showToast, toastElement } = useToast();

  useEffect(() => {
    api.restaurants
      .getAll()
      .then(setRestaurants)
      .catch((err) => showToast(getErrorMessage(err), "error"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(
    () =>
      restaurants.filter(
        (r) =>
          (towns.length === 0 || towns.some((t) => inTown(r.location, t))) &&
          (cuisines.length === 0 || cuisines.includes(r.cuisine)) &&
          (occasions.length === 0 || r.occasions.some((o) => occasions.includes(o))) &&
          (services.length === 0 || r.services.some((s) => services.includes(s)))
      ),
    [restaurants, towns, cuisines, occasions, services]
  );

  const filtering = towns.length + cuisines.length + occasions.length + services.length > 0;

  const clearFilters = () => {
    setTowns([]);
    setCuisines([]);
    setOccasions([]);
    setServices([]);
  };

  const handleAdd = async (data: RestaurantInput) => {
    try {
      const created = await api.restaurants.create(data);
      setRestaurants((prev) => [created, ...prev]);
      setAdding(false);
      showToast(`Added ${created.name}`);
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    }
  };

  return (
    <div className="restaurants">
      <div className="page-head">
        <div>
          <h1 className="page-title">Restaurants</h1>
          <p className="page-sub">
            Every spot you&apos;ve logged, with the notes that actually make suggestions useful.
          </p>
        </div>
        {!adding && (
          <button className="btn" onClick={() => setAdding(true)}>
            + Add restaurant
          </button>
        )}
      </div>

      {adding && (
        <div className="rest-panel">
          <div className="rest-panel-title">New restaurant</div>
          <RestaurantForm submitLabel="Add restaurant" onSubmit={handleAdd} onCancel={() => setAdding(false)} />
        </div>
      )}

      <div className="filter-block">
        <div className="filter-row-label">Location</div>
        <Chips wide options={TOWNS} selected={towns} onToggle={(id) => setTowns((p) => toggleIn(p, id))} label="Location" />
      </div>

      <div className="filter-block">
        <div className="filter-row-label">Cuisine</div>
        <Chips options={CUISINES} selected={cuisines} onToggle={(id) => setCuisines((p) => toggleIn(p, id))} label="Cuisine" />
      </div>

      <div className="filter-block">
        <div className="filter-row-label">Occasion</div>
        <Chips wide options={OCCASIONS} selected={occasions} onToggle={(id) => setOccasions((p) => toggleIn(p, id))} label="Occasion" />
      </div>

      <div className="filter-block">
        <div className="filter-row-label">Service</div>
        <Chips wide options={SERVICES} selected={services} onToggle={(id) => setServices((p) => toggleIn(p, id))} label="Service" />
      </div>

      <div className="rest-count">
        {loading
          ? "Loading..."
          : filtering
            ? `${filtered.length} of ${restaurants.length} restaurants`
            : `${restaurants.length} restaurant${restaurants.length === 1 ? "" : "s"}`}
        {filtering && (
          <button className="btn-link" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      {!loading && restaurants.length === 0 ? (
        <div className="rest-empty">
          <div className="rest-empty-title">No restaurants yet</div>
          <div className="item-meta">Add the places you love (or want to try) and filter them here.</div>
        </div>
      ) : !loading && filtered.length === 0 ? (
        <div className="rest-empty">
          <div className="rest-empty-title">Nothing matches those filters</div>
          <button className="btn-link" onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      ) : (
        <div className="rest-grid">
          {filtered.map((r) => (
            <div key={r.id} className="rest-card">
              <Link href={`/restaurants/${r.id}`} className="rc-link">
                <div className="rc-top">
                  <span className="rc-name">{r.name}</span>
                  <span className="rc-rating">★ {formatRating(r.avg_rating)}</span>
                </div>
                <div className="rc-meta">{restaurantMeta(r)}</div>
                {(r.occasions.length > 0 || r.tags.length > 0) && (
                  <div className="rc-tags">
                    {r.occasions.map((o) => (
                      <span key={o} className="rc-tag rc-tag--occasion">
                        {occasionLabel(o)}
                      </span>
                    ))}
                    {r.tags.map((t) => (
                      <span key={t} className="rc-tag">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {(r.note || r.visit_count === 0) && (
                  <div className="rc-note">{r.note || "Not yet visited."}</div>
                )}
              </Link>
              {r.booking_label && (
                <div className="rc-actions">
                  {r.booking_url ? (
                    <a className="rc-btn rc-btn--book" href={r.booking_url} target="_blank" rel="noopener noreferrer">
                      {r.booking_label}
                    </a>
                  ) : (
                    <span className="rc-btn">{r.booking_label}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {toastElement}
    </div>
  );
};

export default Restaurants;

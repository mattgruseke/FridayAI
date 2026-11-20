"use client";

import { useState } from "react";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

// Month grid. Layout only for now: items don't have dates yet, so days are empty.
const Calendar = () => {
  const today = new Date();
  const [month, setMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );

  // Six full weeks starting on the Monday on or before the 1st.
  const start = new Date(month);
  start.setDate(1 - ((month.getDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });

  const shift = (delta: number) =>
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));

  return (
    <div className="calendar">
      <div className="calendar-toolbar">
        <button className="btn-link" onClick={() => shift(-1)} aria-label="Previous month">
          ‹ prev
        </button>
        <span className="calendar-title">
          {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </span>
        <button className="btn-link" onClick={() => shift(1)} aria-label="Next month">
          next ›
        </button>
      </div>

      <div className="calendar-grid">
        {WEEKDAYS.map((d) => (
          <div key={d} className="calendar-weekday">
            {d}
          </div>
        ))}
        {days.map((d) => (
          <div
            key={d.toISOString()}
            className={[
              "calendar-day",
              d.getMonth() !== month.getMonth() && "calendar-day--outside",
              sameDay(d, today) && "calendar-day--today",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className="calendar-date">{d.getDate()}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Calendar;

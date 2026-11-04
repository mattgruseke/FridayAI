"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import api from "../api/client";
import type { CalendarEvent, CalendarEventInput } from "../api/client";
import {
  addDays,
  addMonthsToMonth,
  formatCountdown,
  formatDay,
  formatMonth,
  formatTime,
  holidaysInYear,
  holidaysOn,
  monthGrid,
  normalizeTime,
  startOfMonth,
  WEEKDAYS,
} from "../config/familyCalendar";
import { formatDate, today } from "../config/homeRecords";
import { getErrorMessage } from "../lib/errors";
import { Field } from "./HomeRecordFields";
import type { ShowToast } from "./HomeRecordFields";

const UPCOMING_DAYS = 90;
const UPCOMING_LIMIT = 8;

// All-day first, then by time.
const byTime = (a: CalendarEvent, b: CalendarEvent) =>
  (a.start_time ?? "").localeCompare(b.start_time ?? "") || a.title.localeCompare(b.title);

const EventForm = ({
  event,
  date,
  onSaved,
  onDeleted,
  onCancel,
  showToast,
}: {
  event?: CalendarEvent;
  date: string;
  onSaved: (saved: CalendarEvent) => void;
  onDeleted: () => void;
  onCancel: () => void;
  showToast: ShowToast;
}) => {
  const [title, setTitle] = useState(event?.title ?? "");
  const [eventOn, setEventOn] = useState(event?.event_on ?? date);
  const [startTime, setStartTime] = useState(event?.start_time ? normalizeTime(event.start_time) : "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [notes, setNotes] = useState(event?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input: CalendarEventInput = {
      title,
      event_on: eventOn,
      start_time: startTime || null,
      location: location || null,
      notes: notes || null,
    };
    setSaving(true);
    try {
      onSaved(event ? await api.calendar.events.update(event.id, input) : await api.calendar.events.create(input));
    } catch (err) {
      showToast(getErrorMessage(err), "error");
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event || !window.confirm(`Delete "${event.title}"?`)) return;
    try {
      await api.calendar.events.delete(event.id);
      onDeleted();
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    }
  };

  return (
    <form className="record-form" onSubmit={handleSubmit}>
      <Field label="Event" wide>
        <input
          className="input"
          type="text"
          required
          autoFocus
          maxLength={200}
          value={title}
          placeholder="Doctor's appointment, birthday party..."
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>
      <Field label="Date">
        <input className="input" type="date" required value={eventOn} onChange={(e) => setEventOn(e.target.value)} />
      </Field>
      <Field label="Time (blank for all day)">
        <input className="input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
      </Field>
      <Field label="Location">
        <input
          className="input"
          type="text"
          maxLength={200}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </Field>
      <Field label="Notes" wide>
        <textarea
          className="input record-textarea"
          rows={2}
          maxLength={5000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>
      <div className="record-actions">
        <button className="btn" type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </button>
        <button type="button" className="btn-link" onClick={onCancel}>
          cancel
        </button>
        {event && (
          <button type="button" className="btn-link btn-link--danger record-delete" onClick={handleDelete}>
            delete event
          </button>
        )}
      </div>
    </form>
  );
};

type OpenForm = { event?: CalendarEvent; date: string } | null;

const CalendarEvents = ({ showToast }: { showToast: ShowToast }) => {
  const now = today();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(startOfMonth(now));
  const [open, setOpen] = useState<OpenForm>(null);

  useEffect(() => {
    api.calendar.events
      .getAll()
      .then(setEvents)
      .catch((err) => showToast(getErrorMessage(err), "error"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) map.set(event.event_on, [...(map.get(event.event_on) ?? []), event]);
    map.forEach((list) => list.sort(byTime));
    return map;
  }, [events]);

  const upcoming = useMemo(() => {
    const end = addDays(now, UPCOMING_DAYS);
    const years = [Number(now.slice(0, 4)), Number(end.slice(0, 4))];
    const holidays = [...new Set(years)]
      .flatMap(holidaysInYear)
      .map((h) => ({ date: h.date, title: h.title, holiday: true as const }));
    const own = events.map((event) => ({ date: event.event_on, title: event.title, event, holiday: false as const }));
    return [...own, ...holidays]
      .filter((entry) => entry.date >= now && entry.date <= end)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, UPCOMING_LIMIT);
  }, [events, now]);

  const handleSaved = (saved: CalendarEvent) => {
    setEvents((prev) =>
      prev.some((e) => e.id === saved.id) ? prev.map((e) => (e.id === saved.id ? saved : e)) : [...prev, saved]
    );
    setMonth(startOfMonth(saved.event_on));
    setOpen(null);
    showToast("Event saved");
  };

  return (
    <>
      <div className="fc-toolbar">
        <div className="fc-nav">
          <button
            type="button"
            className="record-secondary fc-arrow"
            aria-label="Previous month"
            onClick={() => setMonth((m) => addMonthsToMonth(m, -1))}
          >
            ‹
          </button>
          <button
            type="button"
            className="record-secondary fc-arrow"
            aria-label="Next month"
            onClick={() => setMonth((m) => addMonthsToMonth(m, 1))}
          >
            ›
          </button>
          <button type="button" className="record-secondary" onClick={() => setMonth(startOfMonth(now))}>
            Today
          </button>
          <span className="fc-title">{formatMonth(month)}</span>
        </div>
        <button className="btn" type="button" onClick={() => setOpen({ date: now })}>
          Add event
        </button>
      </div>

      {open && (
        <EventForm
          key={open.event?.id ?? open.date}
          event={open.event}
          date={open.date}
          onSaved={handleSaved}
          onDeleted={() => {
            setEvents((prev) => prev.filter((e) => e.id !== open.event?.id));
            setOpen(null);
            showToast("Event deleted");
          }}
          onCancel={() => setOpen(null)}
          showToast={showToast}
        />
      )}

      <div className="fc-grid-wrap">
        <div className="fc-grid fc-grid--head" aria-hidden="true">
          {WEEKDAYS.map((day) => (
            <div key={day} className="fc-weekday">
              {day.slice(0, 3)}
            </div>
          ))}
        </div>
        <div className="fc-grid">
          {monthGrid(month).map((date) => {
            const outside = date.slice(0, 7) !== month.slice(0, 7);
            return (
              <div
                key={date}
                className={`fc-day${outside ? " fc-day--outside" : ""}${date === now ? " fc-day--today" : ""}`}
                onClick={() => setOpen({ date })}
              >
                <button
                  type="button"
                  className="fc-day-number"
                  aria-label={`Add an event on ${formatDay(date)}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen({ date });
                  }}
                >
                  {Number(date.slice(8))}
                </button>
                {holidaysOn(date).map((title) => (
                  <div key={title} className="fc-chip fc-chip--holiday" title={title}>
                    {title}
                  </div>
                ))}
                {(eventsByDate.get(date) ?? []).map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    className="fc-chip fc-chip--event"
                    title={event.title}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen({ event, date });
                    }}
                  >
                    {event.start_time && <span className="fc-chip-time">{formatTime(normalizeTime(event.start_time))} </span>}
                    {event.title}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="fc-upcoming">
        <div className="fc-subhead">Coming up</div>
        {loading ? (
          <div className="item-meta">Loading...</div>
        ) : (
          <ul className="fc-upcoming-list">
            {upcoming.map((entry) => (
              <li key={entry.holiday ? `${entry.date}-${entry.title}` : entry.event.id} className="fc-upcoming-item">
                <span className="fc-upcoming-when">{formatCountdown(entry.date, now)}</span>
                {entry.holiday ? (
                  <span className="muted">{entry.title}</span>
                ) : (
                  <button
                    type="button"
                    className="record-open"
                    onClick={() => setOpen({ event: entry.event, date: entry.date })}
                  >
                    {entry.title}
                  </button>
                )}
                <span className="item-meta fc-upcoming-date">
                  {formatDate(entry.date)}
                  {!entry.holiday && entry.event.start_time
                    ? ` · ${formatTime(normalizeTime(entry.event.start_time))}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
};

export default CalendarEvents;

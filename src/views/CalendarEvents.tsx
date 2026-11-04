"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import api from "../api/client";
import type { CalendarEvent, CalendarEventInput, Item } from "../api/client";
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
  statusForSchedule,
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

// A task's booking lives on the task, so this edits the task itself.
const TaskBookingForm = ({
  task,
  onChanged,
  onClose,
  showToast,
}: {
  task: Item;
  onChanged: (updated: Item, message: string) => void;
  onClose: () => void;
  showToast: ShowToast;
}) => {
  const [date, setDate] = useState(task.scheduled_on ?? "");
  const [time, setTime] = useState(task.scheduled_time ? normalizeTime(task.scheduled_time) : "");
  const [saving, setSaving] = useState(false);

  const update = async (change: Parameters<typeof api.items.update>[1], message: string) => {
    setSaving(true);
    try {
      onChanged(await api.items.update(task.id, change), message);
    } catch (err) {
      showToast(getErrorMessage(err), "error");
      setSaving(false);
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    update({ scheduled_on: date, scheduled_time: time || null }, "Task rescheduled");
  };

  return (
    <form className="record-form" onSubmit={handleSubmit}>
      <div className="record-field record-field--wide">
        <span className="record-label">Task</span>
        <span className={`item-title${task.done ? " item-title--done" : ""}`}>{task.title}</span>
      </div>
      <Field label="Date">
        <input className="input" type="date" required autoFocus value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="Time (optional)">
        <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </Field>
      <div className="record-actions">
        <button className="btn" type="submit" disabled={saving}>
          Save
        </button>
        <button type="button" className="btn-link" onClick={onClose}>
          cancel
        </button>
        <Link className="fc-task-link" href={`/${task.category}#task-${task.id}`}>
          open task
        </Link>
        <button
          type="button"
          className="btn-link record-delete"
          disabled={saving}
          onClick={() =>
            update({ done: !task.done }, task.done ? "Task reopened" : "Task marked done")
          }
        >
          {task.done ? "reopen task" : "mark done"}
        </button>
        <button
          type="button"
          className="btn-link"
          disabled={saving}
          onClick={() =>
            update(
              { scheduled_on: null, scheduled_time: null, status: statusForSchedule(task, null) },
              "Taken off the calendar"
            )
          }
        >
          take off calendar
        </button>
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
  const [tasks, setTasks] = useState<Item[]>([]);
  const [openTask, setOpenTask] = useState<Item | null>(null);

  useEffect(() => {
    Promise.all([api.calendar.events.getAll(), api.items.getAll()])
      .then(([loadedEvents, items]) => {
        setEvents(loadedEvents);
        setTasks(items);
      })
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

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const task of tasks) {
      if (task.scheduled_on) map.set(task.scheduled_on, [...(map.get(task.scheduled_on) ?? []), task]);
    }
    map.forEach((list) =>
      list.sort((a, b) => (a.scheduled_time ?? "").localeCompare(b.scheduled_time ?? ""))
    );
    return map;
  }, [tasks]);

  const openEventForm = (form: OpenForm) => {
    setOpenTask(null);
    setOpen(form);
  };

  const upcoming = useMemo(() => {
    const end = addDays(now, UPCOMING_DAYS);
    const years = [Number(now.slice(0, 4)), Number(end.slice(0, 4))];
    const holidays = [...new Set(years)]
      .flatMap(holidaysInYear)
      .map((h) => ({ kind: "holiday" as const, date: h.date, title: h.title }));
    const own = events.map((event) => ({
      kind: "event" as const,
      date: event.event_on,
      title: event.title,
      event,
    }));
    const booked = tasks
      .filter((task) => task.scheduled_on && !task.done)
      .map((task) => ({ kind: "task" as const, date: task.scheduled_on as string, title: task.title, task }));
    return [...own, ...booked, ...holidays]
      .filter((entry) => entry.date >= now && entry.date <= end)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, UPCOMING_LIMIT);
  }, [events, tasks, now]);

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
        <button className="btn" type="button" onClick={() => openEventForm({ date: now })}>
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

      {openTask && (
        <TaskBookingForm
          key={openTask.id}
          task={openTask}
          onChanged={(updated, message) => {
            setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
            if (updated.scheduled_on) setMonth(startOfMonth(updated.scheduled_on));
            setOpenTask(null);
            showToast(message);
          }}
          onClose={() => setOpenTask(null)}
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
                onClick={() => openEventForm({ date })}
              >
                <button
                  type="button"
                  className="fc-day-number"
                  aria-label={`Add an event on ${formatDay(date)}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    openEventForm({ date });
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
                      openEventForm({ event, date });
                    }}
                  >
                    {event.start_time && <span className="fc-chip-time">{formatTime(normalizeTime(event.start_time))} </span>}
                    {event.title}
                  </button>
                ))}
                {(tasksByDate.get(date) ?? []).map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    className={`fc-chip fc-chip--task${task.done ? " fc-chip--done" : ""}`}
                    title={`Task: ${task.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(null);
                      setOpenTask(task);
                    }}
                  >
                    {task.scheduled_time && (
                      <span className="fc-chip-time">{formatTime(normalizeTime(task.scheduled_time))} </span>
                    )}
                    {task.title}
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
              <li key={`${entry.kind}-${entry.date}-${entry.title}`} className="fc-upcoming-item">
                <span className="fc-upcoming-when">{formatCountdown(entry.date, now)}</span>
                {entry.kind === "holiday" ? (
                  <span className="muted">{entry.title}</span>
                ) : (
                  <button
                    type="button"
                    className="record-open"
                    onClick={() => {
                      if (entry.kind === "event") {
                        openEventForm({ event: entry.event, date: entry.date });
                      } else {
                        setOpen(null);
                        setOpenTask(entry.task);
                      }
                    }}
                  >
                    {entry.title}
                    {entry.kind === "task" && <span className="fc-upcoming-tag">task</span>}
                  </button>
                )}
                <span className="item-meta fc-upcoming-date">
                  {formatDate(entry.date)}
                  {entry.kind === "event" && entry.event.start_time
                    ? ` · ${formatTime(normalizeTime(entry.event.start_time))}`
                    : ""}
                  {entry.kind === "task" && entry.task.scheduled_time
                    ? ` · ${formatTime(normalizeTime(entry.task.scheduled_time))}`
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

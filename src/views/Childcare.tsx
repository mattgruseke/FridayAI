"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import api from "../api/client";
import type {
  ChildcareBlock,
  ChildcareOverride,
  ChildcarePerson,
  ChildcareSchedule,
  ChildcareScheduleInput,
} from "../api/client";
import {
  addDays,
  addMonthsToMonth,
  blocksProblem,
  datesInMonth,
  DEFAULT_COVERAGE,
  formatDay,
  formatHours,
  formatMonth,
  formatTime,
  fromMinutes,
  gapMinutes,
  gapsIn,
  inkFor,
  minutesByPerson,
  monthGrid,
  nextPersonColor,
  normalizeTime,
  PERSON_COLORS,
  planFor,
  scheduleOn,
  startOfMonth,
  startOfWeek,
  SUGGESTED_PEOPLE,
  toMinutes,
  WEEK_ORDER,
  weekdayOf,
  WEEKDAYS,
} from "../config/familyCalendar";
import type { DayPlan } from "../config/familyCalendar";
import { formatDate, today } from "../config/homeRecords";
import { getErrorMessage } from "../lib/errors";
import { Field } from "./HomeRecordFields";
import type { ShowToast } from "./HomeRecordFields";

const MINUTES_PER_HOUR = 60;

const clockLabel = (minutes: number) => {
  const hour = Math.floor(minutes / MINUTES_PER_HOUR);
  return `${hour % 12 || 12}${hour < 12 ? "a" : "p"}`;
};

const rangeLabel = (start: number, end: number) =>
  `${formatTime(fromMinutes(start))}–${formatTime(fromMinutes(end))}`;

// ─── Editing time blocks ───────────────────────────────────────────────────

const BlockRows = ({
  blocks,
  people,
  dayLabel,
  defaultStart,
  defaultEnd,
  onChange,
}: {
  blocks: ChildcareBlock[];
  people: ChildcarePerson[];
  dayLabel: string;
  defaultStart: string;
  defaultEnd: string;
  onChange: (blocks: ChildcareBlock[]) => void;
}) => {
  const update = (index: number, change: Partial<ChildcareBlock>) =>
    onChange(blocks.map((b, i) => (i === index ? { ...b, ...change } : b)));

  const addBlock = () => {
    const start = blocks.at(-1)?.end ?? defaultStart;
    const end = start < defaultEnd ? defaultEnd : "23:59";
    onChange([...blocks, { person_id: "", start, end }]);
  };

  return (
    <>
      {blocks.map((block, index) => (
        <div key={index} className="fc-block-row">
          <select
            className="input"
            aria-label={`${dayLabel}: who's covering block ${index + 1}`}
            value={block.person_id}
            onChange={(e) => update(index, { person_id: e.target.value })}
          >
            <option value="">Who?</option>
            {people
              .filter((p) => !p.archived || p.id === block.person_id)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
          <input
            className="input"
            type="time"
            aria-label={`${dayLabel}: block ${index + 1} start`}
            value={block.start}
            onChange={(e) => update(index, { start: e.target.value })}
          />
          <span className="muted">to</span>
          <input
            className="input"
            type="time"
            aria-label={`${dayLabel}: block ${index + 1} end`}
            value={block.end}
            onChange={(e) => update(index, { end: e.target.value })}
          />
          <button
            type="button"
            className="btn-link btn-link--danger"
            aria-label={`${dayLabel}: remove block ${index + 1}`}
            onClick={() => onChange(blocks.filter((_, i) => i !== index))}
          >
            remove
          </button>
        </div>
      ))}
      <button type="button" className="btn-link fc-add-block" onClick={addBlock}>
        + add time block
      </button>
    </>
  );
};

const WeekEditor = ({
  schedule,
  people,
  isFirst,
  schedules,
  onSaved,
  onCancel,
  showToast,
}: {
  schedule: ChildcareSchedule | null;
  people: ChildcarePerson[];
  isFirst: boolean;
  schedules: ChildcareSchedule[];
  onSaved: (saved: ChildcareSchedule) => void;
  onCancel: () => void;
  showToast: ShowToast;
}) => {
  const now = today();
  const [days, setDays] = useState<ChildcareBlock[][]>(() =>
    WEEKDAYS.map((_, weekday) =>
      (schedule?.blocks ?? [])
        .filter((b) => b.weekday === weekday)
        .sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
        .map(({ person_id, start, end }) => ({ person_id, start, end }))
    )
  );
  const [coverageStart, setCoverageStart] = useState(
    schedule ? normalizeTime(schedule.coverage_start) : DEFAULT_COVERAGE.start
  );
  const [coverageEnd, setCoverageEnd] = useState(
    schedule ? normalizeTime(schedule.coverage_end) : DEFAULT_COVERAGE.end
  );
  const [coverageDays, setCoverageDays] = useState(schedule?.coverage_days ?? DEFAULT_COVERAGE.days);
  // A first schedule covers this whole week; a change starts today, so past days
  // keep what really happened.
  const [effectiveFrom, setEffectiveFrom] = useState(isFirst ? startOfWeek(now) : now);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    for (const [weekday, blocks] of days.entries()) {
      const problem = blocksProblem(blocks);
      if (problem) {
        showToast(`${WEEKDAYS[weekday]}: ${problem}`, "error");
        return;
      }
    }
    if (coverageStart >= coverageEnd) {
      showToast("Coverage hours have to end after they start", "error");
      return;
    }
    const input: ChildcareScheduleInput = {
      effective_from: effectiveFrom,
      coverage_start: coverageStart,
      coverage_end: coverageEnd,
      coverage_days: coverageDays,
      blocks: days.flatMap((blocks, weekday) => blocks.map((b) => ({ ...b, weekday }))),
    };
    const sameDate = schedules.find((s) => s.effective_from === effectiveFrom);
    setSaving(true);
    try {
      onSaved(
        sameDate
          ? await api.calendar.schedules.update(sameDate.id, input)
          : await api.calendar.schedules.create(input)
      );
    } catch (err) {
      showToast(getErrorMessage(err), "error");
      setSaving(false);
    }
  };

  return (
    <form className="fc-editor" onSubmit={handleSubmit}>
      <div className="fc-subhead">Normal week</div>
      {WEEK_ORDER.map((weekday) => (
        <div key={weekday} className="fc-editor-day">
          <div className="fc-editor-day-head">
            <span className="record-label">{WEEKDAYS[weekday]}</span>
            {weekday === 1 && days[1].length > 0 && (
              <button
                type="button"
                className="btn-link"
                onClick={() =>
                  setDays((prev) => prev.map((blocks, d) => (d >= 2 && d <= 5 ? prev[1].map((b) => ({ ...b })) : blocks)))
                }
              >
                copy to Tue–Fri
              </button>
            )}
          </div>
          <BlockRows
            blocks={days[weekday]}
            people={people}
            dayLabel={WEEKDAYS[weekday]}
            defaultStart={coverageStart}
            defaultEnd={coverageEnd}
            onChange={(blocks) => setDays((prev) => prev.map((b, d) => (d === weekday ? blocks : b)))}
          />
        </div>
      ))}

      <div className="fc-subhead">Hours that need coverage</div>
      <p className="item-meta fc-help">
        Uncovered time in these hours shows up as a gap. Evenings and other days won&apos;t.
      </p>
      <div className="fc-coverage">
        <Field label="From">
          <input className="input" type="time" required value={coverageStart} onChange={(e) => setCoverageStart(e.target.value)} />
        </Field>
        <Field label="To">
          <input className="input" type="time" required value={coverageEnd} onChange={(e) => setCoverageEnd(e.target.value)} />
        </Field>
      </div>
      <div className="fc-coverage-days" role="group" aria-label="Days that need coverage">
        {WEEK_ORDER.map((weekday) => (
          <label key={weekday} className="fc-check">
            <input
              type="checkbox"
              checked={coverageDays.includes(weekday)}
              onChange={(e) =>
                setCoverageDays((prev) =>
                  e.target.checked ? [...prev, weekday].sort() : prev.filter((d) => d !== weekday)
                )
              }
            />
            {WEEKDAYS[weekday].slice(0, 3)}
          </label>
        ))}
      </div>

      <div className="fc-subhead">Applies from</div>
      <p className="item-meta fc-help">Days before this date keep the schedule they had, so your totals stay accurate.</p>
      <div className="fc-coverage">
        <Field label="Start date">
          <input className="input" type="date" required value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
        </Field>
      </div>

      <div className="record-actions">
        <button className="btn" type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save normal week"}
        </button>
        <button type="button" className="btn-link" onClick={onCancel}>
          cancel
        </button>
      </div>
    </form>
  );
};

const DayEditor = ({
  date,
  plan,
  people,
  onSaved,
  onCleared,
  onCancel,
  showToast,
}: {
  date: string;
  plan: DayPlan;
  people: ChildcarePerson[];
  onSaved: (saved: ChildcareOverride) => void;
  onCleared: () => void;
  onCancel: () => void;
  showToast: ShowToast;
}) => {
  const [blocks, setBlocks] = useState(plan.blocks);
  const [note, setNote] = useState(plan.override?.note ?? "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const problem = blocksProblem(blocks);
    if (problem) {
      showToast(problem, "error");
      return;
    }
    const input = { on_date: date, blocks, note: note || null };
    setSaving(true);
    try {
      onSaved(
        plan.override
          ? await api.calendar.overrides.update(plan.override.id, input)
          : await api.calendar.overrides.create(input)
      );
    } catch (err) {
      showToast(getErrorMessage(err), "error");
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!plan.override) return;
    try {
      await api.calendar.overrides.delete(plan.override.id);
      onCleared();
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    }
  };

  return (
    <form className="fc-editor" onSubmit={handleSubmit}>
      <div className="fc-subhead">{formatDay(date)}</div>
      <p className="item-meta fc-help">Changes here only affect this day.</p>
      <div className="fc-editor-day">
        <BlockRows
          blocks={blocks}
          people={people}
          dayLabel={formatDay(date)}
          defaultStart={plan.coverage ? fromMinutes(plan.coverage.start) : DEFAULT_COVERAGE.start}
          defaultEnd={plan.coverage ? fromMinutes(plan.coverage.end) : DEFAULT_COVERAGE.end}
          onChange={setBlocks}
        />
      </div>
      <Field label="Note">
        <input
          className="input"
          type="text"
          maxLength={500}
          value={note}
          placeholder="Nanny out sick, Grandma visiting..."
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      <div className="record-actions">
        <button className="btn" type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save this day"}
        </button>
        <button type="button" className="btn-link" onClick={onCancel}>
          cancel
        </button>
        {plan.override && (
          <button type="button" className="btn-link record-delete" onClick={handleClear}>
            back to normal week
          </button>
        )}
      </div>
    </form>
  );
};

const PeoplePanel = ({
  people,
  onChanged,
  onClose,
  showToast,
}: {
  people: ChildcarePerson[];
  onChanged: (person: ChildcarePerson) => void;
  onClose: () => void;
  showToast: ShowToast;
}) => {
  const [name, setName] = useState("");
  const active = people.filter((p) => !p.archived);

  const add = async (newName: string) => {
    try {
      onChanged(
        await api.calendar.people.create({ name: newName, color: nextPersonColor(people), archived: false })
      );
      setName("");
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    }
  };

  const update = async (person: ChildcarePerson, change: Partial<ChildcarePerson>) => {
    try {
      const { name: n, color, archived } = { ...person, ...change };
      onChanged(await api.calendar.people.update(person.id, { name: n, color, archived }));
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    }
  };

  const suggestions = SUGGESTED_PEOPLE.filter(
    (s) => !active.some((p) => p.name.toLowerCase() === s.toLowerCase())
  );

  return (
    <div className="fc-editor">
      <div className="fc-subhead">Who looks after him</div>
      {active.map((person) => (
        <div key={person.id} className="fc-person-row">
          <input
            key={person.name}
            className="input"
            type="text"
            maxLength={80}
            aria-label={`Rename ${person.name}`}
            defaultValue={person.name}
            onBlur={(e) => {
              const value = e.target.value.trim();
              if (value && value !== person.name) update(person, { name: value });
              else e.target.value = person.name;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
          <div className="fc-swatches" role="group" aria-label={`Color for ${person.name}`}>
            {PERSON_COLORS.map((c) => (
              <button
                key={c.hex}
                type="button"
                className={`fc-swatch${person.color === c.hex ? " fc-swatch--on" : ""}`}
                style={{ background: c.hex }}
                aria-label={`Color ${c.hex}`}
                aria-pressed={person.color === c.hex}
                onClick={() => update(person, { color: c.hex })}
              />
            ))}
          </div>
          <button
            type="button"
            className="btn-link btn-link--danger"
            aria-label={`Remove ${person.name}`}
            onClick={() => update(person, { archived: true })}
          >
            remove
          </button>
        </div>
      ))}
      <form
        className="fc-person-add"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) add(name.trim());
        }}
      >
        <input
          className="input"
          type="text"
          maxLength={80}
          value={name}
          placeholder="Add a person or place..."
          aria-label="New person"
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn" type="submit" disabled={!name.trim()}>
          Add
        </button>
      </form>
      {suggestions.length > 0 && (
        <div className="fc-person-suggestions">
          {suggestions.map((s) => (
            <button key={s} type="button" className="record-chip" onClick={() => add(s)}>
              + {s}
            </button>
          ))}
        </div>
      )}
      <p className="item-meta fc-help">Removing someone keeps them on past days, but they won&apos;t be offered for new ones.</p>
      <div className="record-actions">
        <button type="button" className="record-secondary" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
};

// ─── Displaying the schedule ───────────────────────────────────────────────

type Mode = "week" | "month";
type Panel = "people" | "normal" | { date: string } | null;

// initialDate opens straight into editing that day.
const Childcare = ({ showToast, initialDate }: { showToast: ShowToast; initialDate?: string }) => {
  const now = today();
  const [people, setPeople] = useState<ChildcarePerson[]>([]);
  const [schedules, setSchedules] = useState<ChildcareSchedule[]>([]);
  const [overrides, setOverrides] = useState<ChildcareOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("week");
  const [anchor, setAnchor] = useState(initialDate ?? now);
  const [panel, setPanel] = useState<Panel>(initialDate ? { date: initialDate } : null);

  useEffect(() => {
    Promise.all([api.calendar.people.getAll(), api.calendar.schedules.getAll(), api.calendar.overrides.getAll()])
      .then(([loadedPeople, loadedSchedules, loadedOverrides]) => {
        setPeople(loadedPeople);
        setSchedules(loadedSchedules);
        setOverrides(loadedOverrides);
        if (loadedPeople.length === 0) setPanel("people");
      })
      .catch((err) => showToast(getErrorMessage(err), "error"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const personById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  const periodDates = useMemo(() => {
    if (mode === "month") return datesInMonth(startOfMonth(anchor));
    const start = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [mode, anchor]);

  const plans = useMemo(
    () => new Map(periodDates.map((date) => [date, planFor(date, schedules, overrides)])),
    [periodDates, schedules, overrides]
  );

  const planOf = (date: string) => plans.get(date) ?? planFor(date, schedules, overrides);

  const totals = useMemo(() => {
    const dayPlans = [...plans.values()];
    return {
      people: [...minutesByPerson(dayPlans).entries()].sort((a, b) => b[1] - a[1]),
      gaps: dayPlans.reduce((sum, plan) => sum + gapMinutes(gapsIn(plan)), 0),
    };
  }, [plans]);

  // The hours shown across the week, wide enough for everything in it.
  const axis = useMemo(() => {
    const dayPlans = [...plans.values()];
    const starts = dayPlans.flatMap((p) => [...p.blocks.map((b) => toMinutes(b.start)), ...(p.coverage ? [p.coverage.start] : [])]);
    const ends = dayPlans.flatMap((p) => [...p.blocks.map((b) => toMinutes(b.end)), ...(p.coverage ? [p.coverage.end] : [])]);
    const start = starts.length ? Math.floor(Math.min(...starts) / 60) * 60 : 7 * 60;
    const end = ends.length ? Math.ceil(Math.max(...ends) / 60) * 60 : 18 * 60;
    return { start, end, span: Math.max(end - start, 60) };
  }, [plans]);

  const periodLabel =
    mode === "month"
      ? formatMonth(startOfMonth(anchor))
      : `${formatDate(periodDates[0])} – ${formatDate(periodDates[6])}`;

  const move = (direction: number) =>
    setAnchor((a) => (mode === "month" ? addMonthsToMonth(startOfMonth(a), direction) : addDays(a, direction * 7)));

  const nameOf = (id: string) => personById.get(id)?.name ?? "Unknown";
  const colorOf = (id: string) => personById.get(id)?.color ?? "#64748B";

  const openDay = (date: string) => setPanel({ date });

  const segmentsFor = (plan: DayPlan) =>
    [
      ...plan.blocks.map((b) => ({
        kind: "block" as const,
        start: toMinutes(b.start),
        end: toMinutes(b.end),
        person: b.person_id,
      })),
      ...gapsIn(plan).map((g) => ({ kind: "gap" as const, start: g.start, end: g.end, person: "" })),
    ].sort((a, b) => a.start - b.start);

  const hasSchedule = schedules.length > 0;

  return (
    <>
      <div className="fc-toolbar">
        <div className="fc-nav">
          <button type="button" className="record-secondary fc-arrow" aria-label={`Previous ${mode}`} onClick={() => move(-1)}>
            ‹
          </button>
          <button type="button" className="record-secondary fc-arrow" aria-label={`Next ${mode}`} onClick={() => move(1)}>
            ›
          </button>
          <button type="button" className="record-secondary" onClick={() => setAnchor(now)}>
            Today
          </button>
          <span className="fc-title">{periodLabel}</span>
        </div>
        <div className="fc-nav">
          <div className="view-toggle" role="group" aria-label="Childcare range">
            {(["week", "month"] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={mode === m ? "view-toggle--active" : undefined}
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
              >
                {m}
              </button>
            ))}
          </div>
          <button type="button" className="record-secondary" onClick={() => setPanel("people")}>
            People
          </button>
          <button
            type="button"
            className="record-secondary"
            disabled={people.every((p) => p.archived)}
            onClick={() => setPanel("normal")}
          >
            Edit normal week
          </button>
        </div>
      </div>

      {panel === "people" && (
        <PeoplePanel
          people={people}
          onChanged={(person) =>
            setPeople((prev) =>
              prev.some((p) => p.id === person.id) ? prev.map((p) => (p.id === person.id ? person : p)) : [...prev, person]
            )
          }
          onClose={() => setPanel(null)}
          showToast={showToast}
        />
      )}

      {panel === "normal" && (
        <WeekEditor
          schedule={scheduleOn(now, schedules) ?? schedules.at(-1) ?? null}
          schedules={schedules}
          isFirst={!hasSchedule}
          people={people}
          onSaved={(saved) => {
            setSchedules((prev) =>
              prev.some((s) => s.id === saved.id) ? prev.map((s) => (s.id === saved.id ? saved : s)) : [...prev, saved]
            );
            setPanel(null);
            showToast("Normal week saved");
          }}
          onCancel={() => setPanel(null)}
          showToast={showToast}
        />
      )}

      {!loading && typeof panel === "object" && panel !== null && (
        <DayEditor
          key={panel.date}
          date={panel.date}
          plan={planOf(panel.date)}
          people={people}
          onSaved={(saved) => {
            setOverrides((prev) =>
              prev.some((o) => o.id === saved.id) ? prev.map((o) => (o.id === saved.id ? saved : o)) : [...prev, saved]
            );
            setPanel(null);
            showToast("Day saved");
          }}
          onCleared={() => {
            setOverrides((prev) => prev.filter((o) => o.on_date !== panel.date));
            setPanel(null);
            showToast("Back to the normal week");
          }}
          onCancel={() => setPanel(null)}
          showToast={showToast}
        />
      )}

      {loading ? (
        <div className="list-item">
          <div className="item-meta">Loading...</div>
        </div>
      ) : (
        <>
          {!hasSchedule && overrides.length === 0 && panel === null && (
            <div className="list-item">
              <div className="item-content">
                <div className="item-title muted">No childcare schedule yet</div>
                <div className="item-meta">
                  Add who looks after him under People, then set up a typical week with Edit normal week.
                </div>
              </div>
            </div>
          )}

          <div className="fc-totals" aria-label="Hours for this period">
            {totals.people.map(([id, minutes]) => (
              <div key={id} className="fc-total">
                <span className="fc-swatch fc-swatch--small" style={{ background: colorOf(id) }} aria-hidden="true" />
                <span className="fc-total-name">{nameOf(id)}</span>
                <span className="fc-total-value">{formatHours(minutes)}</span>
              </div>
            ))}
            {totals.gaps > 0 && (
              <div className="fc-total fc-total--gap">
                <span className="fc-total-name">Gaps</span>
                <span className="fc-total-value">{formatHours(totals.gaps)}</span>
              </div>
            )}
          </div>

          {mode === "week" ? (
            <div className="fc-week">
              <div className="fc-week-axis" aria-hidden="true">
                {Array.from({ length: Math.floor(axis.span / 60) + 1 }, (_, i) => axis.start + i * 60)
                  .filter((_, i, all) => all.length <= 8 || i % 2 === 0)
                  .map((m) => (
                    <span key={m} style={{ left: `${((m - axis.start) / axis.span) * 100}%` }}>
                      {clockLabel(m)}
                    </span>
                  ))}
              </div>
              {periodDates.map((date) => {
                const plan = planOf(date);
                const gaps = gapsIn(plan);
                const dayTotals = [...minutesByPerson([plan]).entries()].sort((a, b) => b[1] - a[1]);
                return (
                  <div key={date} className={`fc-week-day${date === now ? " fc-week-day--today" : ""}`}>
                    <button
                      type="button"
                      className="fc-week-label"
                      aria-label={`Edit ${formatDay(date)}`}
                      onClick={() => openDay(date)}
                    >
                      <span className="fc-week-name">{WEEKDAYS[weekdayOf(date)].slice(0, 3)}</span>
                      <span className="fc-week-date">{Number(date.slice(8))}</span>
                    </button>
                    <div className="fc-week-main">
                      <div className="fc-bar">
                        {segmentsFor(plan).map((seg) => {
                          const left = ((seg.start - axis.start) / axis.span) * 100;
                          const width = ((seg.end - seg.start) / axis.span) * 100;
                          const label =
                            seg.kind === "gap"
                              ? `Gap, ${rangeLabel(seg.start, seg.end)}`
                              : `${nameOf(seg.person)}, ${rangeLabel(seg.start, seg.end)}`;
                          return (
                            <div
                              key={`${seg.kind}-${seg.start}`}
                              className={`fc-seg${seg.kind === "gap" ? " fc-seg--gap" : ""}`}
                              style={{
                                left: `${left}%`,
                                width: `${width}%`,
                                ...(seg.kind === "block"
                                  ? { background: colorOf(seg.person), color: inkFor(colorOf(seg.person)) }
                                  : {}),
                              }}
                              title={label}
                            >
                              <span className="fc-seg-text">{seg.kind === "gap" ? "Gap" : nameOf(seg.person)}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="item-meta fc-day-summary">
                        {dayTotals.map(([id, minutes]) => `${nameOf(id)} ${formatHours(minutes)}`).join(" · ")}
                        {gaps.length > 0 && (
                          <span className="fc-gap-text">
                            {dayTotals.length > 0 ? " · " : ""}
                            {gaps.map((g) => `Gap ${rangeLabel(g.start, g.end)}`).join(", ")}
                          </span>
                        )}
                        {plan.override && (
                          <span className="fc-changed">
                            {" "}
                            · Changed{plan.override.note ? `: ${plan.override.note}` : " this day"}
                          </span>
                        )}
                        {dayTotals.length === 0 && gaps.length === 0 && !plan.override && (
                          <span className="muted">Nothing scheduled</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="fc-grid-wrap">
              <div className="fc-grid fc-grid--head" aria-hidden="true">
                {WEEK_ORDER.map((weekday) => (
                  <div key={weekday} className="fc-weekday">
                    {WEEKDAYS[weekday].slice(0, 3)}
                  </div>
                ))}
              </div>
              <div className="fc-grid">
                {monthGrid(startOfMonth(anchor)).map((date) => {
                  const outside = date.slice(0, 7) !== anchor.slice(0, 7);
                  const plan = planOf(date);
                  const gap = gapMinutes(gapsIn(plan));
                  const segments = segmentsFor(plan);
                  return (
                    <button
                      key={date}
                      type="button"
                      className={`fc-day fc-day--care${outside ? " fc-day--outside" : ""}${date === now ? " fc-day--today" : ""}`}
                      aria-label={`Edit ${formatDay(date)}`}
                      onClick={() => openDay(date)}
                    >
                      <span className="fc-day-number">{Number(date.slice(8))}</span>
                      {segments.length > 0 && (
                        <span className="fc-mini-bar" aria-hidden="true">
                          {segments.map((seg) => (
                            <span
                              key={`${seg.kind}-${seg.start}`}
                              className={seg.kind === "gap" ? "fc-seg--gap" : undefined}
                              style={{
                                flexGrow: seg.end - seg.start,
                                ...(seg.kind === "block" ? { background: colorOf(seg.person) } : {}),
                              }}
                              title={seg.kind === "gap" ? "Gap" : nameOf(seg.person)}
                            />
                          ))}
                        </span>
                      )}
                      {gap > 0 && <span className="fc-gap-text fc-gap-small">Gap {formatHours(gap)}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
};

export default Childcare;

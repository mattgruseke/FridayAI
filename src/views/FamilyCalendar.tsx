"use client";

import { useEffect, useState } from "react";
import { useToast } from "../hooks/useToast";
import CalendarEvents from "./CalendarEvents";
import Childcare from "./Childcare";
import WeeklyPlan from "./WeeklyPlan";
import "../components/Calendar.css";
import "./FamilyCalendar.css";

const VIEWS = [
  { id: "events", label: "Events" },
  { id: "childcare", label: "Childcare" },
  { id: "plan", label: "Weekly plan" },
] as const;

type View = (typeof VIEWS)[number]["id"];

// The family calendar: important events, who's looking after the kid, and the plan for the week.
const FamilyCalendar = () => {
  const [view, setView] = useState<View>("events");
  // The day to open when the weekly plan sends you to Childcare.
  const [childcareDate, setChildcareDate] = useState<string>();
  // The week to open when another page links to the weekly plan.
  const [planWeek, setPlanWeek] = useState<string>();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("view") !== "plan") return;
    const week = params.get("week");
    if (week && /^\d{4}-\d{2}-\d{2}$/.test(week)) setPlanWeek(week);
    setView("plan");
  }, []);

  const { showToast, toastElement } = useToast();

  return (
    <div className="container">
      <div className="main">
        <div className="section">
          <div className="section-header">
            <span>Calendar</span>
            <div className="view-toggle" role="group" aria-label="Calendar view">
              {VIEWS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={view === v.id ? "view-toggle--active" : undefined}
                  aria-pressed={view === v.id}
                  onClick={() => {
                    setChildcareDate(undefined);
                    setPlanWeek(undefined);
                    setView(v.id);
                  }}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          {view === "events" && <CalendarEvents showToast={showToast} />}
          {view === "childcare" && <Childcare showToast={showToast} initialDate={childcareDate} />}
          {view === "plan" && (
            <WeeklyPlan
              showToast={showToast}
              initialWeek={planWeek}
              onEditChildcare={(date) => {
                setChildcareDate(date);
                setView("childcare");
              }}
            />
          )}
        </div>
      </div>
      {toastElement}
    </div>
  );
};

export default FamilyCalendar;

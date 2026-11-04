"use client";

import { useState } from "react";
import { useToast } from "../hooks/useToast";
import CalendarEvents from "./CalendarEvents";
import Childcare from "./Childcare";
import "../components/Calendar.css";
import "./FamilyCalendar.css";

const VIEWS = [
  { id: "events", label: "Events" },
  { id: "childcare", label: "Childcare" },
] as const;

type View = (typeof VIEWS)[number]["id"];

// The family calendar: a month of important events, and who's looking after the kid.
const FamilyCalendar = () => {
  const [view, setView] = useState<View>("events");
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
                  onClick={() => setView(v.id)}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          {view === "events" ? <CalendarEvents showToast={showToast} /> : <Childcare showToast={showToast} />}
        </div>
      </div>
      {toastElement}
    </div>
  );
};

export default FamilyCalendar;

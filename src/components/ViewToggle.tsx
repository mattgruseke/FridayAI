"use client";

export type View = "list" | "calendar";

type ViewToggleProps = {
  view: View;
  onChange: (view: View) => void;
};

// List / calendar switch shown in a section header. Styles in Calendar.css.
const ViewToggle = ({ view, onChange }: ViewToggleProps) => (
  <div className="view-toggle" role="group" aria-label="View">
    {(["list", "calendar"] as const).map((v) => (
      <button
        key={v}
        className={view === v ? "view-toggle--active" : undefined}
        onClick={() => onChange(v)}
        aria-pressed={view === v}
      >
        {v}
      </button>
    ))}
  </div>
);

export default ViewToggle;

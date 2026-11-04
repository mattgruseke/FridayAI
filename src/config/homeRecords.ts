// Shared options and formatting for the Capital Improvements and Maintenance pages.

export const IMPROVEMENT_TYPES = [
  { id: "improvement", label: "Improvement" },
  { id: "appliance", label: "Appliance" },
  { id: "repair", label: "Repair" },
] as const;

export type ImprovementType = (typeof IMPROVEMENT_TYPES)[number]["id"];

export const improvementTypeLabel = (type: ImprovementType) =>
  IMPROVEMENT_TYPES.find((t) => t.id === type)?.label ?? type;

// null means there's no regular schedule.
export const MAINTENANCE_FREQUENCIES: { months: number | null; label: string }[] = [
  { months: 3, label: "Every 3 months" },
  { months: 6, label: "Every 6 months" },
  { months: 12, label: "Every year" },
  { months: 24, label: "Every 2 years" },
  { months: 36, label: "Every 3 years" },
  { months: 60, label: "Every 5 years" },
  { months: null, label: "As needed" },
];

export const frequencyLabel = (months: number | null) =>
  MAINTENANCE_FREQUENCIES.find((f) => f.months === months)?.label ?? `Every ${months} months`;

export const SUGGESTED_MAINTENANCE: { title: string; interval_months: number }[] = [
  { title: "HVAC service", interval_months: 6 },
  { title: "Gutter cleaning", interval_months: 6 },
  { title: "Sump pump check", interval_months: 12 },
  { title: "Chimney sweep", interval_months: 12 },
  { title: "Oil tank service", interval_months: 12 },
  { title: "Dryer vent cleaning", interval_months: 12 },
];

export const RECEIPT_ACCEPT = "application/pdf,image/jpeg,image/png,image/heic";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export const formatMoney = (amount: number | null) => (amount == null ? "—" : money.format(amount));

// Reads what people type in a cost field ("$18,000.50"). Blank is null; anything
// unreadable is undefined.
export const parseCost = (text: string): number | null | undefined => {
  const cleaned = text.replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  const amount = Number(cleaned);
  return Number.isFinite(amount) && amount >= 0 && amount < 1e10 ? amount : undefined;
};

// Dates are plain YYYY-MM-DD strings, so they never shift with the time zone.
export const toDateString = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const fromDateString = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
};

export const today = () => toDateString(new Date());

export const formatDate = (date: string | null) =>
  date
    ? fromDateString(date).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

// Adds months, landing on the last day of the month when needed (Aug 31 → Feb 28).
export const addMonths = (date: string, months: number) => {
  const start = fromDateString(date);
  const target = new Date(start.getFullYear(), start.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(start.getDate(), lastDay));
  return toDateString(target);
};

export type DueState = "overdue" | "soon" | "ok";

export const dueState = (nextDue: string, now = today()): DueState => {
  if (nextDue < now) return "overdue";
  const soon = fromDateString(now);
  soon.setDate(soon.getDate() + 30);
  return nextDue <= toDateString(soon) ? "soon" : "ok";
};

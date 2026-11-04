// Home Manager intake questions (see 01_home_manager.md, Parts 3, 4 and 6).
// Used by the intake form (src/views/Intake.tsx) and the profile page.

export const HOME_MANAGER_AGENT = "home_manager";

// One input within a multi-input question (e.g. the parts of an address).
// Each part is saved as its own answer field.
export type QuestionPart = {
  field: string;
  label: string;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: "text" | "numeric";
};

export type Question = {
  field: string;
  short: string; // label used when listing answers (e.g. on the profile page)
  label: string;
  hint?: string;
  type: "text" | "textarea" | "date" | "select" | "address";
  options?: string[];
  parts?: QuestionPart[]; // "address" only; all parts are required to count as answered
  placeholder?: string;
  weight?: number; // Tier B only: findings unlocked, 1–5
  inInspection?: boolean; // a home inspection report usually answers this; skipped once one is uploaded
};

const filled = (v: string | undefined) => !!v && v.trim() !== "";

// Inspection report upload. The file's name and storage path are kept in the
// intake answers under these fields (see /api/intake/report).
export const INSPECTION_REPORT_FIELD = "inspection_report"; // "Yes" | "No"
export const INSPECTION_REPORT_NAME = "inspection_report_name";
export const INSPECTION_REPORT_PATH = "inspection_report_path";

export const hasInspectionReport = (answers: Record<string, string> | undefined) =>
  filled(answers?.[INSPECTION_REPORT_PATH]);

// Answered directly, or covered by an uploaded inspection report.
export const isCovered = (q: Question, answers: Record<string, string> | undefined) =>
  isAnswered(q, answers) || (!!q.inInspection && hasInspectionReport(answers));

// Whether a question has an answer. Multi-part questions need every part.
export const isAnswered = (q: Question, answers: Record<string, string> | undefined) =>
  q.parts ? q.parts.every((p) => filled(answers?.[p.field])) : filled(answers?.[q.field]);

// An answer as display text (e.g. "123 Main St, Darien, CT 06820").
export const formatAnswer = (q: Question, answers: Record<string, string>) => {
  if (q.type === "address") {
    const [street, city, state, zip] = q.parts!.map((p) => answers[p.field]?.trim() ?? "");
    return [street, city, [state, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  }
  const value = answers[q.field];
  return q.type === "date" ? new Date(`${value}T00:00:00`).toLocaleDateString() : value;
};

// Tier A — all required before the agent is Active.
export const TIER_A: Question[] = [
  {
    field: "address",
    short: "Address",
    label: "What's the address?",
    hint: "I can pull year built, square footage, and lot size from public records, so this saves you five questions.",
    type: "address",
    parts: [
      { field: "address_street", label: "Street address", placeholder: "123 Main St", autoComplete: "street-address" },
      { field: "address_city", label: "City", placeholder: "Darien", autoComplete: "address-level2" },
      { field: "address_state", label: "State", placeholder: "CT", autoComplete: "address-level1" },
      { field: "address_zip", label: "ZIP", placeholder: "06820", autoComplete: "postal-code", inputMode: "numeric" },
    ],
  },
  {
    field: "own_or_rent",
    short: "Own or rent",
    label: "Do you own it or rent?",
    type: "select",
    options: ["Own", "Rent"],
  },
  {
    field: "home_type",
    short: "Home type",
    label: "What kind of home is it?",
    hint: "Determines what's actually your responsibility versus a landlord's or association's.",
    type: "select",
    options: ["Single-family", "Condo", "Townhouse", "Multi-family", "Other"],
  },
  {
    field: "move_in_date",
    short: "Moved in",
    label: "When did you move in?",
    hint: "If it's recent, your inspection report is probably the single most useful document you own, and most people never look at it again.",
    type: "date",
  },
  {
    field: "heating_fuel",
    short: "Heating fuel",
    label: "How is the house heated?",
    hint: "This one branches a lot. Oil means tank monitoring, gas means CO detectors near appliances, electric changes the whole cost picture.",
    type: "select",
    options: ["Gas", "Oil", "Electric", "Propane", "Other"],
  },
  {
    field: "known_problems",
    short: "Known problems",
    label: "Anything currently bugging you about the house?",
    hint: "Even vague. ‘The basement smells funny after rain’ is more useful to me than a full inspection report.",
    type: "textarea",
  },
];

// Tier B — optional, weighted. Ordered by findings unlocked per question.
export const TIER_B: Question[] = [
  {
    field: "electrical_panel_type_amps",
    inInspection: true,
    short: "Electrical panel",
    weight: 5,
    label: "Do you know what kind of electrical panel you have?",
    hint: "Federal Pacific, Zinsco, and Challenger panels were installed for decades and are now recognized fire hazards. The brand is usually on the panel door.",
    type: "text",
    placeholder: "Brand and amps, if you know",
  },
  {
    field: "water_heater_type_age",
    inInspection: true,
    short: "Water heater",
    weight: 5,
    label: "How old is the water heater?",
    hint: "They fail on a schedule — 8 to 12 years for a tank. Usually there's a date on the label.",
    type: "text",
  },
  {
    field: "hvac_type_age_last_service",
    short: "HVAC service",
    weight: 5,
    label: "When was the HVAC last serviced?",
    hint: "If you don't know, that's an answer — it means we start a record now. Twice a year is standard.",
    type: "text",
  },
  {
    field: "chimney_fireplace_last_swept",
    short: "Chimney swept",
    weight: 4,
    label: "Has the chimney ever been swept, that you know of?",
    hint: "Buying a house doesn't come with the previous owner's maintenance history, and a chimney fire is one of the ones you can't undo.",
    type: "text",
  },
  {
    field: "water_source",
    inInspection: true,
    short: "Water source",
    weight: 4,
    label: "City water or well?",
    type: "select",
    options: ["City water", "Well", "Not sure"],
  },
  {
    field: "sewer_type",
    inInspection: true,
    short: "Sewer",
    weight: 4,
    label: "City sewer or septic?",
    hint: "Septic needs pumping every 3–5 years. Missing it isn't a repair, it's a replacement.",
    type: "select",
    options: ["City sewer", "Septic", "Not sure"],
  },
  {
    field: "sump_pump_present_last_tested",
    inInspection: true,
    short: "Sump pump",
    weight: 4,
    label: "Is there a sump pump, and when was it last tested?",
    hint: "Basement flooding is one of the most preventable expensive problems.",
    type: "text",
  },
  {
    field: "dryer_vent_last_cleaned",
    short: "Dryer vent",
    weight: 4,
    label: "Has anyone ever cleaned the dryer vent?",
    hint: "Leading cause of house fires, almost nobody thinks about it, and it's a $150 job.",
    type: "text",
  },
  {
    field: "radon_tested_result",
    short: "Radon",
    weight: 4,
    label: "Has the house been tested for radon?",
    hint: "It's a $15 test and it's either fine or it's genuinely important.",
    type: "text",
  },
  {
    field: "roof_material_age",
    inInspection: true,
    short: "Roof",
    weight: 4,
    label: "Do you know roughly how old the roof is?",
    hint: "Asphalt shingle roofs typically run 20–30 years, and this is usually the single largest capital expense on a house.",
    type: "text",
  },
  {
    field: "insurance_carrier_renewal_deductible",
    short: "Insurance",
    weight: 4,
    label: "Who's your homeowner's insurance carrier, and do you know your renewal month and deductible?",
    hint: "You want anything claim-worthy documented before a renewal, not after.",
    type: "text",
  },
  {
    field: "basement_type",
    inInspection: true,
    short: "Basement",
    weight: 3,
    label: "Is your basement finished, unfinished, or a mix?",
    hint: "A finished basement turns water intrusion into a five-figure problem; unfinished is a nuisance.",
    type: "select",
    options: ["Finished", "Unfinished", "Partly finished", "Crawlspace", "Slab / none"],
  },
  {
    field: "smoke_co_detectors",
    inInspection: true,
    short: "Smoke / CO detectors",
    weight: 3,
    label: "How many smoke and CO detectors do you have, and roughly where?",
    hint: "Detectors have a 10-year replacement window even when they're working fine.",
    type: "text",
  },
  {
    field: "main_water_shutoff_location",
    inInspection: true,
    short: "Water shutoff",
    weight: 3,
    label: "Do you know where the main water shutoff is?",
    hint: "Sounds trivial. It's the single most valuable thing to know at 2am with a burst pipe.",
    type: "text",
  },
  {
    field: "appliance_ages",
    inInspection: true,
    short: "Appliances",
    weight: 3,
    label: "Roughly how old are the major appliances?",
    type: "text",
  },
  {
    field: "windows_age_type",
    inInspection: true,
    short: "Windows",
    weight: 2,
    label: "Do you know roughly how old your windows are, or if any have been replaced?",
    type: "text",
  },
  {
    field: "lot_trees_near_structure",
    inInspection: true,
    short: "Trees near house",
    weight: 2,
    label: "Are there any large trees close to the house or garage?",
    hint: "Storm risk and gutter load both trace back to this.",
    type: "text",
  },
  {
    field: "grading_drainage_notes",
    inInspection: true,
    short: "Drainage",
    weight: 2,
    label: "Does water tend to pool anywhere near the foundation after heavy rain?",
    hint: "Usually the root cause when a basement floods.",
    type: "text",
  },
  {
    field: "warranty_coverage",
    short: "Warranty",
    weight: 2,
    label: "Did you get a home warranty or builder warranty as part of the purchase?",
    type: "text",
  },
  {
    field: "hoa_details",
    short: "HOA",
    weight: 2,
    label: "Is there an HOA or shared association for the property?",
    type: "text",
  },
];

// Standing Provider Checklist (Part 1). Offered as categories, never asked as a question.
export const PROVIDER_CATEGORIES = [
  "HVAC / furnace",
  "Plumber",
  "Electrician",
  "Roofer",
  "Chimney sweep",
  "Landscaper / lawn care",
  "Snow removal",
  "Gutter cleaning",
  "Oil delivery",
  "Propane delivery",
  "Pest control",
  "Handyman",
  "Mason / hardscape",
  "Appliance repair",
  "Well / septic",
  "Windows / screens",
  "Other",
];

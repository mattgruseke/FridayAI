import axios from "axios";
import type { Cuisine, Occasion, Service } from "@/config/restaurants";
import type { ImprovementType } from "@/config/homeRecords";
import type { IngredientGroup, MealCuisine, MealKind, MealMethod } from "@/config/meals";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  // Include credentials (cookies) with requests
  withCredentials: true,
});

type FetchOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: string;
};

// Helper function for API calls with auth
const fetchAPI = async <T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> => {
  try {
    const response = await apiClient.request<T>({
      url: endpoint,
      method: options.method,
      headers: options.headers,
      data: options.body ? JSON.parse(options.body) : undefined,
      validateStatus: () => true,
    });

    if (response.status < 200 || response.status >= 300) {
      const message =
        (response.data as { message?: string } | undefined)?.message ||
        "API request failed";
      throw new Error(message);
    }

    if (response.status === 204) {
      return null as T;
    }

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      const message =
        (error.response.data as { message?: string } | undefined)?.message ||
        "API request failed";
      throw new Error(message);
    }
    throw error;
  }
};

type QueryParams = Record<string, string | number | boolean>;

const toQueryString = (params: QueryParams) =>
  new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, String(value)])
  ).toString();

// Items API — the sample feature. Copy this shape for your own resources.
// "none" is for tasks sorted from the Brain Dump that haven't been given an area yet.
export const ITEM_CATEGORIES = ["home", "entertainment", "food", "none"] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

// Where an open item stands. Finishing is tracked by `done`, so reopening an
// item returns it to the status it had.
export const ITEM_STATUSES = ["needs_research", "not_started", "in_progress", "scheduled"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

// Which of the four Eisenhower boxes a task is in. Null means it hasn't been sorted yet.
export const ITEM_BOXES = ["urgent_important", "important", "urgent", "backlog"] as const;
export type ItemBox = (typeof ITEM_BOXES)[number];

export type Item = {
  id: string;
  title: string;
  category: ItemCategory;
  done: boolean;
  status: ItemStatus;
  box: ItemBox | null;
  notes: string | null;
  scheduled_on: string | null; // YYYY-MM-DD; a date puts the item on the calendar
  scheduled_time: string | null; // HH:MM, null means no set time
  provider_id?: string | null; // the service provider it's assigned to; missing on older rows
  created_at: string;
  completed_at: string | null;
  sort_order: number; // lower is higher priority
};

export const itemsAPI = {
  // Omit category to get every item.
  getAll: (category?: ItemCategory) =>
    fetchAPI<Item[]>(category ? `/items?${toQueryString({ category })}` : "/items"),

  create: (title: string, category: ItemCategory, box: ItemBox | null = null) =>
    fetchAPI<Item>("/items", {
      method: "POST",
      body: JSON.stringify({ title, category, box }),
    }),

  update: (id: string, data: Partial<Pick<Item, "title" | "done" | "status" | "box" | "category" | "notes" | "scheduled_on" | "scheduled_time" | "provider_id">>) =>
    fetchAPI<Item>(`/items?id=${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // ids in their new order, highest priority first.
  reorder: (ids: string[]) =>
    fetchAPI("/items/reorder", {
      method: "PUT",
      body: JSON.stringify({ ids }),
    }),

  delete: (id: string) =>
    fetchAPI(`/items?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
};

// Intake API — answers to an agent's intake form
export type IntakeProvider = { name: string; category: string; contact: string };

export type Intake = {
  agent: string;
  answers: Record<string, string>;
  known_providers: IntakeProvider[];
  updated_at: string;
};

export const intakeAPI = {
  get: (agent: string) =>
    fetchAPI<Intake | null>(`/intake?${toQueryString({ agent })}`),

  // Multipart upload, so this bypasses fetchAPI's JSON body handling.
  uploadReport: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_URL}/intake/report`, {
      method: "POST",
      body: form,
      credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Upload failed");
    return data as { name: string; path: string };
  },

  deleteReport: (path: string) =>
    fetchAPI(`/intake/report?${toQueryString({ path })}`, { method: "DELETE" }),

  save: (agent: string, data: Pick<Intake, "answers" | "known_providers">) =>
    fetchAPI<{ ok: true; updated_at: string }>(`/intake?${toQueryString({ agent })}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};

// Restaurants API — logged places plus their visits / ratings
export type Restaurant = {
  id: string;
  name: string;
  cuisine: Cuisine;
  style: string | null;
  location: string | null;
  distance: string | null;
  price: number | null;
  occasions: Occasion[];
  services: Service[];
  tags: string[];
  note: string | null;
  usual_order: string | null;
  booking_label: string | null;
  booking_url: string | null;
  created_at: string;
  // Computed from visits by the API
  avg_rating: number | null;
  visit_count: number;
};

export type RestaurantInput = Omit<Restaurant, "id" | "created_at" | "avg_rating" | "visit_count">;

export type RestaurantVisit = {
  id: string;
  restaurant_id: string;
  visited_on: string; // YYYY-MM-DD
  rating: number | null;
  rated_by: string | null;
  note: string | null;
  created_at: string;
};

export type RestaurantVisitInput = Pick<RestaurantVisit, "visited_on" | "rating" | "rated_by" | "note">;

export type RestaurantDetail = Restaurant & { visits: RestaurantVisit[] };

export const restaurantsAPI = {
  getAll: () => fetchAPI<Restaurant[]>("/restaurants"),

  get: (id: string) =>
    fetchAPI<RestaurantDetail>(`/restaurants?${toQueryString({ id })}`),

  create: (data: RestaurantInput) =>
    fetchAPI<Restaurant>("/restaurants", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<RestaurantInput>) =>
    fetchAPI<Restaurant>(`/restaurants?${toQueryString({ id })}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchAPI(`/restaurants?${toQueryString({ id })}`, {
      method: "DELETE",
    }),

  addVisit: (restaurantId: string, data: RestaurantVisitInput) =>
    fetchAPI<RestaurantVisit>(`/restaurants/visits?${toQueryString({ restaurant_id: restaurantId })}`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deleteVisit: (id: string) =>
    fetchAPI(`/restaurants/visits?${toQueryString({ id })}`, {
      method: "DELETE",
    }),
};

// Home records API — capital improvements, the maintenance schedule, and service history
export type Receipt = { name: string; path: string };

export type HomeImprovement = {
  id: string;
  title: string;
  type: ImprovementType;
  completed_on: string | null; // YYYY-MM-DD
  cost: number | null;
  done_by: string | null;
  warranty_until: string | null; // YYYY-MM-DD
  notes: string | null;
  receipts: Receipt[];
  created_at: string;
};

export type HomeImprovementInput = Omit<HomeImprovement, "id" | "created_at">;

export type MaintenanceItem = {
  id: string;
  title: string;
  interval_months: number | null; // null means as needed
  notes: string | null;
  created_at: string;
};

export type MaintenanceItemInput = Omit<MaintenanceItem, "id" | "created_at">;

export type MaintenanceService = {
  id: string;
  item_id: string;
  service_on: string; // YYYY-MM-DD
  provider: string | null;
  cost: number | null;
  notes: string | null;
  receipts: Receipt[];
  created_at: string;
};

export type MaintenanceServiceInput = Omit<MaintenanceService, "id" | "created_at">;

// Someone you call for the house: a plumber, the oil company, the landscaper.
export type ServiceProvider = {
  id: string;
  name: string; // the person, or the company when there's no one person
  category: string; // one of PROVIDER_CATEGORIES (src/config/homeManagerIntake.ts)
  company: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  notes: string | null;
  created_at: string;
};

export type ServiceProviderInput = Omit<ServiceProvider, "id" | "created_at">;

const recordsAPI = <Row, Input>(endpoint: string) => ({
  getAll: () => fetchAPI<Row[]>(endpoint),

  create: (data: Input) =>
    fetchAPI<Row>(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Input) =>
    fetchAPI<Row>(`${endpoint}?${toQueryString({ id })}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchAPI(`${endpoint}?${toQueryString({ id })}`, {
      method: "DELETE",
    }),
});

export const homeAPI = {
  improvements: recordsAPI<HomeImprovement, HomeImprovementInput>("/home/improvements"),
  maintenance: recordsAPI<MaintenanceItem, MaintenanceItemInput>("/home/maintenance"),
  services: recordsAPI<MaintenanceService, MaintenanceServiceInput>("/home/maintenance/services"),
  providers: recordsAPI<ServiceProvider, ServiceProviderInput>("/home/providers"),

  // Multipart upload, so this bypasses fetchAPI's JSON body handling.
  uploadReceipt: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_URL}/home/receipts`, {
      method: "POST",
      body: form,
      credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Upload failed");
    return data as Receipt;
  },

  deleteReceipt: (path: string) =>
    fetchAPI(`/home/receipts?${toQueryString({ path })}`, { method: "DELETE" }),

  receiptUrl: (path: string) => `${API_URL}/home/receipts?${toQueryString({ path })}`,
};

// Family calendar API — events, plus who's looking after the kid and when
export type CalendarEvent = {
  id: string;
  title: string;
  event_on: string; // YYYY-MM-DD
  start_time: string | null; // HH:MM, null means all day
  location: string | null;
  notes: string | null;
  created_at: string;
};

export type CalendarEventInput = Omit<CalendarEvent, "id" | "created_at">;

export type ChildcarePerson = {
  id: string;
  name: string;
  color: string;
  archived: boolean; // hidden from pickers, but kept for past schedules
  created_at: string;
};

export type ChildcarePersonInput = Omit<ChildcarePerson, "id" | "created_at">;

export type ChildcareBlock = { person_id: string; start: string; end: string }; // HH:MM

// A normal week, in effect from effective_from until a later one takes over, so
// changing it never rewrites past weeks. weekday is 0 (Sunday) to 6.
export type ChildcareSchedule = {
  id: string;
  effective_from: string; // YYYY-MM-DD
  coverage_start: string; // HH:MM
  coverage_end: string; // HH:MM
  coverage_days: number[];
  blocks: (ChildcareBlock & { weekday: number })[];
  created_at: string;
};

export type ChildcareScheduleInput = Omit<ChildcareSchedule, "id" | "created_at">;

// One day that differs from the normal week.
export type ChildcareOverride = {
  id: string;
  on_date: string; // YYYY-MM-DD
  blocks: ChildcareBlock[];
  note: string | null;
  created_at: string;
};

export type ChildcareOverrideInput = Omit<ChildcareOverride, "id" | "created_at">;

export const calendarAPI = {
  events: recordsAPI<CalendarEvent, CalendarEventInput>("/calendar/events"),
  people: recordsAPI<ChildcarePerson, ChildcarePersonInput>("/childcare/people"),
  schedules: recordsAPI<ChildcareSchedule, ChildcareScheduleInput>("/childcare/schedules"),
  overrides: recordsAPI<ChildcareOverride, ChildcareOverrideInput>("/childcare/overrides"),
};

// Weekly plan API — one row per planned day, plus the household's parents and work
// locations. Each day is filled in by hand: nothing carries over between weeks.
export const PARENT_IDS = ["parent_1", "parent_2"] as const;
export type ParentId = (typeof PARENT_IDS)[number];

export type PlannerParent = { id: ParentId; name: string };

// commute: leave home, work, come back. home: working hours only. off: no hours.
export const LOCATION_KINDS = ["commute", "home", "off"] as const;
export type LocationKind = (typeof LOCATION_KINDS)[number];

export type PlannerLocation = {
  id: string;
  name: string;
  kind: LocationKind;
  color: string;
  archived: boolean; // hidden from pickers, but kept for past days
};

export type PlannerSettings = {
  id: string;
  parents: PlannerParent[];
  locations: PlannerLocation[];
  standard_days: PlannerStandardDay[];
  created_at: string;
};

export type PlannerSettingsInput = Omit<PlannerSettings, "id" | "created_at">;

export type PlannerWork = {
  location_id: string | null;
  commute: string | null; // how they get there: "7:22 train", "Drive"
  leave_at: string | null; // HH:MM, starts the commute in
  start: string | null; // HH:MM, starts work
  end: string | null; // HH:MM, finishes work
  home_at: string | null; // HH:MM, ends the commute home
};

// A saved day to fill in from, like "New York, 7:22 train". A parent can have several,
// and the one marked is_default is what "Apply standard days" uses.
export type PlannerStandardDay = {
  id: string;
  parent_id: ParentId;
  is_default: boolean;
  work: PlannerWork;
};

export const DINNER_PLANS = ["cook", "leftovers", "pickup", "delivery", "eat_out", "undecided"] as const;
export type DinnerPlan = (typeof DINNER_PLANS)[number];

export type PlannerDinner = {
  plan: DinnerPlan | null;
  meal: string | null; // the meal's name, or free text like "Thai from Rye Ridge"
  meal_id: string | null; // set when picked from Food, which is what brings in its groceries
  owner: ParentId | null; // who's handling it
  home: Partial<Record<ParentId, boolean>>; // unset means nobody's answered yet
};

// A side or dessert being made that day, like a corn salad for a friend's barbecue.
// It adds to the grocery list without being that night's dinner.
export type PlannerDish = {
  id: string;
  meal_id: string;
  name: string; // kept so the day still reads right if the recipe is deleted
  occasion: string | null;
};

export type PlanDay = {
  id: string;
  plan_on: string; // YYYY-MM-DD
  work: Partial<Record<ParentId, PlannerWork>>;
  dinner: PlannerDinner;
  dishes: PlannerDish[];
  note: string | null;
  created_at: string;
};

export type PlanDayInput = Omit<PlanDay, "id" | "created_at">;

export const plannerAPI = {
  days: recordsAPI<PlanDay, PlanDayInput>("/planner/days"),
  // At most one row per household.
  settings: recordsAPI<PlannerSettings, PlannerSettingsInput>("/planner/settings"),
};

// Meals API — the list of meals to make, and each week's grocery list. The list itself
// is worked out from the week's planned dinners; only what you've changed gets saved.
export type MealIngredient = { name: string; quantity: string | null; group: IngredientGroup };

export type Meal = {
  id: string;
  name: string;
  kind: MealKind;
  cuisine: MealCuisine;
  methods: MealMethod[];
  prep_minutes: number | null;
  cook_minutes: number | null;
  servings: number | null;
  ingredients: MealIngredient[];
  tags: string[];
  notes: string | null;
  recipe_url: string | null;
  created_at: string;
};

export type MealInput = Omit<Meal, "id" | "created_at">;

export type GroceryExtra = { id: string; name: string; quantity: string | null; group: IngredientGroup };

export type GroceryWeek = {
  id: string;
  week_of: string; // YYYY-MM-DD, the Monday
  have: string[]; // items to buy that you already have
  need: string[]; // pantry items and spices you're out of
  extras: GroceryExtra[]; // added by hand
  ordered_at: string | null;
  ordered_keys: string[]; // what was on the list when it was ordered
  created_at: string;
};

export type GroceryWeekInput = Omit<GroceryWeek, "id" | "created_at">;
export type GroceryWeekDraft = GroceryWeekInput & { id?: string };

export const mealsAPI = recordsAPI<Meal, MealInput>("/meals");
export const groceriesAPI = recordsAPI<GroceryWeek, GroceryWeekInput>("/groceries");

// Brain Dump, Goals, Ideas and Notes, and links between things. Goals, ideas and notes
// share one table, so moving one between lists only changes its kind.
export const ENTRY_KINDS = ["goal", "idea", "note"] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

export const SORT_TARGETS = ["task", "goal", "idea", "note"] as const;
export type SortTarget = (typeof SORT_TARGETS)[number];

export const DUMP_STATES = ["open", "sorted", "archived"] as const;
export type DumpState = (typeof DUMP_STATES)[number];

export type DumpItem = {
  id: string;
  text: string;
  state: DumpState;
  sorted_as: SortTarget | null; // what it became
  sorted_id: string | null; // the task or entry it became
  sorted_at: string | null;
  created_at: string;
};

export type DumpItemInput = Omit<DumpItem, "id" | "created_at">;

export type Entry = {
  id: string;
  kind: EntryKind;
  title: string;
  details: string | null;
  archived: boolean;
  created_at: string;
};

export type EntryInput = Omit<Entry, "id" | "created_at">;

// Entries link as "entry" rather than by kind, so moving one between lists keeps its links.
export const LINK_TYPES = ["task", "entry", "dump"] as const;
export type LinkType = (typeof LINK_TYPES)[number];

export type Link = {
  id: string;
  a_type: LinkType;
  a_id: string;
  b_type: LinkType;
  b_id: string;
  created_at: string;
};

export type LinkInput = Omit<Link, "id" | "created_at">;

export const listsAPI = {
  dump: {
    ...recordsAPI<DumpItem, DumpItemInput>("/brain-dump"),
    sort: (id: string, as: SortTarget) =>
      fetchAPI<{ item: DumpItem; target: Item | Entry }>("/brain-dump/sort", {
        method: "POST",
        body: JSON.stringify({ id, as }),
      }),
  },
  entries: recordsAPI<Entry, EntryInput>("/entries"),
  links: recordsAPI<Link, LinkInput>("/links"),
};

// Profile API
export const profileAPI = {
  update: (data: { full_name?: string }) =>
    fetchAPI("/profile", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
};

// Notifications API
export const notificationsAPI = {
  getAll: () => fetchAPI("/notifications"),

  dismiss: (id: string) =>
    fetchAPI(`/notifications?id=${id}`, {
      method: "PUT",
      body: JSON.stringify({ action: "dismiss" }),
    }),

  completeByType: (type: string) =>
    fetchAPI("/notifications", {
      method: "PATCH",
      body: JSON.stringify({ type }),
    }),
};

// Export combined API object
export const api = {
  items: itemsAPI,
  intake: intakeAPI,
  restaurants: restaurantsAPI,
  home: homeAPI,
  calendar: calendarAPI,
  planner: plannerAPI,
  meals: mealsAPI,
  groceries: groceriesAPI,
  lists: listsAPI,
  profile: profileAPI,
  notifications: notificationsAPI,
};

export default api;

import axios from "axios";
import type { Cuisine, Occasion, Service } from "@/config/restaurants";

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
export const ITEM_CATEGORIES = ["home", "entertainment", "food"] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export type Item = {
  id: string;
  title: string;
  category: ItemCategory;
  done: boolean;
  created_at: string;
};

export const itemsAPI = {
  // Omit category to get every item.
  getAll: (category?: ItemCategory) =>
    fetchAPI<Item[]>(category ? `/items?${toQueryString({ category })}` : "/items"),

  create: (title: string, category: ItemCategory) =>
    fetchAPI<Item>("/items", {
      method: "POST",
      body: JSON.stringify({ title, category }),
    }),

  update: (id: string, data: Partial<Pick<Item, "title" | "done">>) =>
    fetchAPI<Item>(`/items?id=${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(data),
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
  profile: profileAPI,
  notifications: notificationsAPI,
};

export default api;

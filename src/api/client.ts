import axios from "axios";

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
export type Item = {
  id: string;
  title: string;
  done: boolean;
  created_at: string;
};

export const itemsAPI = {
  getAll: () => fetchAPI<Item[]>("/items"),

  create: (title: string) =>
    fetchAPI<Item>("/items", {
      method: "POST",
      body: JSON.stringify({ title }),
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
  profile: profileAPI,
  notifications: notificationsAPI,
};

export default api;

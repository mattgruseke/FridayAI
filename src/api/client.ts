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

// Leads API
export const leadsAPI = {
  // Get all leads with optional filters
  getAll: (params: QueryParams = {}) => {
    const queryString = toQueryString(params);
    return fetchAPI(`/leads${queryString ? `?${queryString}` : ""}`);
  },

  // Get single lead by ID
  getById: (id: string) => fetchAPI(`/leads?id=${id}`),

  // Create new lead
  create: (data: unknown) =>
    fetchAPI("/leads", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Update lead
  update: (id: string, data: unknown) =>
    fetchAPI(`/leads?id=${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Delete lead
  delete: (id: string) =>
    fetchAPI(`/leads?id=${id}`, {
      method: "DELETE",
    }),
};

// Publish Leads API
export const publishLeadsAPI = {
  // Publish a single lead to public database
  publishSingle: (leadId: string) =>
    fetchAPI("/publish-leads", {
      method: "POST",
      body: JSON.stringify({ mode: "single", leadId }),
    }),

  // Publish all user's leads to public database
  publishAll: () =>
    fetchAPI("/publish-leads", {
      method: "POST",
      body: JSON.stringify({ mode: "all" }),
    }),
};

// User Leads API (Saved/Tracked Leads)
export const userLeadsAPI = {
  // Get all user's saved leads
  getAll: (params: QueryParams = {}) => {
    const queryString = toQueryString(params);
    return fetchAPI(`/user-leads${queryString ? `?${queryString}` : ""}`);
  },

  // Get pipeline view (grouped by status)
  getPipeline: () => fetchAPI("/pipeline"),

  // Get single user lead by UserLead ID
  getById: (id: string) => {
    const params = new URLSearchParams({ id });
    return fetchAPI(`/user-leads?${params.toString()}`);
  },

  // Get user lead by LEAD ID (not UserLead ID)
  getByLeadId: (leadId: string) => {
    const params = new URLSearchParams({ leadId });
    return fetchAPI(`/user-leads?${params.toString()}`);
  },

  // Get activity timeline for a lead
  getActivity: (id: string) => {
    const params = new URLSearchParams({ id, activity: "true" });
    return fetchAPI(`/user-leads?${params.toString()}`);
  },

  // Save a lead
  save: (data: unknown) =>
    fetchAPI("/user-leads", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Update user lead (priority, notes, etc.)
  update: (id: string, data: unknown) =>
    fetchAPI(`/user-leads?id=${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Update pipeline status
  updateStatus: (id: string, status: string, note = "") =>
    fetchAPI(`/user-leads?id=${id}`, {
      method: "PUT",
      body: JSON.stringify({ status, note }),
    }),

  // Remove saved lead
  remove: (id: string) => {
    const params = new URLSearchParams({ id });
    return fetchAPI(`/user-leads?${params.toString()}`, {
      method: "DELETE",
    });
  },
};

// Referrals API
export const referralsAPI = {
  // Get all referrals
  getAll: (params: QueryParams = {}) => {
    const queryString = toQueryString(params);
    return fetchAPI(`/referrals${queryString ? `?${queryString}` : ""}`);
  },

  // Get single referral by ID
  getById: (id: string) => fetchAPI(`/referrals?id=${id}`),

  // Get activity timeline for a referral
  getActivity: (id: string) => {
    const params = new URLSearchParams({ id, activity: "true" });
    return fetchAPI(`/referrals?${params.toString()}`);
  },

  // Create new referral
  create: (data: unknown) =>
    fetchAPI("/referrals", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Update referral
  update: (id: string, data: unknown) =>
    fetchAPI(`/referrals?id=${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Delete referral
  delete: (id: string) =>
    fetchAPI(`/referrals?id=${id}`, {
      method: "DELETE",
    }),
};

// User Lists API
export const userListsAPI = {
  getAll: () => fetchAPI("/user-lists"),

  getById: (id: string) => fetchAPI(`/user-lists?id=${id}`),

  create: (data: unknown) =>
    fetchAPI("/user-lists", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: unknown) =>
    fetchAPI(`/user-lists?id=${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchAPI(`/user-lists?id=${id}`, {
      method: "DELETE",
    }),
};

// Network Connections API
export const networkConnectionsAPI = {
  getSummary: () => fetchAPI("/network-connections?summary=true"),
  getByLeadId: (leadId: string) =>
    fetchAPI(`/network-connections?leadId=${encodeURIComponent(leadId)}`),
};

// Onboarding API
export const onboardingAPI = {
  complete: (preferredRoles: string[], preferredCompensation: string[] = []) =>
    fetchAPI("/onboarding", {
      method: "POST",
      body: JSON.stringify({ preferredRoles, preferredCompensation }),
    }),

  skip: () =>
    fetchAPI("/onboarding", {
      method: "POST",
      body: JSON.stringify({ skip: true }),
    }),

  saveRoles: (preferredRoles: string[]) =>
    fetchAPI("/onboarding", {
      method: "PUT",
      body: JSON.stringify({ preferredRoles }),
    }),

  refresh: (listId: string) =>
    fetchAPI(`/onboarding?listId=${listId}`, {
      method: "PUT",
    }),
};

// Profile API
export const profileAPI = {
  completeTour: () =>
    fetchAPI("/profile", {
      method: "PATCH",
      body: JSON.stringify({ tour_completed: true }),
    }),
};

// Score Leads API
export const scoreLeadsAPI = {
  get: () => fetchAPI("/score-leads"),
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

// User Templates API
export const userTemplatesAPI = {
  getAll: () => fetchAPI("/user-templates"),

  create: (data: { name: string; subject: string; body: string }) =>
    fetchAPI("/user-templates", { method: "POST", body: JSON.stringify(data) }),

  delete: (id: string) =>
    fetchAPI(`/user-templates?id=${id}`, { method: "DELETE" }),
};

// Export combined API object
export const api = {
  leads: leadsAPI,
  userLeads: userLeadsAPI,
  referrals: referralsAPI,
  publish: publishLeadsAPI,
  userLists: userListsAPI,
  onboarding: onboardingAPI,
  networkConnections: networkConnectionsAPI,
  scoreLeads: scoreLeadsAPI,
  profile: profileAPI,
  notifications: notificationsAPI,
  userTemplates: userTemplatesAPI,
};

export default api;

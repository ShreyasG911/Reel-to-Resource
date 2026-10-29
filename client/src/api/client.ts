import { 
  Resource, 
  AutomationEvent, 
  ReplyLog, 
  OverviewMetrics, 
  IntegrationStatus, 
  AutomationSettings, 
  Pagination 
} from '../types';

const API_BASE = '/api/v1';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.details || `Request failed with status ${res.status}`);
  }
  return data;
}

export const api = {
  // Resources
  getResources: (params?: { page?: number; limit?: number; search?: string; resourceType?: string; isAvailable?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.search) qs.set('search', params.search);
    if (params?.resourceType) qs.set('resourceType', params.resourceType);
    if (params?.isAvailable !== undefined && params?.isAvailable !== '') qs.set('isAvailable', params.isAvailable);
    if (params?.status) qs.set('status', params.status);
    return fetchJson<{ data: Resource[]; pagination: Pagination }>(`${API_BASE}/resources?${qs.toString()}`);
  },

  getResourceById: (id: string) => 
    fetchJson<{ data: Resource }>(`${API_BASE}/resources/${id}`),

  createResource: (resource: Partial<Resource>) =>
    fetchJson<{ data: Resource }>(`${API_BASE}/resources`, {
      method: 'POST',
      body: JSON.stringify(resource),
    }),

  updateResource: (id: string, updates: Partial<Resource>) =>
    fetchJson<{ data: Resource }>(`${API_BASE}/resources/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  deleteResource: (id: string) =>
    fetchJson<{ message: string; id: string }>(`${API_BASE}/resources/${id}`, {
      method: 'DELETE',
    }),

  // Automation Settings
  getSettings: () =>
    fetchJson<{ data: AutomationSettings }>(`${API_BASE}/automation/settings`),

  updateSettings: (updates: Partial<AutomationSettings>) =>
    fetchJson<{ data: AutomationSettings; message: string }>(`${API_BASE}/automation/settings`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  testMatch: (input: string) =>
    fetchJson<{ data: any }>(`${API_BASE}/automation/test-match`, {
      method: 'POST',
      body: JSON.stringify({ input }),
    }),

  // Events
  getEvents: (params?: { page?: number; limit?: number; status?: string; identificationStatus?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.status) qs.set('status', params.status);
    if (params?.identificationStatus) qs.set('identificationStatus', params.identificationStatus);
    if (params?.search) qs.set('search', params.search);
    return fetchJson<{ data: AutomationEvent[]; pagination: Pagination }>(`${API_BASE}/events?${qs.toString()}`);
  },

  getEventById: (id: string) =>
    fetchJson<{ data: AutomationEvent }>(`${API_BASE}/events/${id}`),

  // Replies
  getReplies: (params?: { page?: number; limit?: number; deliveryStatus?: string; replyType?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.deliveryStatus) qs.set('deliveryStatus', params.deliveryStatus);
    if (params?.replyType) qs.set('replyType', params.replyType);
    return fetchJson<{ data: ReplyLog[]; pagination: Pagination }>(`${API_BASE}/replies?${qs.toString()}`);
  },

  // Integration & Analytics
  getIntegrationStatus: () =>
    fetchJson<{ data: IntegrationStatus }>(`${API_BASE}/integration/status`),

  getOverview: () =>
    fetchJson<{ data: OverviewMetrics }>(`${API_BASE}/analytics/overview`),
};


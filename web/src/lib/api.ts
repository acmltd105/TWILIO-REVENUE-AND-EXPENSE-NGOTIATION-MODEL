export type NegotiationPayload = {
  currency: string;
  revenue: number;
  expense: number;
  target_margin: number;
  floor_margin: number;
  ceiling_margin: number;
  target_discount: number;
  floor_discount: number;
  ceiling_discount: number;
  audit_trail: Record<string, unknown>;
};

export type InvoiceSummary = {
  invoices: Array<Record<string, unknown>>;
  totals: {
    total: number;
    count: number;
    currency: string;
  };
};

export type HealthPayload = {
  supabase_online: boolean;
  twilio_online: boolean;
  cached_notifications: number;
  generated_at: string;
  correlation_id: string;
};

const API_BASE = "/api/v1";

async function fetchWithRetry<T>(path: string, options?: RequestInit, retries = 3): Promise<T> {
  const response = await fetch(path, options);
  if (!response.ok) {
    if (retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, (4 - retries) * 200));
      return fetchWithRetry<T>(path, options, retries - 1);
    }
    throw new Error(`Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function getHealth(): Promise<HealthPayload> {
  return fetchWithRetry(`${API_BASE}/health`);
}

export async function getNegotiation(): Promise<NegotiationPayload> {
  return fetchWithRetry(`${API_BASE}/negotiation`);
}

export async function getInvoices(): Promise<InvoiceSummary> {
  return fetchWithRetry(`${API_BASE}/invoices`);
}

export async function triggerDemoNotification(): Promise<{ delivered: boolean; message: string }>{
  return fetchWithRetry(`${API_BASE}/notifications/demo`, { method: "POST" });
}

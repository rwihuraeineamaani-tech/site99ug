// Shared Pesapal client for edge functions
const ENV = (Deno.env.get("PESAPAL_ENV") || "sandbox").toLowerCase();
export const PESAPAL_BASE =
  ENV === "live"
    ? "https://pay.pesapal.com/v3"
    : "https://cybqa.pesapal.com/pesapalv3";

let cachedToken: { token: string; exp: number } | null = null;

export async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.exp > Date.now() + 30_000) return cachedToken.token;
  const key = Deno.env.get("PESAPAL_CONSUMER_KEY");
  const secret = Deno.env.get("PESAPAL_CONSUMER_SECRET");
  if (!key || !secret) throw new Error("PESAPAL_CONSUMER_KEY/SECRET not configured");
  const res = await fetch(`${PESAPAL_BASE}/api/Auth/RequestToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ consumer_key: key, consumer_secret: secret }),
  });
  const body = await res.json();
  if (!res.ok || !body.token) {
    throw new Error(`Pesapal auth failed: ${res.status} ${JSON.stringify(body)}`);
  }
  cachedToken = { token: body.token, exp: Date.now() + 4 * 60 * 1000 };
  return body.token;
}

export async function pesapal(path: string, method: "GET" | "POST", body?: unknown) {
  const token = await getToken();
  const res = await fetch(`${PESAPAL_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Pesapal ${path} ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

export async function getOrRegisterIpn(callbackUrl: string): Promise<string> {
  const existing = Deno.env.get("PESAPAL_IPN_ID");
  if (existing) return existing;
  const reg = await pesapal("/api/URLSetup/RegisterIPN", "POST", {
    url: callbackUrl,
    ipn_notification_type: "GET",
  });
  return reg.ipn_id;
}

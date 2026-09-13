import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { supabase } from "@/integrations/supabase/client";

type PushConfig = { apiKey: string; projectId: string; appId: string; vapidKey: string; messagingSenderId: string };

const fallbackAppId = "1:1066442121439:web:f62d74e86cb4f182e0096a";
const fallbackProjectId = "database-f4b47";
const fallbackVapidKey = "BLx7bedwKwMJwl-WKGt-PQhl94_3A3jql5558ZtEqu_y135cApqf1zg9nITsR2Eke9PRhkLJdAIPD-0TvgI4Mu8";

let configPromise: Promise<PushConfig | null> | null = null;

async function loadConfig(): Promise<PushConfig | null> {
  const apiKey = import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY as string | undefined;
  const appId = (import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_APP_ID as string | undefined) ?? fallbackAppId;
  const projectId = (import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_PROJECT_ID as string | undefined) ?? fallbackProjectId;
  const vapidKey = (import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY as string | undefined) ?? fallbackVapidKey;
  if (apiKey) return { apiKey, projectId, appId, vapidKey, messagingSenderId: appId.split(":")[1] ?? "" };
  try {
    const { data, error } = await supabase.functions.invoke("push-config");
    if (error || !data?.apiKey) return null;
    return {
      apiKey: data.apiKey,
      projectId: data.projectId ?? projectId,
      appId: data.appId ?? appId,
      vapidKey: data.vapidKey ?? vapidKey,
      messagingSenderId: data.messagingSenderId ?? appId.split(":")[1] ?? "",
    };
  } catch {
    return null;
  }
}

function pushConfig(): Promise<PushConfig | null> {
  configPromise ??= loadConfig();
  return configPromise;
}

export type PushStatus = "checking" | "enabled" | "disabled" | "denied" | "unsupported" | "open-in-new-tab" | "not-configured";

export async function pushEnvironmentStatus(): Promise<Exclude<PushStatus, "checking" | "enabled" | "disabled" | "denied"> | null> {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return "unsupported";
  if (window.top !== window.self) return "open-in-new-tab";
  const config = await pushConfig();
  if (!config || !config.apiKey || !config.appId || !config.vapidKey || !config.messagingSenderId) return "not-configured";
  return null;
}

async function firebaseMessaging(config: PushConfig) {
  const app = getApps()[0] ?? initializeApp({
    apiKey: config.apiKey,
    projectId: config.projectId,
    appId: config.appId,
    messagingSenderId: config.messagingSenderId,
  });
  return getMessaging(app);
}

async function serviceWorkerFor(config: PushConfig) {
  const query = new URLSearchParams({
    apiKey: config.apiKey,
    projectId: config.projectId,
    appId: config.appId,
    messagingSenderId: config.messagingSenderId,
  }).toString();
  return navigator.serviceWorker.register(`/firebase-messaging-sw.js?${query}`);
}

export async function registerPush(userId: string): Promise<PushStatus> {
  const unavailable = await pushEnvironmentStatus();
  if (unavailable) return unavailable;
  const config = (await pushConfig())!;
  if (!(await isSupported())) return "unsupported";
  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  const registration = await serviceWorkerFor(config);
  const messaging = await firebaseMessaging(config);
  const token = await getToken(messaging, { vapidKey: config.vapidKey, serviceWorkerRegistration: registration });
  if (!token) return "disabled";
  const label = [navigator.platform, navigator.userAgent.includes("Mobile") ? "Mobile" : "Browser"].filter(Boolean).join(" · ");
  const { error } = await supabase.from("push_devices").upsert({
    user_id: userId,
    token,
    device_label: label || "This device",
    platform: navigator.platform || null,
    user_agent: navigator.userAgent,
    active: true,
    last_seen_at: new Date().toISOString(),
  }, { onConflict: "token" });
  if (error) throw error;
  return "enabled";
}

export async function disablePushForDevice(userId: string) {
  const unavailable = await pushEnvironmentStatus();
  if (unavailable || Notification.permission !== "granted" || !(await isSupported())) return;
  const config = (await pushConfig())!;
  const registration = await navigator.serviceWorker.getRegistration("/");
  if (!registration) return;
  const token = await getToken(await firebaseMessaging(config), { vapidKey: config.vapidKey, serviceWorkerRegistration: registration });
  if (token) await supabase.from("push_devices").update({ active: false }).eq("user_id", userId).eq("token", token);
}

export async function listenForForegroundPush(onPush: (title: string, body?: string) => void) {
  if (await pushEnvironmentStatus()) return () => undefined;
  if (Notification.permission !== "granted" || !(await isSupported())) return () => undefined;
  const config = (await pushConfig())!;
  const messaging = await firebaseMessaging(config);
  return onMessage(messaging, (payload) => onPush(payload.data?.title ?? payload.notification?.title ?? "Site 99", payload.data?.body ?? payload.notification?.body));
}

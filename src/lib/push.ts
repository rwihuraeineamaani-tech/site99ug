import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { supabase } from "@/integrations/supabase/client";

const appId = import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_APP_ID;
const vapidKey = import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY;
const firebaseConfig = {
  apiKey: import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY,
  projectId: import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_PROJECT_ID,
  appId,
  messagingSenderId: appId?.split(":")[1] ?? "",
};

export type PushStatus = "checking" | "enabled" | "disabled" | "denied" | "unsupported" | "open-in-new-tab" | "not-configured";

export function pushEnvironmentStatus(): Exclude<PushStatus, "checking" | "enabled" | "disabled" | "denied"> | null {
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !appId || !vapidKey || !firebaseConfig.messagingSenderId) return "not-configured";
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return "unsupported";
  if (window.top !== window.self) return "open-in-new-tab";
  return null;
}

export async function registerPush(userId: string): Promise<PushStatus> {
  const unavailable = pushEnvironmentStatus();
  if (unavailable) return unavailable;
  if (!(await isSupported())) return "unsupported";
  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  const query = new URLSearchParams(firebaseConfig).toString();
  const registration = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${query}`);
  const firebase = getApps()[0] ?? initializeApp(firebaseConfig);
  const messaging = getMessaging(firebase);
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
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
  const unavailable = pushEnvironmentStatus();
  if (unavailable || Notification.permission !== "granted" || !(await isSupported())) return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  if (!registration) return;
  const firebase = getApps()[0] ?? initializeApp(firebaseConfig);
  const token = await getToken(getMessaging(firebase), { vapidKey, serviceWorkerRegistration: registration });
  if (token) await supabase.from("push_devices").update({ active: false }).eq("user_id", userId).eq("token", token);
}

export async function listenForForegroundPush(onPush: (title: string, body?: string) => void) {
  if (pushEnvironmentStatus() || Notification.permission !== "granted" || !(await isSupported())) return () => undefined;
  const firebase = getApps()[0] ?? initializeApp(firebaseConfig);
  return onMessage(getMessaging(firebase), (payload) => onPush(payload.data?.title ?? payload.notification?.title ?? "Site 99", payload.data?.body ?? payload.notification?.body));
}
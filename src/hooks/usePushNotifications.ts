import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { disablePushForDevice, listenForForegroundPush, pushEnvironmentStatus, registerPush, type PushStatus } from "@/lib/push";

export type PushPreferences = { tasks_enabled: boolean; approvals_enabled: boolean; communications_enabled: boolean; finance_enabled: boolean };
const defaults: PushPreferences = { tasks_enabled: true, approvals_enabled: true, communications_enabled: true, finance_enabled: true };

export function usePushNotifications(userId?: string | null) {
  const [status, setStatus] = useState<PushStatus>("checking");
  const [preferences, setPreferences] = useState(defaults);
  const [devices, setDevices] = useState<{ id: string; device_label: string | null; last_seen_at: string; active: boolean }[]>([]);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!userId) return;
    const [pref, deviceRows] = await Promise.all([
      supabase.from("push_preferences").select("tasks_enabled,approvals_enabled,communications_enabled,finance_enabled").eq("user_id", userId).maybeSingle(),
      supabase.from("push_devices").select("id,device_label,last_seen_at,active").eq("user_id", userId).eq("active", true).order("last_seen_at", { ascending: false }),
    ]);
    if (pref.data) setPreferences(pref.data as PushPreferences);
    setDevices((deviceRows.data ?? []) as typeof devices);
    const unavailable = pushEnvironmentStatus();
    setStatus(unavailable ?? (Notification.permission === "granted" && (deviceRows.data?.length ?? 0) > 0 ? "enabled" : Notification.permission === "denied" ? "denied" : "disabled"));
  }, [userId]);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { let stop: (() => void) | undefined; listenForForegroundPush((title, body) => toast(title, { description: body })).then((fn) => { stop = fn; }); return () => stop?.(); }, []);

  const enable = async () => { if (!userId) return; setBusy(true); try { setStatus(await registerPush(userId)); await reload(); } catch (error) { toast.error(error instanceof Error ? error.message : "Notifications could not be enabled."); } finally { setBusy(false); } };
  const disable = async () => { if (!userId) return; setBusy(true); await disablePushForDevice(userId); await reload(); setStatus("disabled"); setBusy(false); };
  const updatePreference = async (key: keyof PushPreferences, value: boolean) => {
    if (!userId) return;
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    const { error } = await supabase.from("push_preferences").upsert({ user_id: userId, ...next });
    if (error) { setPreferences(preferences); toast.error(error.message); }
  };
  const removeDevice = async (id: string) => { await supabase.from("push_devices").update({ active: false }).eq("id", id); await reload(); };
  const sendTest = async () => { const { error } = await supabase.functions.invoke("send-push", { body: { test: true } }); if (error) toast.error("Test notification could not be sent."); else toast.success("Test notification queued."); };

  return { status, preferences, devices, busy, enable, disable, updatePreference, removeDevice, sendTest };
}
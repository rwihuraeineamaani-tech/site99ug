import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMyRoles } from "@/hooks/useMyRoles";
import type { CalendarItem } from "@/lib/calendar";
import { itemAsBlock, kampalaInstant } from "@/lib/calendar";
import { addDays, occurrencesInRange } from "@/lib/recurrence";

export type CalendarReminder = { item: CalendarItem; occurrence: string; dueAt: Date };

function kampalaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kampala" }).format(new Date());
}

export function useCalendarReminders() {
  const { userId, isStaff } = useMyRoles();
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [now, setNow] = useState(() => new Date());
  const load = useCallback(async () => {
    if (!userId || !isStaff) return;
    const { data } = await supabase.from("calendar_items").select("*").eq("owner_user_id", userId).not("reminder_minutes", "is", null).is("reminder_dismissed_at", null);
    setItems((data as CalendarItem[]) ?? []);
  }, [userId, isStaff]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const reminders = useMemo(() => {
    const today = kampalaToday();
    const from = addDays(today, -1);
    const to = addDays(today, 2);
    return items.flatMap<CalendarReminder>((item) => {
      const mins = item.reminder_minutes;
      if (mins == null) return [];
      const start = item.all_day ? "09:00" : (item.start_time ?? "09:00").slice(0, 5);
      return occurrencesInRange(itemAsBlock(item), from, to).map((occurrence) => ({
        item,
        occurrence,
        dueAt: new Date(kampalaInstant(occurrence, start).getTime() - mins * 60_000),
      }));
    }).filter((r) => r.dueAt <= now && now.getTime() - r.dueAt.getTime() < 36 * 60 * 60_000)
      .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  }, [items, now]);
  const dismiss = async (id: string) => {
    await supabase.from("calendar_items").update({ reminder_dismissed_at: new Date().toISOString() }).eq("id", id);
    await load();
  };
  return { reminders, dismiss, reload: load };
}

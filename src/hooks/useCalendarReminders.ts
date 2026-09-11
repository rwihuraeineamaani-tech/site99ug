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
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => new Date());
  const load = useCallback(async () => {
    if (!userId || !isStaff) return;
    const [itemResult, readResult] = await Promise.all([
      supabase.from("calendar_items").select("*").eq("owner_user_id", userId).not("reminder_minutes", "is", null),
      supabase.from("calendar_reminder_reads").select("calendar_item_id,occurrence_date").eq("owner_user_id", userId),
    ]);
    setItems((itemResult.data as CalendarItem[]) ?? []);
    setDismissed(new Set((readResult.data ?? []).map((r) => `${r.calendar_item_id}-${r.occurrence_date}`)));
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
    }).filter((r) => !dismissed.has(`${r.item.id}-${r.occurrence}`) && r.dueAt <= now && now.getTime() - r.dueAt.getTime() < 36 * 60 * 60_000)
      .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  }, [items, now, dismissed]);
  const dismiss = async (id: string, occurrence: string) => {
    await supabase.from("calendar_reminder_reads").upsert({ calendar_item_id: id, occurrence_date: occurrence }, { onConflict: "calendar_item_id,occurrence_date" });
    await load();
  };
  return { reminders, dismiss, reload: load };
}

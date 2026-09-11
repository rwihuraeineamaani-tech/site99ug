import type { Database } from "@/integrations/supabase/types";
import type { AvailabilityBlock } from "@/lib/recurrence";

export type CalendarItem = Database["public"]["Tables"]["calendar_items"]["Row"];
export type CalendarBusySlot = Database["public"]["Tables"]["calendar_busy_slots"]["Row"];
export type WorkKind = NonNullable<CalendarItem["work_kind"]> | "sales";

export type WorkOption = { kind: WorkKind; id: string; label: string; path: string };

export function itemAsBlock(item: CalendarItem): AvailabilityBlock {
  return {
    id: item.id,
    owner_kind: "staff",
    owner_user_id: item.owner_user_id,
    resident_id: null,
    title: item.title,
    all_day: item.all_day,
    start_date: item.start_date,
    end_date: item.end_date,
    start_time: item.start_time,
    end_time: item.end_time,
    freq: item.freq as AvailabilityBlock["freq"],
    interval_n: item.interval_n,
    byweekday: item.byweekday ?? [],
    until: item.until,
    occurrences: item.occurrences,
    strictness: item.strictness as AvailabilityBlock["strictness"],
    note: item.note,
  };
}

export function slotAsBlock(slot: CalendarBusySlot): AvailabilityBlock {
  return {
    id: slot.calendar_item_id,
    owner_kind: "staff",
    owner_user_id: slot.owner_user_id,
    resident_id: null,
    title: "Busy",
    all_day: slot.all_day,
    start_date: slot.start_date,
    end_date: slot.end_date,
    start_time: slot.start_time,
    end_time: slot.end_time,
    freq: slot.freq as AvailabilityBlock["freq"],
    interval_n: slot.interval_n,
    byweekday: slot.byweekday ?? [],
    until: slot.until,
    occurrences: slot.occurrences,
    strictness: slot.strictness as AvailabilityBlock["strictness"],
    note: null,
  };
}

export function kampalaInstant(date: string, time: string): Date {
  return new Date(`${date}T${time}:00+03:00`);
}

export function reminderFor(date: string, time: string, minutes: number | null): string | null {
  if (minutes == null) return null;
  return new Date(kampalaInstant(date, time).getTime() - minutes * 60_000).toISOString();
}

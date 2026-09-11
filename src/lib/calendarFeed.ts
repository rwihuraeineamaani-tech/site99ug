import { supabase } from "@/integrations/supabase/client";
import { AvailabilityBlock, occurrencesInRange, timeLabel } from "@/lib/recurrence";
import { CalendarItem, itemAsBlock, slotAsBlock } from "@/lib/calendar";

export type EntryKind = "shoot" | "post" | "numbers" | "event" | "busy" | "personal" | "task";

export type CalendarEntry = {
  id: string;
  date: string;
  kind: EntryKind;
  title: string;
  note: string;
  to?: string;
  userId?: string | null;
  residentId?: string | null;
  strictness?: "warn" | "hard";
  time?: string;
  endTime?: string;
  allDay?: boolean;
  ownerName?: string;
  visibility?: "private" | "team";
  calendarItem?: CalendarItem;
};

export const KIND_LABEL: Record<EntryKind, string> = {
  shoot: "Shoot",
  post: "Post",
  numbers: "Numbers",
  event: "Event",
  busy: "Busy",
  personal: "My calendar",
  task: "Assigned work",
};

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Monday-first week start for a date. */
export function weekStart(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const shift = (dt.getUTCDay() + 6) % 7;
  return addDays(iso, -shift);
}

export function monthGridRange(anchorISO: string): { from: string; to: string } {
  const first = `${anchorISO.slice(0, 7)}-01`;
  const from = weekStart(first);
  return { from, to: addDays(from, 41) };
}

export type CalendarData = {
  entries: CalendarEntry[];
  blocks: AvailabilityBlock[];
  residents: { id: string; name: string }[];
  people: { user_id: string; display_name: string | null; email: string }[];
  calendarItems: CalendarItem[];
};

/** Everything dated between two days: shoots, posts, numbers due, events and busy blocks. */
export async function loadCalendar(from: string, to: string): Promise<CalendarData> {
  const [shoots, content, events, blocksRes, calendarItemsRes, busySlotsRes, residentsRes, peopleRes, taskRes, taskLinksRes] = await Promise.all([
    supabase
      .from("shoot_days")
      .select("id, resident_id, status, shoot_date, call_time, location")
      .gte("shoot_date", from)
      .lte("shoot_date", to),
    supabase
      .from("content_items")
      .select("id, ref_no, title, stage, resident_id, planned_at, metrics_due_at")
      .not("stage", "in", '("Archived","Rejected")'),
    supabase.from("events").select("id, title, slug, starts_at, venue").gte("starts_at", from).lte("starts_at", `${to}T23:59:59Z`),
    supabase.from("availability_blocks").select("*"),
    supabase.from("calendar_items").select("*").lte("start_date", to).or(`until.gte.${from},end_date.gte.${from}`),
    supabase.from("calendar_busy_slots").select("*").lte("start_date", to).or(`until.gte.${from},end_date.gte.${from}`),
    supabase.from("residents").select("id, name").order("name"),
    supabase.from("team_members").select("user_id, display_name, email"),
    supabase.from("leadership_tasks").select("id,title,due_at,status,resident_id").not("due_at", "is", null).gte("due_at", `${from}T00:00:00`).lte("due_at", `${to}T23:59:59`).not("status", "in", '("accepted","cancelled")'),
    supabase.from("leadership_task_assignees").select("task_id,user_id"),
  ]);

  const residents = (residentsRes.data as { id: string; name: string }[]) ?? [];
  const names = new Map(residents.map((r) => [r.id, r.name]));
  const people = (peopleRes.data as { user_id: string; display_name: string | null; email: string }[]) ?? [];
  const personNames = new Map(people.map((p) => [p.user_id, p.display_name || p.email]));
  const calendarItems = (calendarItemsRes.data as CalendarItem[]) ?? [];
  const blocks = ((blocksRes.data as unknown as AvailabilityBlock[]) ?? []).map((b) => ({
    ...b,
    byweekday: b.byweekday ?? [],
  }));

  const entries: CalendarEntry[] = [];

  const taskLinks = (taskLinksRes.data as { task_id: string; user_id: string }[]) ?? [];
  ((taskRes.data as { id: string; title: string; due_at: string | null; status: string; resident_id: string | null }[]) ?? []).forEach((task) => {
    if (!task.due_at) return;
    const users = taskLinks.filter((link) => link.task_id === task.id);
    users.forEach((link) => entries.push({ id: `task-${task.id}-${link.user_id}`, date: task.due_at?.slice(0,10) ?? "", kind: "task", title: task.title, note: task.status.replaceAll("_", " "), to: `/app/todo/${task.id}`, userId: link.user_id, residentId: task.resident_id, time: task.due_at?.slice(11,16), visibility: "private" }));
  });

  ((shoots.data as { id: string; resident_id: string | null; status: string; shoot_date: string | null; call_time: string | null; location: string | null }[]) ?? [])
    .filter((s) => s.shoot_date && s.status !== "cancelled")
    .forEach((s) =>
      entries.push({
        id: `shoot-${s.id}`,
        date: s.shoot_date?.slice(0, 10) ?? "",
        kind: "shoot",
        title: names.get(s.resident_id ?? "") ?? "Shoot day",
        note: [s.call_time ?? "", s.location ?? ""].filter(Boolean).join(" · ") || s.status,
        to: "/app/shoots",
        residentId: s.resident_id,
        time: s.call_time ?? undefined,
      })
    );

  ((content.data as { id: string; ref_no: number; title: string; stage: string; resident_id: string | null; planned_at: string | null; metrics_due_at: string | null }[]) ?? []).forEach((c) => {
    const planned = c.planned_at?.slice(0, 10);
    if (planned && planned >= from && planned <= to && c.stage !== "Posted") {
      entries.push({
        id: `post-${c.id}`,
        date: planned,
        kind: "post",
        title: c.title,
        note: `${c.stage} · ${names.get(c.resident_id ?? "") ?? "Studio"}`,
        to: `/app/content?ref=${c.ref_no}`,
        residentId: c.resident_id,
      });
    }
    const due = c.metrics_due_at?.slice(0, 10);
    if (due && due >= from && due <= to) {
      entries.push({
        id: `num-${c.id}`,
        date: due,
        kind: "numbers",
        title: c.title,
        note: "Numbers due",
        to: `/app/content?ref=${c.ref_no}`,
        residentId: c.resident_id,
      });
    }
  });

  ((events.data as { id: string; title: string; slug: string; starts_at: string; venue: string | null }[]) ?? []).forEach((e) =>
    entries.push({
      id: `event-${e.id}`,
      date: e.starts_at.slice(0, 10),
      kind: "event",
      title: e.title,
      note: e.venue ?? "Event",
      to: "/app/events",
    })
  );

  blocks.forEach((b) => {
    const who = b.owner_kind === "resident" ? names.get(b.resident_id ?? "") ?? "Client" : "Team member";
    occurrencesInRange(b, from, to).forEach((d) =>
      entries.push({
        id: `busy-${b.id}-${d}`,
        date: d,
        kind: "busy",
        title: b.title,
        note: `${who} · ${timeLabel(b)}${b.strictness === "hard" ? " · do not schedule" : ""}`,
        userId: b.owner_user_id,
        residentId: b.resident_id,
        strictness: b.strictness,
      })
    );
  });

  const visibleItemIds = new Set(calendarItems.map((item) => item.id));
  calendarItems.forEach((item) => {
    occurrencesInRange(itemAsBlock(item), from, to).forEach((date) => entries.push({
      id: `personal-${item.id}-${date}`,
      date,
      kind: "personal",
      title: item.title,
      note: [item.location, item.work_label].filter(Boolean).join(" · ") || (item.visibility === "private" ? "Private" : "Shared with team"),
      to: item.work_path ?? undefined,
      userId: item.owner_user_id,
      strictness: item.strictness as "warn" | "hard",
      time: item.all_day ? undefined : item.start_time?.slice(0, 5),
      endTime: item.all_day ? undefined : item.end_time?.slice(0, 5),
      allDay: item.all_day,
      ownerName: personNames.get(item.owner_user_id) ?? "Team member",
      visibility: item.visibility as "private" | "team",
      calendarItem: item,
    }));
  });

  ((busySlotsRes.data ?? []) as never[]).forEach((raw) => {
    const slot = raw as import("@/lib/calendar").CalendarBusySlot;
    if (visibleItemIds.has(slot.calendar_item_id)) return;
    const block = slotAsBlock(slot);
    occurrencesInRange(block, from, to).forEach((date) => entries.push({
      id: `private-busy-${slot.calendar_item_id}-${date}`,
      date,
      kind: "busy",
      title: "Busy",
      note: `${personNames.get(slot.owner_user_id) ?? "Team member"} · ${timeLabel(block)}`,
      userId: slot.owner_user_id,
      strictness: slot.strictness as "warn" | "hard",
      time: slot.all_day ? undefined : slot.start_time?.slice(0, 5),
      endTime: slot.all_day ? undefined : slot.end_time?.slice(0, 5),
      allDay: slot.all_day,
      ownerName: personNames.get(slot.owner_user_id) ?? "Team member",
      visibility: "private",
    }));
  });

  entries.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
  return { entries, blocks, residents, people, calendarItems };
}

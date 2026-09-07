import { supabase } from "@/integrations/supabase/client";
import { AvailabilityBlock, occurrencesInRange, timeLabel } from "@/lib/recurrence";

export type EntryKind = "shoot" | "post" | "numbers" | "event" | "busy";

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
};

export const KIND_LABEL: Record<EntryKind, string> = {
  shoot: "Shoot",
  post: "Post",
  numbers: "Numbers",
  event: "Event",
  busy: "Busy",
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
};

/** Everything dated between two days: shoots, posts, numbers due, events and busy blocks. */
export async function loadCalendar(from: string, to: string): Promise<CalendarData> {
  const [shoots, content, events, blocksRes, residentsRes, peopleRes] = await Promise.all([
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
    supabase.from("residents").select("id, name").order("name"),
    supabase.from("team_members").select("user_id, display_name, email"),
  ]);

  const residents = (residentsRes.data as { id: string; name: string }[]) ?? [];
  const names = new Map(residents.map((r) => [r.id, r.name]));
  const people = (peopleRes.data as { user_id: string; display_name: string | null; email: string }[]) ?? [];
  const blocks = ((blocksRes.data as unknown as AvailabilityBlock[]) ?? []).map((b) => ({
    ...b,
    byweekday: b.byweekday ?? [],
  }));

  const entries: CalendarEntry[] = [];

  ((shoots.data as { id: string; resident_id: string | null; status: string; shoot_date: string | null; call_time: string | null; location: string | null }[]) ?? [])
    .filter((s) => s.shoot_date && s.status !== "cancelled")
    .forEach((s) =>
      entries.push({
        id: `shoot-${s.id}`,
        date: s.shoot_date!.slice(0, 10),
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

  entries.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
  return { entries, blocks, residents, people };
}

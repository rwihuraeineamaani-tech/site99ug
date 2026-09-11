import { supabase } from "@/integrations/supabase/client";

export type ActorKind = "staff" | "client";

export type ActivityRow = {
  id: string;
  actor_id: string;
  actor_kind: string;
  area: string;
  action: string;
  summary: string | null;
  path: string | null;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
};

export type PresenceRow = {
  user_id: string;
  last_seen_at: string;
  session_started_at: string;
  current_path: string | null;
  user_agent: string | null;
};

export type PersonRef = {
  user_id: string;
  name: string;
  detail: string;
  kind: ActorKind;
};

export const ACTIVITY_AREAS = [
  "Dashboard",
  "Finance",
  "Content",
  "Shoots",
  "Sales",
  "Legal",
  "Strategy",
  "Residents",
  "Management",
  "Admin",
  "Communication",
  "General",
] as const;

/** Turn a route into a plain-English area name. */
export function areaFromPath(path: string): string {
  const p = path.toLowerCase();
  if (p.startsWith("/app/finance")) return "Finance";
  if (p.startsWith("/app/content")) return "Content";
  if (p.startsWith("/app/shoots")) return "Shoots";
  if (p.startsWith("/app/sales")) return "Sales";
  if (p.startsWith("/app/legal")) return "Legal";
  if (p.startsWith("/app/strategy")) return "Strategy";
  if (p.startsWith("/app/residents")) return "Residents";
  if (p.startsWith("/app/ops") || p.startsWith("/app/equipment")) return "Management";
  if (p.startsWith("/app/system-admin") || p.startsWith("/app/team")) return "Admin";
  if (p.startsWith("/app/chat") || p.startsWith("/app/briefs") || p.startsWith("/app/announcements")) return "Communication";
  if (p.startsWith("/portal")) return "Client portal";
  if (p === "/app" || p.startsWith("/app/todo") || p.startsWith("/app/calendar") || p.startsWith("/app/approvals")) return "Dashboard";
  return "General";
}

/** Friendly page name for a route. */
export function pageLabel(path: string): string {
  const clean = path.split("?")[0].replace(/\/$/, "");
  if (clean === "/app" || clean === "") return "Dashboard";
  const parts = clean.split("/").filter((x) => x && x !== "app" && x !== "portal");
  const named = parts.filter((p) => !/^[0-9a-f-]{16,}$/i.test(p));
  if (!named.length) return "Dashboard";
  return named.map((p) => p.replace(/-/g, " ")).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" · ");
}

type LogInput = {
  area?: string;
  action: string;
  summary?: string;
  path?: string;
  entityType?: string;
  entityId?: string;
  actorKind?: ActorKind;
  detail?: Record<string, unknown>;
};

/** Record one line on the activity trail. Never throws — tracking must not break work. */
export async function logActivity(input: LogInput): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id;
    if (!uid) return;
    const path = input.path ?? (typeof window !== "undefined" ? window.location.pathname : null);
    await supabase.from("activity_log").insert({
      actor_id: uid,
      actor_kind: input.actorKind ?? "staff",
      area: input.area ?? (path ? areaFromPath(path) : "General"),
      action: input.action,
      summary: input.summary ?? null,
      path,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      detail: (input.detail ?? {}) as never,
    });
  } catch {
    /* tracking is best effort */
  }
}

export async function touchPresence(path: string, userAgent?: string) {
  try {
    await supabase.rpc("touch_presence", { _path: path, _user_agent: userAgent ?? null });
  } catch {
    /* best effort */
  }
}

export type TrailData = {
  activity: ActivityRow[];
  presence: PresenceRow[];
  people: Record<string, PersonRef>;
};

/** Load the trail, who is online, and who each person is. */
export async function loadActivityTrail(days = 7, limit = 400): Promise<TrailData> {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const [activity, presence, team, residentUsers, residents, roles] = await Promise.all([
    supabase.from("activity_log").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(limit),
    supabase.from("user_presence").select("*").order("last_seen_at", { ascending: false }),
    supabase.from("team_members").select("user_id, display_name, email, title"),
    supabase.from("resident_users").select("user_id, email, resident_id"),
    supabase.from("residents").select("id, name"),
    supabase.from("user_roles").select("user_id, role"),
  ]);

  const residentName = new Map((residents.data ?? []).map((r) => [r.id, r.name as string]));
  const roleBy = new Map<string, string[]>();
  for (const r of roles.data ?? []) {
    const list = roleBy.get(r.user_id) ?? [];
    list.push(r.role as string);
    roleBy.set(r.user_id, list);
  }

  const people: Record<string, PersonRef> = {};
  for (const m of team.data ?? []) {
    if (!m.user_id) continue;
    people[m.user_id] = {
      user_id: m.user_id,
      name: m.display_name || m.email || "Team member",
      detail: m.title || (roleBy.get(m.user_id) ?? []).join(", ") || "Team",
      kind: "staff",
    };
  }
  for (const u of residentUsers.data ?? []) {
    if (!u.user_id || people[u.user_id]) continue;
    people[u.user_id] = {
      user_id: u.user_id,
      name: u.email || "Client user",
      detail: residentName.get(u.resident_id) ?? "Client",
      kind: "client",
    };
  }

  return {
    activity: (activity.data ?? []) as ActivityRow[],
    presence: (presence.data ?? []) as PresenceRow[],
    people,
  };
}

export function personFor(people: Record<string, PersonRef>, userId: string): PersonRef {
  return people[userId] ?? { user_id: userId, name: "Unknown person", detail: "No profile", kind: "staff" };
}

export type OnlineState = "online" | "away" | "offline";

export function onlineState(lastSeen: string): OnlineState {
  const mins = (Date.now() - Date.parse(lastSeen)) / 60000;
  if (mins <= 5) return "online";
  if (mins <= 30) return "away";
  return "offline";
}

/** "2h 14m" style length of time. */
export function durationLabel(fromIso: string, toIso?: string): string {
  const ms = Math.max(0, (toIso ? Date.parse(toIso) : Date.now()) - Date.parse(fromIso));
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

/** Total minutes a person spent on the system on a given day, from their trail lines. */
export function timeOnToday(rows: ActivityRow[], userId: string): number {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const stamps = rows
    .filter((r) => r.actor_id === userId && Date.parse(r.created_at) >= start.getTime())
    .map((r) => Date.parse(r.created_at))
    .sort((a, b) => a - b);
  if (stamps.length < 2) return stamps.length ? 1 : 0;
  let total = 0;
  for (let i = 1; i < stamps.length; i += 1) {
    const gap = stamps[i] - stamps[i - 1];
    total += gap <= 15 * 60000 ? gap : 60000;
  }
  return Math.round(total / 60000);
}

export function minutesLabel(mins: number): string {
  if (!mins) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

export function activityToCsv(rows: ActivityRow[], people: Record<string, PersonRef>): string {
  const head = ["When", "Person", "Type", "Area", "Action", "Detail", "Page"];
  const body = rows.map((r) => {
    const p = personFor(people, r.actor_id);
    return [
      new Date(r.created_at).toLocaleString(),
      p.name,
      p.kind === "client" ? "Client" : "Team",
      r.area,
      r.action.replace(/_/g, " "),
      r.summary ?? "",
      r.path ?? "",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",");
  });
  return [head.join(","), ...body].join("\n");
}

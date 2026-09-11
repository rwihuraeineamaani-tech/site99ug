import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Activity, Download, RefreshCcw, Users, Handshake } from "lucide-react";
import StatCard from "@/components/admin/StatCard";
import { StatusChip } from "@/components/system";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  activityToCsv,
  durationLabel,
  loadActivityTrail,
  minutesLabel,
  onlineState,
  pageLabel,
  personFor,
  timeOnToday,
  type PresenceRow,
  type TrailData,
} from "@/lib/activity";

const field = "field text-sm";
const empty: TrailData = { activity: [], presence: [], people: {} };

export default function ActivityTrail() {
  const [data, setData] = useState<TrailData>(empty);
  const [loading, setLoading] = useState(true);
  const [who, setWho] = useState<"all" | "staff" | "client">("all");
  const [area, setArea] = useState("all");
  const [person, setPerson] = useState("all");
  const [days, setDays] = useState(7);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      setData(await loadActivityTrail(days));
    } catch (e) {
      toast.error((e as Error).message);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [days]);

  useEffect(() => {
    const channel = supabase
      .channel("activity-trail")
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_log" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "user_presence" }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [days]);

  const split = useMemo(() => {
    const staff: PresenceRow[] = [];
    const clients: PresenceRow[] = [];
    for (const p of data.presence) {
      if (onlineState(p.last_seen_at) === "offline") continue;
      (personFor(data.people, p.user_id).kind === "client" ? clients : staff).push(p);
    }
    return { staff, clients };
  }, [data]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.activity.filter((r) => {
      const p = personFor(data.people, r.actor_id);
      if (who !== "all" && p.kind !== who) return false;
      if (area !== "all" && r.area !== area) return false;
      if (person !== "all" && r.actor_id !== person) return false;
      if (!q) return true;
      return `${p.name} ${r.area} ${r.action} ${r.summary ?? ""} ${r.path ?? ""}`.toLowerCase().includes(q);
    });
  }, [data, who, area, person, search]);

  const areas = useMemo(() => Array.from(new Set(data.activity.map((r) => r.area))).sort(), [data]);
  const todayCount = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return data.activity.filter((r) => Date.parse(r.created_at) >= start.getTime()).length;
  }, [data]);
  const busiest = useMemo(() => {
    const tally = new Map<string, number>();
    for (const r of data.activity) tally.set(r.area, (tally.get(r.area) ?? 0) + 1);
    return [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  }, [data]);

  const exportCsv = () => {
    const blob = new Blob([activityToCsv(rows, data.people)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity-trail-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const board = (title: string, list: PresenceRow[], icon: JSX.Element, note: string) => (
    <section className="surface rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <strong className="text-sm">{title}</strong>
        <span className="ml-auto text-xs text-ink-faint">{list.length} on now</span>
      </div>
      {list.length ? (
        <ul className="divide-y divide-rule">
          {list.map((p) => {
            const who = personFor(data.people, p.user_id);
            const state = onlineState(p.last_seen_at);
            return (
              <li key={p.user_id} className="py-3 flex flex-wrap items-center gap-3 text-sm">
                <span className={`h-2 w-2 rounded-full ${state === "online" ? "bg-state-go" : "bg-state-wait"}`} />
                <div className="min-w-0">
                  <div className="font-medium truncate">{who.name}</div>
                  <div className="text-xs text-ink-faint truncate">{who.detail}</div>
                </div>
                <div className="ml-auto text-right text-xs text-ink-faint">
                  <div>{p.current_path ? pageLabel(p.current_path) : "—"}</div>
                  <div>
                    {state === "online" ? "On for" : "Away, was on"} {durationLabel(p.session_started_at)} ·{" "}
                    {minutesLabel(timeOnToday(data.activity, p.user_id))} today
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-ink-soft py-4">{note}</p>
      )}
    </section>
  );

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Team on now" value={split.staff.length} hint="active in the last 30 minutes" />
        <StatCard label="Clients on now" value={split.clients.length} hint="client portal users" />
        <StatCard label="Actions today" value={todayCount} hint="pages opened and work done" />
        <StatCard label="Busiest area" value={busiest} hint={`last ${days} days`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {board("Internal team", split.staff, <Users className="h-4 w-4 text-signal" />, "Nobody from the team is on right now.")}
        {board("Clients / residents", split.clients, <Handshake className="h-4 w-4 text-signal" />, "No client is on the portal right now.")}
      </div>

      <section>
        <div className="flex flex-wrap gap-2 items-center mb-4">
          <select className={`${field} w-auto`} value={who} onChange={(e) => setWho(e.target.value as typeof who)}>
            <option value="all">Everyone</option>
            <option value="staff">Team only</option>
            <option value="client">Clients only</option>
          </select>
          <select className={`${field} w-auto`} value={person} onChange={(e) => setPerson(e.target.value)}>
            <option value="all">Any person</option>
            {Object.values(data.people)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((p) => (
                <option key={p.user_id} value={p.user_id}>
                  {p.name}
                </option>
              ))}
          </select>
          <select className={`${field} w-auto`} value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="all">All areas</option>
            {areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <select className={`${field} w-auto`} value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={1}>Today</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <input className={`${field} w-auto min-w-[180px]`} placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button size="sm" variant="outline" onClick={() => void load()}>
            <RefreshCcw className="h-4 w-4" /> Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows.length}>
            <Download className="h-4 w-4" /> Export
          </Button>
        </div>

        <ul className="divide-y divide-rule border-y border-rule">
          {loading && <li className="py-8 text-sm text-ink-soft">Loading…</li>}
          {!loading && !rows.length && <li className="py-8 text-sm text-ink-soft">Nothing recorded for this filter yet.</li>}
          {!loading &&
            rows.map((r) => {
              const p = personFor(data.people, r.actor_id);
              return (
                <li key={r.id} className="py-3 flex flex-wrap gap-3 items-start text-sm">
                  <Activity className="h-4 w-4 text-signal mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong>{p.name}</strong>
                      <StatusChip value={p.kind === "client" ? "Client" : "Team"} tone={p.kind === "client" ? "amber" : "neutral"} />
                      <StatusChip value={r.area} tone="neutral" />
                    </div>
                    <div className="text-ink-soft">{r.summary || r.action.replace(/_/g, " ")}</div>
                  </div>
                  <div className="text-xs text-ink-faint whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</div>
                </li>
              );
            })}
        </ul>
      </section>
    </div>
  );
}

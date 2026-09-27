import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SectionPage from "@/components/system/SectionPage";
import { useMyRoles } from "@/hooks/useMyRoles";
import { kampalaDay } from "@/components/dashboard/ClockInCard";

type Settings = {
  enabled: boolean; enforce_cutoff: boolean; cutoff_time: string; grace_min: number; work_days: number[];
  require_clockout: boolean; exempt_user_ids: string[]; geofence_enabled: boolean; geo_lat: number | null; geo_lng: number | null; geo_radius_m: number;
};
type Rec = { user_id: string; day: string; clock_in_at: string | null; clock_out_at: string | null; status: string; late_minutes: number; note: string | null; excuse_reason: string | null };
type Member = { user_id: string; display_name: string | null; email: string | null };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const t = (n: string) => supabase.from(n as never);
const hm = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—");

export default function Attendance() {
  const { has } = useMyRoles();
  const canManage = has("admin", "managing_director");
  const [s, setS] = useState<Settings | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [recs, setRecs] = useState<Rec[]>([]);
  const [month, setMonth] = useState(kampalaDay().slice(0, 7));
  const [weight, setWeight] = useState(5);
  const [excuse, setExcuse] = useState<{ user: string; day: string; reason: string } | null>(null);
  const today = kampalaDay();

  const load = async () => {
    const end = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).toISOString().slice(0, 10);
    const [a, m, r, k] = await Promise.all([
      t("attendance_settings").select("*").maybeSingle(),
      supabase.from("team_members").select("user_id,display_name,email"),
      t("attendance_records").select("*").gte("day", `${month}-01`).lte("day", end < today ? (today.startsWith(month) ? today : end) : end),
      t("kpi_settings").select("weights").maybeSingle(),
    ]);
    setS(a.data as unknown as Settings);
    setMembers(((m.data as Member[]) ?? []).filter((x) => x.user_id));
    setRecs((r.data as unknown as Rec[]) ?? []);
    const w = (k.data as { weights?: Record<string, number> } | null)?.weights?.attendance;
    setWeight(w ?? 5);
  };
  useEffect(() => { load(); }, [month]);

  const tracked = useMemo(() => members.filter((m) => !s?.exempt_user_ids.includes(m.user_id)), [members, s]);
  const todayRecs = new Map(recs.filter((r) => r.day === today).map((r) => [r.user_id, r]));
  const name = (m: Member) => m.display_name || m.email || "Someone";

  const report = useMemo(() => {
    if (!s) return [];
    const days: string[] = [];
    const c = new Date(`${month}-01T00:00:00Z`);
    while (c.toISOString().slice(0, 7) === month && c.toISOString().slice(0, 10) <= today) {
      const d = c.toISOString().slice(0, 10);
      if (s.work_days.includes(c.getUTCDay()) && d !== today) days.push(d);
      c.setUTCDate(c.getUTCDate() + 1);
    }
    return tracked.map((m) => {
      const mine = recs.filter((r) => r.user_id === m.user_id);
      const by = new Map(mine.map((r) => [r.day, r]));
      let onTime = 0, late = 0, missed = 0, excused = 0;
      days.forEach((d) => {
        const r = by.get(d);
        if (!r) missed++;
        else if (r.status === "excused") excused++;
        else if (r.status === "late") late++;
        else onTime++;
      });
      const ins = mine.filter((r) => r.clock_in_at).map((r) => { const d = new Date(r.clock_in_at!); return ((d.getUTCHours() + 3) % 24) * 60 + d.getUTCMinutes(); });
      const avg = ins.length ? Math.round(ins.reduce((a, b) => a + b, 0) / ins.length) : null;
      const req = days.length - excused;
      return { m, onTime, late, missed, excused, pct: req ? Math.round((onTime / req) * 100) : null, avg: avg === null ? "—" : `${String(Math.floor(avg / 60)).padStart(2, "0")}:${String(avg % 60).padStart(2, "0")}` };
    });
  }, [s, recs, tracked, month, today]);

  const save = async (patch: Partial<Settings>) => {
    if (!s) return;
    const next = { ...s, ...patch };
    setS(next);
    const { error } = await t("attendance_settings").update({ ...patch, updated_at: new Date().toISOString() } as never).eq("id", 1);
    if (error) toast.error(error.message);
  };
  const saveWeight = async () => {
    const { data } = await t("kpi_settings").select("*").maybeSingle();
    const row = data as { id?: string; weights?: Record<string, number> } | null;
    if (!row) return toast.error("KPI settings not found");
    const { error } = await t("kpi_settings").update({ weights: { ...(row.weights ?? {}), attendance: weight } } as never).eq("id", row.id as never);
    error ? toast.error(error.message) : toast.success("KPI weight saved");
  };
  const useMyLocation = () =>
    navigator.geolocation?.getCurrentPosition(
      (p) => save({ geo_lat: p.coords.latitude, geo_lng: p.coords.longitude }),
      () => toast.error("Couldn't read your location"),
    );
  const doExcuse = async () => {
    if (!excuse) return;
    const { error } = await supabase.rpc("excuse_attendance" as never, { _user: excuse.user, _day: excuse.day, _reason: excuse.reason } as never);
    if (error) return toast.error(error.message);
    toast.success("Day excused");
    setExcuse(null);
    load();
  };
  const exportCsv = () => {
    const rows = [["Name", "On time", "Late", "Missed", "Excused", "On-time %", "Average arrival"], ...report.map((r) => [name(r.m), r.onTime, r.late, r.missed, r.excused, r.pct ?? "", r.avg])];
    const blob = new Blob([rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `clock-in-${month}.csv`;
    a.click();
  };

  if (!s) return <SectionPage eyebrow="Management" title="Clock-in." lede="Loading…" path="/app/ops/attendance"><div /></SectionPage>;
  const inCount = tracked.filter((m) => todayRecs.get(m.user_id)?.clock_in_at).length;
  const lateCount = tracked.filter((m) => todayRecs.get(m.user_id)?.status === "late").length;

  return (
    <SectionPage
      eyebrow="Management"
      title="Clock-in."
      lede={`${inCount} of ${tracked.length} people in today${lateCount ? `, ${lateCount} late` : ""}. ${canManage ? "You set the rules below." : "Only the MD changes the rules."}`}
      path="/app/ops/attendance"
    >
      <div className="grid gap-6">
        <section className="rounded-2xl border border-rule bg-card p-4">
          <h2 className="mb-3 font-medium">Today</h2>
          <div className="divide-y divide-rule">
            {tracked.map((m) => {
              const r = todayRecs.get(m.user_id);
              const label = r?.status === "excused" ? `Excused — ${r.excuse_reason}` : r?.clock_in_at ? (r.status === "late" ? `Late by ${r.late_minutes} min` : "On time") : "Not in yet";
              const tone = r?.status === "late" || !r ? "text-signal" : "text-ink-soft";
              return (
                <div key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="font-medium">{name(m)}</span>
                  <span className="flex flex-wrap items-center gap-3">
                    <span className={tone}>{label}</span>
                    <span className="text-ink-soft">in {hm(r?.clock_in_at ?? null)} · out {hm(r?.clock_out_at ?? null)}</span>
                    {r?.note && <span className="text-xs text-ink-soft">“{r.note}”</span>}
                    {canManage && r?.status !== "excused" && (
                      <button className="text-xs underline focus-ring" onClick={() => setExcuse({ user: m.user_id, day: today, reason: "" })}>Excuse</button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {excuse && (
          <section className="rounded-2xl border border-signal/50 bg-card p-4">
            <h2 className="mb-2 font-medium">Excuse a day for {name(members.find((m) => m.user_id === excuse.user) ?? { user_id: "", display_name: null, email: null })}</h2>
            <div className="flex flex-wrap gap-2">
              <input type="date" className="field" value={excuse.day} max={today} onChange={(e) => setExcuse({ ...excuse, day: e.target.value })} />
              <input className="field flex-1" placeholder="Reason (sick, leave, client meeting…)" value={excuse.reason} onChange={(e) => setExcuse({ ...excuse, reason: e.target.value })} />
              <button className="press rounded-full bg-signal px-4 py-2 text-sm text-background" onClick={doExcuse}>Excuse</button>
              <button className="press rounded-full border border-rule px-4 py-2 text-sm" onClick={() => setExcuse(null)}>Cancel</button>
            </div>
            <p className="mt-2 text-xs text-ink-soft">Excused days don't count against the person's KPI. Every excuse is logged.</p>
          </section>
        )}

        <section className="rounded-2xl border border-rule bg-card p-4">
          <h2 className="mb-3 font-medium">Rules {canManage ? "" : "(view only)"}</h2>
          <fieldset disabled={!canManage} className="grid gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={s.enabled} onChange={(e) => save({ enabled: e.target.checked })} /> Clock-in is on for the company</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={s.enforce_cutoff} onChange={(e) => save({ enforce_cutoff: e.target.checked })} /> People must clock in before a set time</label>
            {s.enforce_cutoff && (
              <div className="flex flex-wrap items-center gap-3 pl-6">
                <span>Clock in by</span>
                <input type="time" className="field" value={s.cutoff_time.slice(0, 5)} onChange={(e) => save({ cutoff_time: e.target.value })} />
                <span>with</span>
                <input type="number" min={0} max={120} className="field w-20" value={s.grace_min} onChange={(e) => save({ grace_min: Number(e.target.value) })} />
                <span>minutes grace (Kampala time)</span>
              </div>
            )}
            <div>
              <p className="mb-1">Working days</p>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((d, i) => (
                  <label key={d} className="flex items-center gap-1 rounded-full border border-rule px-3 py-1">
                    <input type="checkbox" checked={s.work_days.includes(i)} onChange={(e) => save({ work_days: e.target.checked ? [...s.work_days, i].sort() : s.work_days.filter((x) => x !== i) })} /> {d}
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2"><input type="checkbox" checked={s.require_clockout} onChange={(e) => save({ require_clockout: e.target.checked })} /> Ask people to clock out too</label>
            <div>
              <label className="flex items-center gap-2"><input type="checkbox" checked={s.geofence_enabled} onChange={(e) => save({ geofence_enabled: e.target.checked })} /> Only allow clock-in at the office (uses phone location)</label>
              {s.geofence_enabled && (
                <div className="mt-2 flex flex-wrap items-center gap-3 pl-6">
                  <span className="text-ink-soft">{s.geo_lat ? `Office set (${s.geo_lat.toFixed(4)}, ${s.geo_lng?.toFixed(4)})` : "Office location not set yet"}</span>
                  <button type="button" className="press rounded-full border border-rule px-3 py-1" onClick={useMyLocation}>Use where I am now</button>
                  <span>within</span>
                  <input type="number" min={50} className="field w-24" value={s.geo_radius_m} onChange={(e) => save({ geo_radius_m: Number(e.target.value) })} />
                  <span>metres</span>
                </div>
              )}
            </div>
            <div>
              <p className="mb-1">Who doesn't need to clock in</p>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => (
                  <label key={m.user_id} className="flex items-center gap-1 rounded-full border border-rule px-3 py-1">
                    <input type="checkbox" checked={s.exempt_user_ids.includes(m.user_id)} onChange={(e) => save({ exempt_user_ids: e.target.checked ? [...s.exempt_user_ids, m.user_id] : s.exempt_user_ids.filter((x) => x !== m.user_id) })} /> {name(m)}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span>How much it counts in the KPI score</span>
              <input type="number" min={0} max={30} className="field w-20" value={weight} onChange={(e) => setWeight(Number(e.target.value))} />
              <button type="button" className="press rounded-full border border-rule px-3 py-1" onClick={saveWeight}>Save</button>
              <span className="text-xs text-ink-soft">Weight next to the other parts (they total 100). 5 is a gentle nudge.</span>
            </div>
          </fieldset>
        </section>

        <section className="rounded-2xl border border-rule bg-card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-medium">Monthly report</h2>
            <div className="flex gap-2">
              <input type="month" className="field" value={month} onChange={(e) => setMonth(e.target.value)} />
              <button className="press rounded-full border border-rule px-3 py-1 text-sm" onClick={exportCsv}>Download CSV</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-ink-soft"><tr><th className="py-1">Name</th><th>On time</th><th>Late</th><th>Missed</th><th>Excused</th><th>On-time %</th><th>Avg arrival</th></tr></thead>
              <tbody>
                {report.map((r) => (
                  <tr key={r.m.user_id} className="border-t border-rule">
                    <td className="py-1.5">{name(r.m)}</td><td>{r.onTime}</td><td>{r.late}</td><td>{r.missed}</td><td>{r.excused}</td><td>{r.pct ?? "—"}{r.pct !== null ? "%" : ""}</td><td>{r.avg}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-ink-soft">Counts working days up to yesterday. Missed days that were really shoot days still count as present in the KPI.</p>
        </section>
      </div>
    </SectionPage>
  );
}

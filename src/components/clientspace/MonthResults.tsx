import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { METRIC_ROWS, change, loadMonthMetrics, prevMonth, type MonthMetrics } from "@/lib/clientMonth";

/** System numbers for one client month, compared with the month before. */
export default function MonthResults({ residentId, month, onLoaded }: { residentId: string; month: string; onLoaded?: (m: MonthMetrics, before: MonthMetrics | null) => void }) {
  const [m, setM] = useState<MonthMetrics | null>(null);
  const [b, setB] = useState<MonthMetrics | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let off = false;
    Promise.all([loadMonthMetrics(residentId, month), loadMonthMetrics(residentId, prevMonth(month)).catch(() => null)])
      .then(([a, p]) => { if (!off) { setM(a); setB(p); onLoaded?.(a, p); } })
      .catch((e) => !off && setErr(e.message));
    return () => { off = true; };
  }, [residentId, month]); // eslint-disable-line react-hooks/exhaustive-deps

  if (err) return <p className="text-sm text-ink-faint">{err}</p>;
  if (!m) return <p className="text-sm text-ink-faint">Counting this month…</p>;
  const compare = [
    { name: "Posted", now: m.posted, before: b?.posted ?? 0 },
    { name: "On time", now: m.posted_on_time, before: b?.posted_on_time ?? 0 },
    { name: "Shoots", now: m.shoots, before: b?.shoots ?? 0 },
  ];
  const weeks = (m.weeks ?? []).map((w) => ({ ...w, label: new Date(w.week).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) }));
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {METRIC_ROWS.map((r) => {
          const v = m[r.key] as number | null; const c = change(v, b ? (b[r.key] as number | null) : null);
          return (
            <div key={r.key} className="rounded-xl border border-hairline p-3">
              <div className="text-[11px] text-ink-faint">{r.label}</div>
              <div className="mt-1 text-xl font-semibold tabular-nums">{v == null ? "–" : v.toLocaleString("en-GB")}</div>
              {c != null && <div className={`text-xs ${c >= 0 ? "text-acc-lime" : "text-destructive"}`}>{c > 0 ? "+" : ""}{c}% vs last month</div>}
            </div>
          );
        })}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-hairline p-3">
          <div className="text-sm font-medium">Work delivered</div>
          <p className="text-xs text-ink-faint">Grey is last month, red is this month.</p>
          <div className="mt-2 h-48">
            <ResponsiveContainer><BarChart data={compare}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="name" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} width={28} /><Tooltip /><Bar isAnimationActive={false} dataKey="before" fill="hsl(var(--muted-foreground))" radius={4} /><Bar isAnimationActive={false} dataKey="now" fill="hsl(var(--primary))" radius={4} /></BarChart></ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border border-hairline p-3">
          <div className="text-sm font-medium">Weekly reach</div>
          <p className="text-xs text-ink-faint">How many people saw the account each week, from the numbers your Handler records.</p>
          <div className="mt-2 h-48">
            {weeks.length ? (
              <ResponsiveContainer><LineChart data={weeks}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="label" fontSize={11} /><YAxis fontSize={11} width={40} /><Tooltip /><Line dataKey="reach" stroke="hsl(var(--primary))" strokeWidth={2} dot /></LineChart></ResponsiveContainer>
            ) : <p className="pt-16 text-center text-xs text-ink-faint">No weekly numbers recorded yet this month.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

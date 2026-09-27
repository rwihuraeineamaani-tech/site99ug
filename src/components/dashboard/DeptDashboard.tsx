import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Info, Lock } from "lucide-react";
import { DEPT_LABEL, loadDeptBoard, type ChartSpec, type DeptBoard, type DeptKey } from "@/lib/deptMetrics";

const COLORS = ["hsl(var(--signal))", "hsl(var(--ink-soft))", "hsl(var(--ink-faint))"];
const short = (v: number) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : Math.abs(v) >= 1e3 ? `${Math.round(v / 1e3)}k` : String(v));
const ugx = (v: number) => `UGX ${Math.round(v).toLocaleString()}`;

const INTRO: Record<DeptKey, string> = {
  exec: "The whole company on one page: money, clients, output and goals.",
  finance: "Cash, what's owed to us and what we owe. Every figure comes from the cashbook and invoices.",
  sales: "Your pipeline from first contact to signed client.",
  content: "Production flow: ideas, shoots, edits and posts.",
  strategy: "Client goals and strategy maps, and what needs sign-off.",
  legal: "Contract risk: what's ending, what's unsigned.",
  relations: "Client health: follow-ups, onboarding and renewals.",
  talent: "Bookings, talent spend and how campaigns performed.",
  people: "Team targets, assigned work and headcount.",
  ops: "Shoots, gear and team workload.",
  personal: "Your own work, tasks and targets.",
};

function BigChart({ c, canMoney }: { c: ChartSpec; canMoney: boolean }) {
  const [open, setOpen] = useState(false);
  const locked = c.money && !canMoney;
  const empty = !c.data.length || c.data.every((d) => c.series.every((s) => !Number(d[s.key])));
  const fmt = (v: number) => (c.money ? ugx(v) : v.toLocaleString());
  const axis = { stroke: "hsl(var(--ink-faint))", fontSize: 11, tickLine: false, axisLine: false };
  const tip = { contentStyle: { background: "hsl(var(--paper-raised))", border: "1px solid hsl(var(--rule))", borderRadius: 8, fontSize: 12 }, formatter: (v: number) => fmt(v) };
  const chart = (() => {
    if (c.kind === "area")
      return (
        <AreaChart data={c.data}>
          <defs>{c.series.map((s, i) => <linearGradient key={s.key} id={`g-${c.title.length}-${s.key}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={COLORS[i]} stopOpacity={0.35} /><stop offset="100%" stopColor={COLORS[i]} stopOpacity={0} /></linearGradient>)}</defs>
          <CartesianGrid stroke="hsl(var(--rule))" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={c.xKey} {...axis} /><YAxis {...axis} tickFormatter={short} width={44} />
          <Tooltip {...tip} />{c.series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {c.series.map((s, i) => <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={COLORS[i]} strokeWidth={2} fill={`url(#g-${c.title.length}-${s.key})`} />)}
        </AreaChart>
      );
    if (c.kind === "line")
      return (
        <LineChart data={c.data}>
          <CartesianGrid stroke="hsl(var(--rule))" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={c.xKey} {...axis} /><YAxis {...axis} tickFormatter={short} width={44} />
          <Tooltip {...tip} />{c.series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {c.series.map((s, i) => <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={COLORS[i]} strokeWidth={2.5} dot={{ r: 3 }} />)}
        </LineChart>
      );
    const h = c.kind === "hbar";
    return (
      <BarChart data={c.data} layout={h ? "vertical" : "horizontal"} margin={h ? { left: 8 } : undefined}>
        <CartesianGrid stroke="hsl(var(--rule))" strokeDasharray="3 3" vertical={h} horizontal={!h} />
        {h ? <><XAxis type="number" {...axis} tickFormatter={short} /><YAxis type="category" dataKey={c.xKey} {...axis} width={110} /></> : <><XAxis dataKey={c.xKey} {...axis} /><YAxis {...axis} tickFormatter={short} width={44} /></>}
        <Tooltip {...tip} cursor={{ fill: "hsl(var(--rule) / 0.4)" }} />{c.series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {c.series.map((s, i) => <Bar key={s.key} dataKey={s.key} name={s.label} fill={COLORS[i]} radius={h ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={36} />)}
      </BarChart>
    );
  })();
  const height = c.kind === "hbar" ? Math.max(240, c.data.length * 40) : c.wide ? 320 : 260;
  return (
    <section className={`tile rounded-2xl p-4 sm:p-5 ${c.wide ? "lg:col-span-2" : ""}`}>
      <header className="mb-3 flex items-start justify-between gap-3">
        <h3 className="font-display text-lg leading-tight">{c.title}</h3>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={() => setOpen((o) => !o)} className="press flex items-center gap-1 rounded-full border border-rule px-2.5 py-1 eyebrow text-[10px] text-ink-soft hover:text-signal focus-ring" aria-expanded={open}><Info className="h-3 w-3" /> Explain</button>
          {c.to && <Link to={c.to} className="eyebrow text-[10px] text-signal focus-ring">Open →</Link>}
        </div>
      </header>
      <p className="mb-3 text-sm text-ink-soft">{c.explain.what}</p>
      {locked ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-rule text-sm text-ink-soft"><Lock className="h-4 w-4" />Money figures are only shown to people with Finance access.</div>
      ) : empty ? (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-rule px-6 text-center text-sm text-ink-soft">No records yet. This chart will fill in as work is recorded.</div>
      ) : (
        <div style={{ height }}><ResponsiveContainer width="100%" height="100%">{chart}</ResponsiveContainer></div>
      )}
      {open && (
        <dl className="mt-4 grid gap-3 border-t border-rule pt-4 text-sm sm:grid-cols-2">
          <div><dt className="eyebrow text-[10px] text-ink-faint">How it's worked out</dt><dd className="mt-1 text-ink-soft">{c.explain.how}</dd></div>
          <div><dt className="eyebrow text-[10px] text-ink-faint">What good looks like</dt><dd className="mt-1 text-ink-soft">{c.explain.good}</dd></div>
        </dl>
      )}
    </section>
  );
}

export default function DeptDashboard({ dept, userId, canSeeFinance }: { dept: DeptKey; userId: string | null; canSeeFinance: boolean }) {
  const [board, setBoard] = useState<DeptBoard | null>(null);
  useEffect(() => {
    let off = false;
    setBoard(null);
    loadDeptBoard(dept, userId).then((b) => !off && setBoard(b)).catch(() => !off && setBoard({ figures: [], charts: [] }));
    return () => { off = true; };
  }, [dept, userId]);

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="eyebrow text-[10px] text-signal">{DEPT_LABEL[dept]}</p>
          <p className="text-sm text-ink-soft">{INTRO[dept]}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(board?.figures ?? Array.from({ length: 4 }, () => null)).map((f, i) => {
          const body = f ? (
            <>
              <p className="eyebrow text-[10px] text-ink-faint">{f.label}</p>
              <p className="mt-2 font-display text-2xl tabular-nums sm:text-3xl">{f.money && !canSeeFinance ? "—" : typeof f.value === "number" ? (f.money ? short(f.value) : f.value.toLocaleString()) : f.value}</p>
              {f.delta != null && !(f.money && !canSeeFinance) && <p className={`mt-1 text-xs ${f.delta >= 0 ? "text-signal" : "text-ink-soft"}`}>{f.delta >= 0 ? "▲" : "▼"} {Math.abs(f.delta)}% vs last week</p>}
            </>
          ) : <div className="h-16 animate-pulse rounded bg-rule/40" />;
          return f?.to ? <Link key={i} to={f.to} className="tile rounded-2xl p-4 hover:border-signal/50 focus-ring">{body}</Link> : <div key={i} className="tile rounded-2xl p-4">{body}</div>;
        })}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {board ? board.charts.map((c) => <BigChart key={c.title} c={c} canMoney={canSeeFinance} />) : <div className="tile h-80 animate-pulse rounded-2xl lg:col-span-2" />}
      </div>
    </div>
  );
}

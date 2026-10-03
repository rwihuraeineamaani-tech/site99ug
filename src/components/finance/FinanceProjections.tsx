import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { loadProjection, type Projection } from "@/lib/financeProjections";

const short = (v: number) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : Math.abs(v) >= 1e3 ? `${Math.round(v / 1e3)}k` : String(Math.round(v)));
const ugx = (v: number) => `UGX ${Math.round(v).toLocaleString()}`;
const axis = { stroke: "hsl(var(--ink-faint))", fontSize: 11, tickLine: false, axisLine: false };
const tip = { contentStyle: { background: "hsl(var(--paper-raised))", border: "1px solid hsl(var(--rule))", borderRadius: 8, fontSize: 12 }, formatter: (v: number) => ugx(v) };

function Card({ title, explain, children, wide }: { title: string; explain: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <section className={`tile rounded-2xl p-4 sm:p-5 ${wide ? "lg:col-span-2" : ""}`}>
      <h3 className="font-display text-lg">{title}</h3>
      <p className="mt-1 text-sm text-ink-soft">{explain}</p>
      <div className="mt-4 h-72">
        <ResponsiveContainer width="100%" height="100%">{children as React.ReactElement}</ResponsiveContainer>
      </div>
    </section>
  );
}

export default function FinanceProjections({ compact = false }: { compact?: boolean }) {
  const [rate, setRate] = useState(60);
  const [horizon, setHorizon] = useState(12);
  const [p, setP] = useState<Projection | null>(null);
  useEffect(() => {
    let off = false;
    loadProjection(compact ? 6 : horizon, rate / 100).then((x) => !off && setP(x)).catch(() => !off && setP(null));
    return () => { off = true; };
  }, [rate, horizon, compact]);

  if (!p) return <div className="tile h-80 animate-pulse rounded-2xl" />;
  const end = p.months[p.months.length - 1];
  const yearIn = p.months.reduce((t, m) => t + m.contracted + m.renewals, 0);
  const lowPoint = p.months.reduce((lo, m) => (m.worst < lo.worst ? m : lo), p.months[0]);

  const figures = [
    { label: "Cash today", value: ugx(p.openingCash) },
    { label: `Expected income, ${p.months.length} months`, value: ugx(yearIn) },
    { label: `Cash at ${end?.month ?? ""}`, value: ugx(end?.cash ?? 0) },
    { label: "Runway", value: p.runwayMonths == null ? "Retainers cover costs" : `${p.runwayMonths} months` },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow text-[10px] text-signal">Projections</p>
          <p className="text-sm text-ink-soft">Where the money is heading, built from signed contracts, recurring bills, open invoices and the last six months of the cashbook.</p>
        </div>
        {compact ? (
          <Link to="/app/finance/projections" className="press focus-ring text-xs underline underline-offset-4 text-ink-soft">Open full projections</Link>
        ) : (
          <div className="flex flex-wrap items-center gap-4 text-xs text-ink-soft">
            <label className="flex items-center gap-2">Renewal chance {rate}%
              <input type="range" min={0} max={100} step={5} value={rate} onChange={(e) => setRate(Number(e.target.value))} />
            </label>
            <label className="flex items-center gap-2">Months
              <select className="rounded border border-rule bg-paper px-2 py-1" value={horizon} onChange={(e) => setHorizon(Number(e.target.value))}>
                {[6, 12, 18, 24].map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </label>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {figures.map((f) => (
          <div key={f.label} className="tile rounded-2xl p-4">
            <p className="eyebrow text-[10px] text-ink-faint">{f.label}</p>
            <p className="mt-2 font-display text-xl tabular-nums">{f.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card wide title="Cash runway, three ways" explain={`The middle line is our best estimate of cash at the end of each month. The top line assumes clients renew and pay on time, the bottom line assumes slow payers and costs 10% higher. The lowest point in the worst case is ${ugx(lowPoint?.worst ?? 0)} in ${lowPoint?.month ?? ""}.`}>
          <ComposedChart data={p.months}>
            <CartesianGrid stroke="hsl(var(--rule))" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" {...axis} /><YAxis {...axis} tickFormatter={short} width={48} />
            <Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="best" name="Good case" stroke="hsl(var(--ink-faint))" fill="hsl(var(--signal) / 0.08)" />
            <Line type="monotone" dataKey="cash" name="Expected" stroke="hsl(var(--signal))" strokeWidth={3} dot={false} />
            <Line type="monotone" dataKey="worst" name="Tough case" stroke="hsl(var(--ink-soft))" strokeDasharray="5 4" dot={false} />
          </ComposedChart>
        </Card>

        <Card title="Money coming in vs going out" explain="Bars stack signed retainers with likely renewals (contracts that end, weighted by the renewal chance). The line is monthly costs: recurring bills, or recent average spend if higher.">
          <ComposedChart data={p.months}>
            <CartesianGrid stroke="hsl(var(--rule))" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" {...axis} /><YAxis {...axis} tickFormatter={short} width={48} />
            <Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="contracted" name="Signed retainers" stackId="a" fill="hsl(var(--signal))" />
            <Bar dataKey="renewals" name="Likely renewals" stackId="a" fill="hsl(var(--ink-faint))" />
            <Line type="monotone" dataKey="costs" name="Costs" stroke="hsl(var(--ink))" strokeWidth={2} dot={false} />
          </ComposedChart>
        </Card>

        <Card title="Profit or loss each month" explain="Income minus costs for each month. Below zero means we spend more than comes in that month and dip into cash.">
          <BarChart data={p.months}>
            <CartesianGrid stroke="hsl(var(--rule))" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" {...axis} /><YAxis {...axis} tickFormatter={short} width={48} />
            <Tooltip {...tip} />
            <Bar dataKey="net" name="Net" fill="hsl(var(--signal))" />
          </BarChart>
        </Card>

        {!compact && (
          <>
            <Card title="Last six months, actual" explain="Real money in and out from the cashbook, transfers between accounts left out. Projections lean on these averages.">
              <BarChart data={p.history}>
                <CartesianGrid stroke="hsl(var(--rule))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" {...axis} /><YAxis {...axis} tickFormatter={short} width={48} />
                <Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="in" name="In" fill="hsl(var(--signal))" />
                <Bar dataKey="out" name="Out" fill="hsl(var(--ink-faint))" />
              </BarChart>
            </Card>
            <Card title="Who our income depends on" explain="Share of this month's retainers per client. One client above 30% is a risk: losing them would hurt badly.">
              <BarChart data={p.concentration} layout="vertical">
                <CartesianGrid stroke="hsl(var(--rule))" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" {...axis} tickFormatter={short} /><YAxis type="category" dataKey="name" {...axis} width={110} />
                <Tooltip {...tip} />
                <Bar dataKey="monthly" name="Monthly retainer" fill="hsl(var(--signal))" />
              </BarChart>
            </Card>
          </>
        )}
      </div>
      {!compact && (
        <p className="text-xs text-ink-faint">
          Open client invoices: {ugx(p.owedToUs)} owed to us (70% assumed collected this month). Unpaid bills: {ugx(p.weOwe)} (assumed paid this month). Recurring monthly bills: {ugx(p.recurringOut)}.
        </p>
      )}
    </div>
  );
}

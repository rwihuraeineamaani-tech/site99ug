import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Seo from "@/components/Seo";
import AppShell from "@/components/system/AppShell";
import { PageHeader, Segmented, StatusChip } from "@/components/system";
import StatCard from "@/components/admin/StatCard";
import { Button } from "@/components/ui/button";
import { useMyRoles } from "@/hooks/useMyRoles";
import { COMPONENTS, DEFAULT_SETTINGS, TARGET_METRICS, loadKpiMonth, monthLabel, monthStart, ugx, type KpiSettings, type PersonKpi } from "@/lib/kpiPay";

export const KPI_MANAGER_ROLES = ["founder", "managing_director", "operations_manager", "hr", "finance_ops"] as const;

export default function KpiPage() {
  const roles = useMyRoles();
  const [tab, setTab] = useState<"mine" | "how">("mine");
  const [month, setMonth] = useState(monthStart());
  const [me, setMe] = useState<PersonKpi | null>(null);
  const [settings, setSettings] = useState<KpiSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const manager = roles.has(...KPI_MANAGER_ROLES);

  useEffect(() => {
    if (!roles.userId) return;
    let live = true;
    setLoading(true);
    loadKpiMonth(month, roles.userId)
      .then((r) => { if (!live) return; setSettings(r.settings); setMe(r.people[0] ?? null); })
      .catch(() => undefined)
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [roles.userId, month]);

  return <AppShell eyebrow="My KPI">
    <Seo title="My KPI — Site 99" description="Your targets, score and expected pay for the month." path="/app/kpi" noindex />
    <PageHeader
      eyebrow="KPI"
      title={tab === "mine" ? "How your month is going." : "How KPIs work."}
      lede={tab === "mine" ? `${monthLabel(month)} · your targets, score and what you are on track to earn.` : "What each part means, how much it counts, and how to raise it."}
      actions={<div className="flex flex-wrap gap-2">
        <input type="month" value={month.slice(0, 7)} onChange={(e) => e.target.value && setMonth(`${e.target.value}-01`)} className="h-9 rounded-md border border-rule bg-paper-raised px-2 text-base md:text-sm" aria-label="Month" />
        {manager && <Button asChild size="sm"><Link to="/app/kpi/desk">KPI desk</Link></Button>}
      </div>}
    />
    <div className="mb-5"><Segmented value={tab} onChange={(v: "mine" | "how") => setTab(v)} options={[{ value: "mine", label: "My KPI" }, { value: "how", label: "How KPIs work" }]} /></div>

    {tab === "how" ? <HowItWorks settings={settings} /> : loading ? <p className="text-sm text-ink-faint">Loading your month…</p> : !me ? (
      <p className="rounded-lg border border-dashed border-rule p-6 text-sm text-ink-soft">You are not on the team list yet, so there is nothing to score. Ask HR to add you.</p>
    ) : <MyKpi p={me} />}
  </AppShell>;
}

function MyKpi({ p }: { p: PersonKpi }) {
  return <div className="grid gap-5">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="KPI score" value={`${p.score}%`} hint="this month so far" />
      <StatCard label="Targets" value={p.hasTargets ? `${p.targets.filter((t) => t.counts && t.met).length}/${p.targets.filter((t) => t.counts).length}` : "—"} hint={p.hasTargets ? (p.allTargetsMet ? "all hit" : "not all hit yet") : "none set yet"} />
      <StatCard label="Expected pay" value={p.pay ? ugx(p.expected) : "—"} hint="if the month ended today" />
      <StatCard label="Possible pay" value={p.pay ? ugx(p.possible) : "—"} hint="if every target is hit" />
    </div>

    <section className="rounded-lg border border-rule bg-paper-raised p-4">
      <h2 className="mb-3 text-sm font-semibold">Your targets</h2>
      {p.targets.length === 0 ? <p className="text-sm text-ink-faint">No targets set for this month yet.</p> : <div className="grid gap-3">
        {p.targets.map((t) => {
          const pct = t.target_value > 0 ? Math.min(100, Math.round((t.actual / Number(t.target_value)) * 100)) : 0;
          return <div key={t.id}>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>{t.label || TARGET_METRICS.find((m) => m.key === t.metric)?.label || t.metric}</span>
              <span className="flex items-center gap-2">
                <span className="num text-ink-soft">{t.actual} / {Number(t.target_value)}</span>
                {!t.counts && <StatusChip value={t.approval_state === "rejected" ? "Not approved" : "Awaiting Founders"} tone="neutral" />}
                {t.counts && <StatusChip value={t.met ? "Hit" : "Not yet"} tone={t.met ? "success" : "warning"} />}
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-paper-sunken"><div className="h-full rounded-full bg-signal" style={{ width: `${pct}%` }} /></div>
          </div>;
        })}
      </div>}
    </section>

    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-lg border border-rule bg-paper-raised p-4">
        <h2 className="mb-3 text-sm font-semibold">What makes up your score</h2>
        <div className="grid gap-2">
          {p.parts.map((part) => <div key={part.key} className="flex items-center justify-between gap-3 text-sm">
            <span>{part.label} <span className="text-ink-faint">· counts {part.weight}%</span></span>
            <span className="num text-ink-soft">{part.value === null ? "no data" : `${Math.round(part.value * 100)}%`}</span>
          </div>)}
        </div>
      </section>
      <section className="rounded-lg border border-rule bg-paper-raised p-4">
        <h2 className="mb-3 text-sm font-semibold">Your pay, line by line</h2>
        {!p.pay ? <p className="text-sm text-ink-faint">Your base salary hasn't been entered yet.</p> : <div className="grid gap-2 text-sm">
          {p.lines.map((l, i) => <div key={i} className="flex justify-between gap-3"><span>{l.label}</span><span className={`num ${l.amount < 0 ? "text-signal" : ""}`}>{ugx(l.amount)}</span></div>)}
          <div className="mt-2 flex justify-between border-t border-rule pt-2 font-semibold"><span>Expected</span><span className="num">{ugx(p.expected)}</span></div>
        </div>}
      </section>
    </div>
  </div>;
}

function HowItWorks({ settings }: { settings: KpiSettings }) {
  return <div className="grid gap-5">
    <section className="rounded-lg border border-rule bg-paper-raised p-4 text-sm leading-relaxed">
      <h2 className="mb-2 font-semibold">Your pay each month</h2>
      <ul className="list-disc space-y-1 pl-5 text-ink-soft">
        <li>Everyone has a <b>base salary</b>.</li>
        <li>Handlers get a <b>data allowance</b> for running their clients' social media. Transport is paid for shoot days.</li>
        <li>Hit <b>every</b> target for the month: <b>+{settings.hit_bonus_pct}%</b> of base salary. Heads of department get another <b>+{settings.head_bonus_pct}%</b> plus their head pay.</li>
        <li>Miss any target: <b>-{settings.miss_penalty_pct}%</b> of base salary.</li>
        <li>A client reaches its end-of-contract targets: the Handler earns <b>{settings.contract_end_pct}%</b> of the full contract value. If the client renews: <b>+{settings.renewal_pct}%</b> more.</li>
        <li>Heads' targets are set by the MD or Operations Manager and only count once Founders approve them.</li>
      </ul>
    </section>
    <div className="grid gap-3 md:grid-cols-2">
      {COMPONENTS.map((c) => <section key={c.key} className="rounded-lg border border-rule bg-paper-raised p-4 text-sm">
        <div className="flex items-baseline justify-between gap-2"><h3 className="font-semibold">{c.label}</h3><span className="num text-ink-faint">{settings.weights[c.key]}%</span></div>
        <p className="mt-2 text-ink-soft">{c.meaning}</p>
        <p className="mt-2"><span className="eyebrow text-signal">How to raise it</span><br />{c.improve}</p>
      </section>)}
    </div>
  </div>;
}

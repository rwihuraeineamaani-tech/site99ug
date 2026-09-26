import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import Seo from "@/components/Seo";
import AppShell from "@/components/system/AppShell";
import { PageHeader, Segmented, StatusChip } from "@/components/system";
import StatCard from "@/components/admin/StatCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useMyRoles } from "@/hooks/useMyRoles";
import { KPI_MANAGER_ROLES } from "./Kpi";
import { COMPONENTS, DEFAULT_SETTINGS, TARGET_METRICS, loadKpiMonth, monthLabel, monthStart, ugx, type KpiSettings, type PersonKpi } from "@/lib/kpiPay";

const t = (name: string) => supabase.from(name as never) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
const input = "h-9 w-full rounded-md border border-rule bg-paper-sunken px-2 text-base md:text-sm";
const nameOf = (p: PersonKpi) => p.member.display_name || p.member.email || "Team member";

export default function KpiDesk() {
  const roles = useMyRoles();
  const [month, setMonth] = useState(monthStart());
  const [tab, setTab] = useState<"people" | "rules" | "approvals">("people");
  const [people, setPeople] = useState<PersonKpi[]>([]);
  const [settings, setSettings] = useState<KpiSettings>(DEFAULT_SETTINGS);
  const [residents, setResidents] = useState<{ id: string; name: string }[]>([]);
  const [closed, setClosed] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [beat, setBeat] = useState(0);
  const manager = roles.has(...KPI_MANAGER_ROLES);
  const founder = roles.has("founder");
  const reload = () => setBeat((b) => b + 1);

  useEffect(() => {
    if (!manager) return;
    let live = true;
    setLoading(true);
    Promise.all([
      loadKpiMonth(month),
      t("kpi_month_close").select("month").eq("month", month).maybeSingle(),
      supabase.from("residents").select("id,name").order("name"),
    ]).then(([r, c, res]) => {
      if (!live) return;
      setPeople(r.people.sort((a, b) => nameOf(a).localeCompare(nameOf(b))));
      setSettings(r.settings);
      setClosed(Boolean(c.data));
      setResidents((res.data as { id: string; name: string }[]) ?? []);
    }).catch(() => toast.error("Couldn't load the KPI month.")).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [manager, month, beat]);

  if (!roles.loading && !manager) return <Navigate to="/app/kpi" replace />;

  const pending = people.flatMap((p) => p.targets.filter((x) => x.approval_state === "pending").map((x) => ({ p, x })));
  const payroll = people.reduce((s, p) => s + (p.pay ? p.expected : 0), 0);

  const closeMonth = async () => {
    if (!confirm(`Close ${monthLabel(month)}? The figures will be locked.`)) return;
    const snapshot = people.map((p) => ({ user_id: p.member.user_id, name: nameOf(p), score: p.score, all_targets_met: p.allTargetsMet, lines: p.lines, expected: p.expected }));
    const { error } = await t("kpi_month_close").insert({ month, snapshot, closed_by: roles.userId });
    if (error) return toast.error(error.message);
    toast.success("Month closed and locked.");
    reload();
  };

  return <AppShell eyebrow="KPI desk">
    <Seo title="KPI desk — Site 99" description="Manage targets, weights, allowances and pay." path="/app/kpi/desk" noindex />
    <PageHeader
      eyebrow="KPI desk"
      title="Targets, scores and pay."
      lede={`${monthLabel(month)}${closed ? " · closed and locked" : ""}`}
      actions={<div className="flex flex-wrap gap-2">
        <input type="month" value={month.slice(0, 7)} onChange={(e) => e.target.value && setMonth(`${e.target.value}-01`)} className="h-9 rounded-md border border-rule bg-paper-raised px-2 text-base md:text-sm" aria-label="Month" />
        {!closed && <Button size="sm" variant="outline" onClick={closeMonth}>Close month</Button>}
      </div>}
    />
    {closed && <div className="mb-5 rounded-lg border border-rule bg-paper-raised p-3 text-sm text-ink-soft">This month is closed. Figures are locked for payroll.</div>}

    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="People" value={String(people.length)} hint="on the team list" />
      <StatCard label="Average score" value={people.length ? `${Math.round(people.reduce((s, p) => s + p.score, 0) / people.length)}%` : "—"} hint="this month" />
      <StatCard label="All targets hit" value={String(people.filter((p) => p.allTargetsMet).length)} hint="people" />
      <StatCard label="Expected payroll" value={ugx(payroll)} hint="if the month ended today" />
    </div>

    <div className="mb-5"><Segmented value={tab} onChange={(v: typeof tab) => setTab(v)} options={[
      { value: "people", label: "People" }, { value: "rules", label: "Rules & weights" }, { value: "approvals", label: `Head targets (${pending.length})` },
    ]} /></div>

    {loading ? <p className="text-sm text-ink-faint">Loading…</p> : tab === "rules" ? (
      <RulesEditor settings={settings} userId={roles.userId} onSaved={reload} />
    ) : tab === "approvals" ? (
      <section className="grid gap-2">
        {pending.length === 0 ? <p className="text-sm text-ink-faint">No head of department targets waiting.</p> : pending.map(({ p, x }) => <div key={x.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rule bg-paper-raised p-3 text-sm">
          <span><b>{nameOf(p)}</b> · {x.label || TARGET_METRICS.find((m) => m.key === x.metric)?.label} · {Number(x.target_value)}</span>
          {founder ? <span className="flex gap-2">
            <Button size="sm" onClick={async () => { const { error } = await t("kpi_targets").update({ approval_state: "approved" }).eq("id", x.id); error ? toast.error(error.message) : reload(); }}>Approve</Button>
            <Button size="sm" variant="outline" onClick={async () => { const { error } = await t("kpi_targets").update({ approval_state: "rejected" }).eq("id", x.id); error ? toast.error(error.message) : reload(); }}>Reject</Button>
          </span> : <StatusChip value="Waiting for Founders" tone="neutral" />}
        </div>)}
      </section>
    ) : (
      <div className="grid gap-2">
        {people.map((p) => <section key={p.member.user_id} className="rounded-lg border border-rule bg-paper-raised">
          <button onClick={() => setOpen(open === p.member.user_id ? null : p.member.user_id)} className="flex w-full flex-wrap items-center justify-between gap-3 p-3 text-left focus-ring">
            <span><span className="font-semibold">{nameOf(p)}</span> <span className="text-xs text-ink-faint">{p.member.title}{p.pay?.is_head ? " · Head" : ""}</span></span>
            <span className="flex flex-wrap items-center gap-3 text-sm">
              <span className="num">{p.score}%</span>
              <StatusChip value={!p.hasTargets ? "No targets" : p.allTargetsMet ? "All hit" : "Missing"} tone={!p.hasTargets ? "neutral" : p.allTargetsMet ? "success" : "warning"} />
              <span className="num text-ink-soft">{p.pay ? ugx(p.expected) : "No salary"}</span>
            </span>
          </button>
          {open === p.member.user_id && <PersonEditor p={p} month={month} settings={settings} residents={residents} locked={closed} userId={roles.userId} onSaved={reload} />}
        </section>)}
      </div>
    )}
  </AppShell>;
}

function PersonEditor({ p, month, settings, residents, locked, userId, onSaved }: {
  p: PersonKpi; month: string; settings: KpiSettings; residents: { id: string; name: string }[]; locked: boolean; userId: string | null; onSaved: () => void;
}) {
  const uid = p.member.user_id;
  const [pay, setPay] = useState({ base: p.pay?.base_salary_ugx ?? 0, head: p.pay?.is_head ?? false, headPay: p.pay?.head_bonus_ugx ?? 0, dept: p.pay?.department ?? "" });
  const [allow, setAllow] = useState({ data: p.allowance?.data_ugx ?? 0, transport: p.allowance?.transport_ugx ?? 0 });
  const [target, setTarget] = useState({ metric: "posted", label: "", value: "" });
  const [bonus, setBonus] = useState({ kind: "end" as "end" | "renewal", resident: "", value: "" });
  const done = (error: { message: string } | null, msg: string) => { if (error) toast.error(error.message); else { toast.success(msg); onSaved(); } };

  return <div className="grid gap-4 border-t border-rule p-3 lg:grid-cols-2">
    <fieldset disabled={locked} className="grid gap-2">
      <legend className="eyebrow mb-2 text-ink-faint">Pay</legend>
      <label className="text-xs">Base salary (UGX)<input type="number" className={input} value={pay.base} onChange={(e) => setPay({ ...pay, base: +e.target.value })} /></label>
      <label className="text-xs">Department<input className={input} value={pay.dept} onChange={(e) => setPay({ ...pay, dept: e.target.value })} /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pay.head} onChange={(e) => setPay({ ...pay, head: e.target.checked })} /> Head of department</label>
      {pay.head && <label className="text-xs">Head pay (UGX, only if targets hit)<input type="number" className={input} value={pay.headPay} onChange={(e) => setPay({ ...pay, headPay: +e.target.value })} /></label>}
      <Button size="sm" onClick={async () => { const { error } = await t("staff_pay").upsert({ user_id: uid, base_salary_ugx: pay.base, is_head: pay.head, head_bonus_ugx: pay.headPay, department: pay.dept || null }); done(error, "Pay saved."); }}>Save pay</Button>
    </fieldset>

    <fieldset disabled={locked} className="grid gap-2">
      <legend className="eyebrow mb-2 text-ink-faint">Allowances · {monthLabel(month)}</legend>
      <label className="text-xs">Data allowance (Handlers) (UGX)<input type="number" className={input} value={allow.data} onChange={(e) => setAllow({ ...allow, data: +e.target.value })} /></label>
      <label className="text-xs">Transport (UGX) · {p.activity.shoots} shoot day{p.activity.shoots === 1 ? "" : "s"} this month<input type="number" className={input} value={allow.transport} onChange={(e) => setAllow({ ...allow, transport: +e.target.value })} /></label>
      <Button size="sm" onClick={async () => { const { error } = await t("kpi_allowances").upsert({ user_id: uid, month, data_ugx: allow.data, transport_ugx: allow.transport, shoot_days: p.activity.shoots }, { onConflict: "user_id,month" }); done(error, "Allowances saved."); }}>Save allowances</Button>
    </fieldset>

    <div className="grid gap-2">
      <div className="eyebrow text-ink-faint">Targets</div>
      {p.targets.map((x) => <div key={x.id} className="flex items-center justify-between gap-2 text-sm">
        <span>{x.label || TARGET_METRICS.find((m) => m.key === x.metric)?.label} · <span className="num">{x.actual}/{Number(x.target_value)}</span></span>
        <span className="flex items-center gap-2">
          <StatusChip value={x.approval_state} tone={x.approval_state === "approved" ? "success" : "neutral"} />
          {x.metric === "custom" && !locked && <input type="number" aria-label="Actual" defaultValue={x.manual_actual ?? 0} className="h-8 w-20 rounded-md border border-rule bg-paper-sunken px-2 text-sm"
            onBlur={async (e) => { const { error } = await t("kpi_targets").update({ manual_actual: +e.target.value }).eq("id", x.id); done(error, "Updated."); }} />}
          {!locked && <Button size="sm" variant="ghost" onClick={async () => { const { error } = await t("kpi_targets").delete().eq("id", x.id); done(error, "Removed."); }}>Remove</Button>}
        </span>
      </div>)}
      {!locked && <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <select className={input} value={target.metric} onChange={(e) => setTarget({ ...target, metric: e.target.value })}>{TARGET_METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}</select>
        <input className={input} placeholder="Label (optional)" value={target.label} onChange={(e) => setTarget({ ...target, label: e.target.value })} />
        <input type="number" className={input} placeholder="Target" value={target.value} onChange={(e) => setTarget({ ...target, value: e.target.value })} />
        <Button size="sm" disabled={!target.value} onClick={async () => {
          const { error } = await t("kpi_targets").insert({ user_id: uid, month, metric: target.metric, label: target.label || null, target_value: +target.value, approval_state: "approved", created_by: userId });
          setTarget({ metric: "posted", label: "", value: "" });
          done(error, p.pay?.is_head ? "Target added — waiting for Founders." : "Target added.");
        }}>Add</Button>
      </div>}
    </div>

    <div className="grid gap-2">
      <div className="eyebrow text-ink-faint">Client contract bonuses</div>
      {p.contractBonuses.map((b) => <div key={b.id} className="flex items-center justify-between gap-2 text-sm">
        <span>{b.kind === "end" ? "Contract targets" : "Renewal"} · {b.percent}% of {ugx(b.contract_value_ugx)}</span>
        <span className="flex items-center gap-2"><span className="num">{ugx(b.amount_ugx)}</span>
          {!locked && <Button size="sm" variant="ghost" onClick={async () => { const { error } = await t("kpi_contract_bonuses").delete().eq("id", b.id); done(error, "Removed."); }}>Remove</Button>}</span>
      </div>)}
      {!locked && <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <select className={input} value={bonus.kind} onChange={(e) => setBonus({ ...bonus, kind: e.target.value as "end" | "renewal" })}>
          <option value="end">Contract targets ({settings.contract_end_pct}%)</option><option value="renewal">Renewal (+{settings.renewal_pct}%)</option>
        </select>
        <select className={input} value={bonus.resident} onChange={(e) => setBonus({ ...bonus, resident: e.target.value })}><option value="">Client…</option>{residents.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        <input type="number" className={input} placeholder="Contract value" value={bonus.value} onChange={(e) => setBonus({ ...bonus, value: e.target.value })} />
        <Button size="sm" disabled={!bonus.value || !bonus.resident} onClick={async () => {
          const percent = bonus.kind === "end" ? settings.contract_end_pct : settings.renewal_pct;
          const value = +bonus.value;
          const { error } = await t("kpi_contract_bonuses").insert({ user_id: uid, resident_id: bonus.resident, kind: bonus.kind, contract_value_ugx: value, percent, amount_ugx: Math.round((value * percent) / 100), month, confirmed_by: userId });
          setBonus({ kind: "end", resident: "", value: "" });
          done(error, "Bonus confirmed.");
        }}>Confirm</Button>
      </div>}
    </div>

    <div className="lg:col-span-2 grid gap-1 rounded-md bg-paper-sunken p-3 text-sm">
      {p.lines.map((l, i) => <div key={i} className="flex justify-between"><span>{l.label}</span><span className="num">{ugx(l.amount)}</span></div>)}
      <div className="flex justify-between border-t border-rule pt-1 font-semibold"><span>Expected · possible {ugx(p.possible)}</span><span className="num">{ugx(p.expected)}</span></div>
    </div>
  </div>;
}

function RulesEditor({ settings, userId, onSaved }: { settings: KpiSettings; userId: string | null; onSaved: () => void }) {
  const [s, setS] = useState(settings);
  const total = COMPONENTS.filter((c) => !c.negative).reduce((sum, c) => sum + Number(s.weights[c.key] || 0), 0);
  const num = (k: keyof Omit<KpiSettings, "weights">, label: string) =>
    <label className="text-xs">{label}<input type="number" className={input} value={s[k]} onChange={(e) => setS({ ...s, [k]: +e.target.value })} /></label>;
  return <div className="grid gap-5 lg:grid-cols-2">
    <section className="grid gap-2 rounded-lg border border-rule bg-paper-raised p-4">
      <h2 className="text-sm font-semibold">Pay rules (% )</h2>
      {num("hit_bonus_pct", "All targets hit bonus (% of base)")}
      {num("head_bonus_pct", "Head of department bonus (% of base)")}
      {num("miss_penalty_pct", "Missed targets penalty (% of base)")}
      {num("contract_end_pct", "Client end-of-contract bonus (% of contract)")}
      {num("renewal_pct", "Client renewal extra (% of contract)")}
    </section>
    <section className="grid gap-2 rounded-lg border border-rule bg-paper-raised p-4">
      <h2 className="text-sm font-semibold">How much each part counts</h2>
      {COMPONENTS.map((c) => <label key={c.key} className="text-xs">{c.label}{c.negative ? " (takes points away)" : ""}
        <input type="number" className={input} value={s.weights[c.key]} onChange={(e) => setS({ ...s, weights: { ...s.weights, [c.key]: +e.target.value } })} /></label>)}
      <p className={`text-xs ${total === 100 ? "text-ink-faint" : "text-signal"}`}>Positive parts add up to {total}%{total === 100 ? "." : " — scores are scaled, but 100% is easiest to read."}</p>
    </section>
    <div className="lg:col-span-2"><Button onClick={async () => {
      const { error } = await t("kpi_settings").update({ ...s, updated_by: userId }).eq("id", true);
      if (error) toast.error(error.message); else { toast.success("Rules saved."); onSaved(); }
    }}>Save rules</Button></div>
  </div>;
}

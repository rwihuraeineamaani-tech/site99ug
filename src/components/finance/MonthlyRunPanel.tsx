import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SectionHeading, StatusChip, Money } from "@/components/system";
import { useMyRoles } from "@/hooks/useMyRoles";
import { EXPENSE_CATEGORIES, LINE_STATUS_LABEL, monthKey, monthLabel } from "@/lib/finance";

type Recurring = {
  id: string;
  payee_name: string;
  payee_kind: string;
  amount_ugx: number;
  category: string;
  day_of_month: number;
  active: boolean;
};

type Line = {
  id: string;
  run_id: string;
  recurring_id: string | null;
  payee_name: string;
  payee_kind: string;
  amount_ugx: number;
  category: string;
  status: string;
};

const field =
  "mt-1.5 w-full rounded-lg border border-rule bg-paper-raised px-3 py-2 text-sm outline-none press focus:border-signal focus:ring-4 focus:ring-signal/10";
const pill =
  "press rounded-full border px-3 py-1.5 text-xs font-semibold focus-ring disabled:opacity-50 border-rule bg-paper-raised";

const TONE: Record<string, "amber" | "teal" | "neutral" | "stop"> = {
  pending: "amber",
  approved: "teal",
  paid: "teal",
  held: "stop",
};

export default function MonthlyRunPanel({ onChanged }: { onChanged?: () => void }) {
  const { canSeeFinance, isLeadership, has } = useMyRoles();
  const isFounder = has("admin", "founder");
  const canManage = canSeeFinance;

  const [month, setMonth] = useState(monthKey(new Date()));
  const [runId, setRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<string>("draft");
  const [lines, setLines] = useState<Line[]>([]);
  const [recurring, setRecurring] = useState<Recurring[]>([]);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [kind, setKind] = useState("external");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("rent");
  const [day, setDay] = useState("1");

  const load = useCallback(async () => {
    const [{ data: rec }, { data: run }] = await Promise.all([
      supabase.from("recurring_payments").select("*").order("payee_name"),
      supabase.from("payment_runs").select("id, status").eq("month", month).maybeSingle(),
    ]);
    setRecurring((rec as Recurring[]) ?? []);
    setRunId(run?.id ?? null);
    setRunStatus(run?.status ?? "draft");
    if (run?.id) {
      const { data: ls } = await supabase
        .from("payment_run_lines")
        .select("*")
        .eq("run_id", run.id)
        .order("payee_name");
      setLines((ls as Line[]) ?? []);
    } else {
      setLines([]);
    }
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  const build = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("build_payment_run", { _month: month });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("This month's list is ready.");
    load();
  };

  const approveAll = async () => {
    if (!runId) return;
    setBusy(true);
    const { error } = await supabase.rpc("approve_payment_run", { _run_id: runId });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Approved — finance can now pay.");
    load();
    onChanged?.();
  };

  const approveOne = async (id: string) => {
    if (!runId) return;
    setBusy(true);
    const { error } = await supabase.rpc("approve_payment_run", { _run_id: runId, _line_ids: [id] });
    setBusy(false);
    if (error) return toast.error(error.message);
    load();
    onChanged?.();
  };

  const hold = async (id: string) => {
    setBusy(true);
    const { error } = await supabase.rpc("hold_payment_line", { _line_id: id });
    setBusy(false);
    if (error) return toast.error(error.message);
    load();
  };

  const addRecurring = async () => {
    const value = Number(amount.replace(/[^\d]/g, ""));
    if (!name.trim() || !value) return toast.error("Enter a payee and an amount.");
    setBusy(true);
    const { error } = await supabase.from("recurring_payments").insert({
      payee_name: name.trim(),
      payee_kind: kind,
      amount_ugx: value,
      category,
      day_of_month: Math.min(28, Math.max(1, Number(day) || 1)),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setName("");
    setAmount("");
    load();
  };

  const toggleRecurring = async (r: Recurring) => {
    const { error } = await supabase.from("recurring_payments").update({ active: !r.active }).eq("id", r.id);
    if (error) toast.error(error.message);
    else load();
  };

  const addOneOff = async () => {
    if (!runId) return toast.error("Build the month's list first.");
    const payee = window.prompt("Who is being paid?");
    if (!payee) return;
    const value = Number((window.prompt("How much (UGX)?") ?? "").replace(/[^\d]/g, ""));
    if (!value) return;
    const { error } = await supabase
      .from("payment_run_lines")
      .insert({ run_id: runId, payee_name: payee, amount_ugx: value, category: "other" });
    if (error) toast.error(error.message);
    else load();
  };

  const total = lines.reduce((s, l) => s + l.amount_ugx, 0);

  if (!canSeeFinance && !isLeadership) return null;

  return (
    <section className="space-y-10">
      <div>
        <SectionHeading index="01" title="This month's payments" hint={monthLabel(month)} />
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <label className="text-sm">
            <span className="eyebrow text-ink-faint">Month</span>
            <input
              className={field}
              type="month"
              value={month.slice(0, 7)}
              onChange={(e) => setMonth(`${e.target.value}-01`)}
            />
          </label>
          {canManage && (
            <button className={pill} disabled={busy} onClick={build}>
              {runId ? "Refresh from the recurring list" : "Build the list"}
            </button>
          )}
          {canManage && runId && (
            <button className={pill} disabled={busy} onClick={addOneOff}>
              Add a one-off
            </button>
          )}
          {isFounder && runId && lines.some((l) => l.status !== "paid" && l.status !== "approved") && (
            <button className="ctl ctl-solid eyebrow px-4 py-2.5 focus-ring" disabled={busy} onClick={approveAll}>
              Approve the whole run
            </button>
          )}
          <span className="ml-auto text-sm text-ink-soft">
            Total <Money amount={total} className="font-semibold" />
          </span>
        </div>

        {!runId ? (
          <p className="text-sm text-ink-soft">
            No list for {monthLabel(month)} yet. It builds itself on the 1st, or press “Build the list”.
          </p>
        ) : (
          <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule">
            {lines.map((l) => (
              <li key={l.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                <span className="font-medium">{l.payee_name}</span>
                <StatusChip value={l.payee_kind === "internal" ? "internal" : "external"} tone="neutral" />
                <span className="text-[11px] text-ink-faint">{l.category}</span>
                <Money amount={l.amount_ugx} className="font-semibold" />
                <StatusChip value={LINE_STATUS_LABEL[l.status] ?? l.status} tone={TONE[l.status] ?? "neutral"} />
                {isFounder && l.status !== "paid" && (
                  <div className="ml-auto flex items-center gap-2">
                    {l.status !== "approved" && (
                      <button className="ctl ctl-solid eyebrow px-3 py-1.5 focus-ring" disabled={busy} onClick={() => approveOne(l.id)}>
                        Approve
                      </button>
                    )}
                    {l.status !== "held" && (
                      <button className={pill} disabled={busy} onClick={() => hold(l.id)}>
                        Hold
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
            {lines.length === 0 && <li className="px-4 py-3 text-sm text-ink-soft">Nothing on this run yet.</li>}
          </ul>
        )}
        {runStatus === "approved" && (
          <p className="mt-3 text-[11px] text-ink-faint">This run has been approved by a founder.</p>
        )}
      </div>

      {canManage && (
        <div>
          <SectionHeading index="02" title="Recurring payees" hint="Set once, repeats every month" />
          <div className="surface rounded-2xl p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end mb-4">
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">Payee</span>
              <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Office rent" />
            </label>
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">Who</span>
              <select className={field} value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="external">Outside the company</option>
                <option value="internal">Someone on the team</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">Amount (UGX)</span>
              <input className={field} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">Category</span>
              <select className={field} value={category} onChange={(e) => setCategory(e.target.value)}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3 items-end">
              <label className="text-sm">
                <span className="eyebrow text-ink-faint">Day</span>
                <input className={field} type="number" min={1} max={28} value={day} onChange={(e) => setDay(e.target.value)} />
              </label>
              <button className="ctl ctl-solid eyebrow px-4 py-2.5 focus-ring" disabled={busy} onClick={addRecurring}>
                Add
              </button>
            </div>
          </div>
          <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule">
            {recurring.map((r) => (
              <li key={r.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                <span className="font-medium">{r.payee_name}</span>
                <span className="text-[11px] text-ink-faint">
                  {r.category} · day {r.day_of_month}
                </span>
                <Money amount={r.amount_ugx} className="font-semibold" />
                {!r.active && <span className="text-[11px] text-ink-faint">paused</span>}
                <button className={`${pill} ml-auto`} onClick={() => toggleRecurring(r)}>
                  {r.active ? "Pause" : "Resume"}
                </button>
              </li>
            ))}
            {recurring.length === 0 && <li className="px-4 py-3 text-sm text-ink-soft">Nothing set up yet.</li>}
          </ul>
        </div>
      )}
    </section>
  );
}

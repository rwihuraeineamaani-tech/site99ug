import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SectionHeading, StatusChip, Money } from "@/components/system";
import { useMyRoles } from "@/hooks/useMyRoles";
import { LOAN_STATUS_LABEL, PAY_METHODS, dayLabel } from "@/lib/finance";

type Loan = {
  id: string;
  direction: string;
  counterparty_kind: string;
  counterparty_name: string;
  principal_ugx: number;
  agreed_total_ugx: number | null;
  purpose: string | null;
  schedule_note: string | null;
  start_on: string;
  status: string;
};

type Repayment = {
  id: string;
  loan_id: string;
  amount_ugx: number;
  due_on: string | null;
  paid_on: string | null;
  note: string | null;
};

const field =
  "mt-1.5 w-full rounded-lg border border-rule bg-paper-raised px-3 py-2 text-sm outline-none press focus:border-signal focus:ring-4 focus:ring-signal/10";
const pill =
  "press rounded-full border px-3 py-1.5 text-xs font-semibold focus-ring disabled:opacity-50 border-rule bg-paper-raised";

const TONE: Record<string, "amber" | "teal" | "neutral" | "stop"> = {
  pending_approval: "amber",
  active: "teal",
  settled: "neutral",
  written_off: "stop",
};

export default function LoansPanel({ onChanged }: { onChanged?: () => void }) {
  const { canSeeFinance, isLeadership } = useMyRoles();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [repayments, setRepayments] = useState<Repayment[]>([]);
  const [busy, setBusy] = useState(false);

  const [direction, setDirection] = useState("out");
  const [name, setName] = useState("");
  const [kind, setKind] = useState("team");
  const [principal, setPrincipal] = useState("");
  const [agreed, setAgreed] = useState("");
  const [purpose, setPurpose] = useState("");
  const [schedule, setSchedule] = useState("");
  const [startOn, setStartOn] = useState(new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    const [{ data: ls }, { data: rs }] = await Promise.all([
      supabase.from("loans").select("*").order("created_at", { ascending: false }),
      supabase.from("loan_repayments").select("*").order("created_at", { ascending: false }),
    ]);
    setLoans((ls as Loan[]) ?? []);
    setRepayments((rs as Repayment[]) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    const value = Number(principal.replace(/[^\d]/g, ""));
    if (!name.trim() || !value) return toast.error("Enter who and how much.");
    setBusy(true);
    const { error } = await supabase.from("loans").insert({
      direction,
      counterparty_kind: kind,
      counterparty_name: name.trim(),
      principal_ugx: value,
      agreed_total_ugx: agreed ? Number(agreed.replace(/[^\d]/g, "")) : null,
      purpose: purpose || null,
      schedule_note: schedule || null,
      start_on: startOn,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setName("");
    setPrincipal("");
    setAgreed("");
    setPurpose("");
    setSchedule("");
    toast.success("Loan recorded — a founder still has to approve it.");
    load();
    onChanged?.();
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("loans").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else load();
  };

  const repay = async (loan: Loan) => {
    const value = Number((window.prompt("How much was repaid (UGX)?") ?? "").replace(/[^\d]/g, ""));
    if (!value) return;
    const ref = window.prompt("Transaction ID (optional)") ?? "";
    setBusy(true);
    const { error } = await supabase.rpc("record_loan_repayment", {
      _loan_id: loan.id,
      _amount: value,
      _method: PAY_METHODS[0],
      _method_reference: ref || undefined,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Repayment recorded.");
    load();
    onChanged?.();
  };

  if (!canSeeFinance && !isLeadership) return null;

  const paidFor = (id: string) =>
    repayments.filter((r) => r.loan_id === id && r.paid_on).reduce((s, r) => s + r.amount_ugx, 0);

  return (
    <section className="space-y-10">
      <div>
        <SectionHeading index="01" title="Record a loan" hint="Money lent out, or borrowed" />
        <div className="surface rounded-2xl p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm">
            <span className="eyebrow text-ink-faint">Direction</span>
            <select className={field} value={direction} onChange={(e) => setDirection(e.target.value)}>
              <option value="out">We are lending</option>
              <option value="in">We are borrowing</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="eyebrow text-ink-faint">Who</span>
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
          </label>
          <label className="text-sm">
            <span className="eyebrow text-ink-faint">Type</span>
            <select className={field} value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="team">Team member</option>
              <option value="client">Client</option>
              <option value="external">Outside party</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="eyebrow text-ink-faint">Amount (UGX)</span>
            <input className={field} inputMode="numeric" value={principal} onChange={(e) => setPrincipal(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="eyebrow text-ink-faint">Total to be repaid (optional)</span>
            <input className={field} inputMode="numeric" value={agreed} onChange={(e) => setAgreed(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="eyebrow text-ink-faint">What for</span>
            <input className={field} value={purpose} onChange={(e) => setPurpose(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="eyebrow text-ink-faint">Repayment plan</span>
            <input className={field} value={schedule} onChange={(e) => setSchedule(e.target.value)} placeholder="200,000 a month for 5 months" />
          </label>
          <div className="grid grid-cols-2 gap-3 items-end">
            <label className="text-sm">
              <span className="eyebrow text-ink-faint">Starts</span>
              <input className={field} type="date" value={startOn} onChange={(e) => setStartOn(e.target.value)} />
            </label>
            <button className="ctl ctl-solid eyebrow px-4 py-2.5 focus-ring" disabled={busy} onClick={add}>
              Save
            </button>
          </div>
        </div>
      </div>

      <div>
        <SectionHeading index="02" title="Loans" hint={`${loans.length} on the books`} />
        <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule">
          {loans.map((l) => {
            const target = l.agreed_total_ugx ?? l.principal_ugx;
            const paid = paidFor(l.id);
            return (
              <li key={l.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                <span className="font-medium">{l.counterparty_name}</span>
                <StatusChip value={l.direction === "out" ? "lent out" : "borrowed"} tone={l.direction === "out" ? "amber" : "blue"} />
                <Money amount={l.principal_ugx} className="font-semibold" />
                <span className="text-[11px] text-ink-faint">
                  repaid <Money amount={paid} /> of <Money amount={target} /> · from {dayLabel(l.start_on)}
                  {l.schedule_note ? ` · ${l.schedule_note}` : ""}
                </span>
                <StatusChip value={LOAN_STATUS_LABEL[l.status] ?? l.status} tone={TONE[l.status] ?? "neutral"} />
                <div className="ml-auto flex items-center gap-2">
                  {l.status === "active" && (
                    <button className={pill} disabled={busy} onClick={() => repay(l)}>
                      Record repayment
                    </button>
                  )}
                  {l.status === "active" && paid >= target && (
                    <button className={pill} onClick={() => setStatus(l.id, "settled")}>
                      Settle
                    </button>
                  )}
                </div>
              </li>
            );
          })}
          {loans.length === 0 && <li className="px-4 py-3 text-sm text-ink-soft">No loans on the books.</li>}
        </ul>
      </div>
    </section>
  );
}

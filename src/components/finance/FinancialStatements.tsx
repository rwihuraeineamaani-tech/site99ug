import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeading, Money } from "@/components/system";
import { catLabel, csv, download } from "@/lib/finance";
import { buildStatements, type StatementEntry } from "@/lib/statements";
import { downloadStatementsPdf, type PdfSection } from "@/lib/statementsPdf";
import { useMyRoles } from "@/hooks/useMyRoles";

type Entry = StatementEntry & { wallet_id: string; entry_date: string };
type Wallet = { id: string; name: string; color: string; opening_balance_ugx: number; opening_date: string; active: boolean };
type Pack = { week_start: string; status: string; sent_at: string | null; note: string | null };

const pill = "press rounded-full border border-rule bg-paper-raised px-3 py-1.5 text-xs font-semibold focus-ring disabled:opacity-50";
const solid = "press rounded-full border border-signal bg-signal text-paper px-4 py-2 text-xs font-semibold focus-ring disabled:opacity-50";
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (s: string, n: number) => { const d = new Date(s + "T00:00:00"); d.setDate(d.getDate() + n); return iso(d); };
const mondayOf = (d = new Date()) => { const x = new Date(d); const k = (x.getDay() + 6) % 7; x.setDate(x.getDate() - k); return iso(x); };
const nice = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function Line({ label, value, strong, hint }: { label: string; value: number; strong?: boolean; hint?: string }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 border-b border-rule/60 py-2 ${strong ? "font-semibold" : ""}`}>
      <span className="text-sm">{label}{hint && <span className="block text-[11px] font-normal text-ink-faint">{hint}</span>}</span>
      <Money amount={value} signed={strong} className="text-sm" />
    </div>
  );
}

/** Profit and loss, cash flow and balance sheet for a week or month, plus the Friday report pack. */
export default function FinancialStatements() {
  const { has } = useMyRoles();
  const canSend = has("admin", "founder", "managing_director", "finance_ops");
  const [mode, setMode] = useState<"week" | "month">("week");
  const [week, setWeek] = useState(mondayOf());
  const [month, setMonth] = useState(iso(new Date()).slice(0, 7));
  const [entries, setEntries] = useState<Entry[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [receivable, setReceivable] = useState(0);
  const [payable, setPayable] = useState(0);
  const [loansOwed, setLoansOwed] = useState(0);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const from = mode === "week" ? week : `${month}-01`;
  const to = mode === "week" ? addDays(week, 7) : (() => { const d = new Date(`${month}-01T00:00:00`); d.setMonth(d.getMonth() + 1); return iso(d); })();
  const period = mode === "week" ? `Week of ${nice(from)} to ${nice(addDays(to, -1))}` : new Date(`${month}-01T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const load = useCallback(async () => {
    const [e, w, inv, l, r, p] = await Promise.all([
      supabase.from("cashbook_entries").select("id, wallet_id, direction, amount_ugx, category, entry_date, reverses_id, transfer_group_id").lt("entry_date", to).limit(100000),
      supabase.from("wallets").select("id, name, color, opening_balance_ugx, opening_date, active").order("sort"),
      supabase.from("invoices").select("direction, status, total_ugx, amount_paid_ugx").in("status", ["approved", "sent", "part_paid", "overdue"]),
      supabase.from("loans").select("id, direction, principal_ugx, status"),
      supabase.from("loan_repayments").select("loan_id, amount_ugx, paid_on"),
      supabase.from("finance_weekly_packs").select("week_start, status, sent_at, note").order("week_start", { ascending: false }).limit(8),
    ]);
    setEntries((e.data as Entry[]) ?? []);
    setWallets((w.data as unknown as Wallet[]) ?? []);
    const invs = (inv.data as { direction: string; status: string; total_ugx: number; amount_paid_ugx: number }[]) ?? [];
    setReceivable(invs.filter((i) => i.direction === "out" && i.status !== "approved").reduce((t, i) => t + Math.max(i.total_ugx - i.amount_paid_ugx, 0), 0));
    setPayable(invs.filter((i) => i.direction === "in").reduce((t, i) => t + Math.max(i.total_ugx - i.amount_paid_ugx, 0), 0));
    const repaid: Record<string, number> = {};
    ((r.data as { loan_id: string; amount_ugx: number; paid_on: string | null }[]) ?? []).forEach((x) => { if (x.paid_on) repaid[x.loan_id] = (repaid[x.loan_id] ?? 0) + x.amount_ugx; });
    setLoansOwed(((l.data as { id: string; direction: string; principal_ugx: number; status: string }[]) ?? [])
      .filter((x) => x.direction === "in" && x.status !== "cancelled").reduce((t, x) => t + Math.max(x.principal_ugx - (repaid[x.id] ?? 0), 0), 0));
    setPacks((p.data as Pack[]) ?? []);
  }, [to]);
  useEffect(() => { load(); }, [load]);

  const inPeriod = useMemo(() => entries.filter((x) => x.entry_date >= from && x.entry_date < to), [entries, from, to]);
  const st = useMemo(() => buildStatements(inPeriod), [inPeriod]);
  const balances = useMemo(() => wallets.map((w) => {
    const moved = entries.filter((x) => x.wallet_id === w.id && x.entry_date >= w.opening_date && x.entry_date < to)
      .reduce((t, x) => t + (x.direction === "in" ? 1 : -1) * x.amount_ugx, 0);
    return { ...w, balance: Number(w.opening_balance_ugx || 0) + moved };
  }), [wallets, entries, to]);
  const cash = balances.reduce((t, b) => t + b.balance, 0);
  const assets = cash + receivable;
  const liabilities = payable + loansOwed;
  const ownersShare = assets - liabilities;

  const sections = (): PdfSection[] => [
    { title: "Profit and loss", rows: [["Revenue", st.revenue], ...Object.entries(st.costsByCategory).map(([c, v]) => [catLabel(c), -v] as [string, number])], total: ["Profit", st.profit] },
    { title: "Cash flow", rows: [["From running the business", st.operating], ["Equipment and other assets bought", st.investing], ["Loans, capital and drawings", st.financing]], total: ["Net change in cash", st.netCash] },
    { title: `Balance sheet at ${nice(addDays(to, -1))}`, rows: [...balances.map((b) => [b.name, b.balance] as [string, number]), ["Clients owe us", receivable], ["Bills we still owe", -payable], ["Loans still to repay", -loansOwed]], total: ["Owners' share (assets minus what we owe)", ownersShare] },
  ];
  const metrics = () => ({ period, revenue: st.revenue, running_costs: st.runningCosts, profit: st.profit, net_cash: st.netCash, cash, receivable, payable, loans_owed: loansOwed, owners_share: ownersShare });

  const sendPack = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("send_weekly_finance_pack", { _week_start: week, _metrics: metrics(), _note: note || null } as never);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Sent to the Co-founders and MD."); setNote(""); load();
  };
  const exportCsv = () => download(`site99-statements-${from}.csv`, csv(sections().flatMap((s) => [[s.title, ""], ...s.rows, ...(s.total ? [s.total] : []), ["", ""]])));
  const thisPack = packs.find((p) => p.week_start === week);

  return (
    <section className="mb-10">
      <SectionHeading index="00" title="Financial statements" hint={period} />
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <button className={mode === "week" ? solid : pill} onClick={() => setMode("week")}>Week</button>
        <button className={mode === "month" ? solid : pill} onClick={() => setMode("month")}>Month</button>
        {mode === "week" ? (
          <>
            <button className={pill} onClick={() => setWeek(addDays(week, -7))}>Previous week</button>
            <button className={pill} onClick={() => setWeek(addDays(week, 7))}>Next week</button>
          </>
        ) : (
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-lg border border-rule bg-paper-raised px-3 py-1.5 text-sm" />
        )}
        <span className="flex-1" />
        <button className={pill} onClick={exportCsv}>CSV</button>
        <button className={pill} onClick={() => downloadStatementsPdf("Financial statements", period, sections(), `site99-statements-${from}.pdf`)}>PDF</button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-rule bg-paper-raised p-5 shadow-sm">
          <h3 className="mb-1 font-semibold">Profit and loss</h3>
          <p className="mb-3 text-[11px] text-ink-faint">What we earned minus what it cost to run. Loans, owner money and transfers are left out.</p>
          <Line label="Revenue" value={st.revenue} />
          {Object.entries(st.costsByCategory).sort((a, b) => b[1] - a[1]).map(([c, v]) => <Line key={c} label={catLabel(c)} value={-v} />)}
          <Line label="Profit" value={st.profit} strong />
          {st.capitalSpend > 0 && <p className="mt-2 text-[11px] text-ink-faint">Equipment bought ({st.capitalSpend.toLocaleString("en-UG")}) is an asset, so it is not taken off profit.</p>}
        </div>
        <div className="rounded-2xl border border-rule bg-paper-raised p-5 shadow-sm">
          <h3 className="mb-1 font-semibold">Cash flow</h3>
          <p className="mb-3 text-[11px] text-ink-faint">Where cash actually came from and went.</p>
          <Line label="From running the business" value={st.operating} hint="Client money in, running costs and tax out" />
          <Line label="Equipment and assets bought" value={st.investing} />
          <Line label="Loans, capital and drawings" value={st.financing} hint={`Loans in ${st.loansIn.toLocaleString("en-UG")}, repaid ${st.loanRepayments.toLocaleString("en-UG")}`} />
          <Line label="Net change in cash" value={st.netCash} strong />
        </div>
        <div className="rounded-2xl border border-rule bg-paper-raised p-5 shadow-sm">
          <h3 className="mb-1 font-semibold">Balance sheet</h3>
          <p className="mb-3 text-[11px] text-ink-faint">What we own and owe at {nice(addDays(to, -1))}.</p>
          {balances.filter((b) => b.active || b.balance).map((b) => (
            <div key={b.id} className="flex items-center justify-between border-b border-rule/60 py-2 text-sm">
              <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: b.color }} />{b.name}</span>
              <Money amount={b.balance} className="text-sm" />
            </div>
          ))}
          <Line label="Clients owe us" value={receivable} />
          <Line label="Bills we still owe" value={-payable} />
          <Line label="Loans still to repay" value={-loansOwed} />
          <Line label="Owners' share" value={ownersShare} strong hint="Everything we own minus everything we owe" />
        </div>
      </div>

      {mode === "week" && (
        <div className="mt-4 rounded-2xl border border-rule bg-paper-raised p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">Friday report pack</h3>
              <p className="text-[11px] text-ink-faint">Every Friday, Finance checks these figures, approves them and sends them to the Co-founders and MD. A reminder goes out at 8am.</p>
            </div>
            {thisPack?.status === "sent" ? (
              <span className="rounded-full bg-signal/15 px-3 py-1 text-xs font-semibold text-signal">Sent {thisPack.sent_at ? new Date(thisPack.sent_at).toLocaleString("en-GB") : ""}</span>
            ) : null}
          </div>
          {canSend && (
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Short note for the Co-founders, for example what needs attention" className="min-w-[240px] flex-1 rounded-lg border border-rule bg-paper px-3 py-2 text-sm" />
              <button className={solid} disabled={busy} onClick={sendPack}>{thisPack?.status === "sent" ? "Send again" : "Approve and send"}</button>
            </div>
          )}
          {thisPack?.note && <p className="mt-2 text-sm text-ink-soft">Note sent: {thisPack.note}</p>}
        </div>
      )}
    </section>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import FinancePage from "@/components/finance/FinancePage";
import { useFinanceLock } from "@/components/finance/FinanceLock";
import { Money, SectionHeading } from "@/components/system";

type Account = {
  id: string; name: string; kind: string; color: string; active: boolean;
  opening_balance_ugx: number; opening_date: string; account_number: string | null; sort: number;
};
const KINDS: Record<string, string> = {
  bank: "Bank", mobile_money: "Mobile money", cash: "Cash", payroll: "Payroll", production_fund: "Production fund", other: "Other",
};
const field = "mt-1.5 w-full rounded-lg border border-rule bg-paper-raised px-3 py-2 text-sm outline-none focus:border-signal focus:ring-4 focus:ring-signal/10";
const solid = "press rounded-full border border-signal bg-signal text-paper px-4 py-2 text-xs font-semibold focus-ring disabled:opacity-50";
const pill = "press rounded-full border border-rule bg-paper-raised px-3 py-1.5 text-xs font-semibold focus-ring disabled:opacity-50";
const blank = { id: "", name: "", kind: "bank", color: "#2563eb", opening: "", openingDate: "2026-11-01", number: "", active: true };

export default function FinanceAccounts() {
  const { require: requirePin } = useFinanceLock();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [moves, setMoves] = useState<{ wallet_id: string; direction: string; amount_ugx: number; entry_date: string }[]>([]);
  const [form, setForm] = useState<typeof blank | null>(null);
  const [tr, setTr] = useState<{ from: string; to: string; amount: string; date: string; tid: string; charge: string; note: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [a, e] = await Promise.all([
      supabase.from("wallets").select("*").order("sort"),
      supabase.from("cashbook_entries").select("wallet_id, direction, amount_ugx, entry_date").limit(100000),
    ]);
    setAccounts((a.data as unknown as Account[]) ?? []);
    setMoves((e.data as never) ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const balances = useMemo(() => {
    const b: Record<string, number> = {};
    for (const a of accounts) b[a.id] = Number(a.opening_balance_ugx || 0);
    for (const m of moves) {
      const a = accounts.find((x) => x.id === m.wallet_id);
      if (!a || m.entry_date < a.opening_date) continue;
      b[m.wallet_id] = (b[m.wallet_id] ?? 0) + (m.direction === "in" ? 1 : -1) * m.amount_ugx;
    }
    return b;
  }, [accounts, moves]);
  const total = accounts.filter((a) => a.active).reduce((s, a) => s + (balances[a.id] ?? 0), 0);

  const save = async () => {
    if (!form || !form.name.trim()) return toast.error("Give the account a name.");
    if (!(await requirePin())) return;
    setBusy(true);
    const { error } = await supabase.rpc("save_finance_account", {
      _id: form.id || null, _name: form.name, _kind: form.kind, _color: form.color,
      _opening: Math.round(Number(form.opening) || 0), _opening_date: form.openingDate,
      _account_number: form.number || null, _active: form.active,
    } as never);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Account saved.");
    setForm(null); load();
  };

  const transfer = async () => {
    if (!tr) return;
    if (!(await requirePin())) return;
    setBusy(true);
    const { error } = await supabase.rpc("transfer_between_accounts", {
      _from: tr.from, _to: tr.to, _amount: Math.round(Number(tr.amount)), _entry_date: tr.date,
      _note: tr.note || null, _tid: tr.tid || null, _charge: Math.round(Number(tr.charge) || 0),
    } as never);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Transfer recorded on both accounts.");
    setTr(null); load();
  };

  const momo = (id: string) => accounts.find((a) => a.id === id)?.kind === "mobile_money";

  return (
    <FinancePage
      title="Accounts."
      lede="Every place the company keeps money, its colour, opening balance on 1 November 2026, and what it holds now."
      path="/app/finance/accounts"
      actions={
        <div className="flex gap-2">
          <button className={pill} onClick={() => setTr({ from: "", to: "", amount: "", date: new Date().toISOString().slice(0, 10), tid: "", charge: "", note: "" })}>Transfer</button>
          <button className={solid} onClick={() => setForm({ ...blank })}>Add account</button>
        </div>
      }
    >
      <div className="rounded-2xl border border-rule bg-paper-raised p-5 shadow-sm">
        <div className="eyebrow text-ink-faint">All active accounts</div>
        <div className="mt-1 text-3xl font-semibold"><Money amount={total} /></div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((a) => (
          <button key={a.id} onClick={() => setForm({ id: a.id, name: a.name, kind: a.kind, color: a.color, opening: String(a.opening_balance_ugx ?? 0), openingDate: a.opening_date, number: a.account_number ?? "", active: a.active })}
            className="press rounded-2xl border border-rule bg-paper-raised p-4 text-left shadow-sm" style={{ borderLeft: `6px solid ${a.color}` }}>
            <div className="flex items-center justify-between">
              <span className="font-semibold">{a.name}</span>
              <span className="text-[11px] text-ink-faint">{KINDS[a.kind] ?? a.kind}{a.active ? "" : ", hidden"}</span>
            </div>
            <div className="mt-2 text-xl font-semibold"><Money amount={balances[a.id] ?? 0} /></div>
            <div className="mt-1 text-[11px] text-ink-faint">Opening {Number(a.opening_balance_ugx).toLocaleString("en-UG")} on {a.opening_date}{a.account_number ? `, no. ${a.account_number}` : ""}</div>
          </button>
        ))}
      </div>
      <p className="mt-4 text-xs text-ink-soft">Transfers move money between your own accounts. They never count as income or spending. Any bank or mobile money fee is saved as its own charge line.</p>

      {form && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={() => setForm(null)}>
          <div className="w-full max-w-md rounded-2xl border border-rule bg-paper p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <SectionHeading title={form.id ? "Edit account" : "Add account"} />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs sm:col-span-2"><span className="eyebrow text-ink-faint">Name</span><input className={field} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label className="text-xs"><span className="eyebrow text-ink-faint">Type</span>
                <select className={field} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>{Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label className="text-xs"><span className="eyebrow text-ink-faint">Colour</span><input type="color" className={`${field} h-10 p-1`} value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></label>
              <label className="text-xs"><span className="eyebrow text-ink-faint">Opening balance (UGX)</span><input className={field} inputMode="numeric" value={form.opening} onChange={(e) => setForm({ ...form, opening: e.target.value.replace(/[^\d]/g, "") })} /></label>
              <label className="text-xs"><span className="eyebrow text-ink-faint">On date</span><input type="date" className={field} value={form.openingDate} onChange={(e) => setForm({ ...form, openingDate: e.target.value })} /></label>
              <label className="text-xs sm:col-span-2"><span className="eyebrow text-ink-faint">Account or phone number</span><input className={field} value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} /></label>
              <label className="flex items-center gap-2 text-xs sm:col-span-2"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> In use</label>
            </div>
            <div className="mt-4 flex justify-end gap-2"><button className={pill} onClick={() => setForm(null)}>Cancel</button><button className={solid} disabled={busy} onClick={save}>Save</button></div>
          </div>
        </div>
      )}

      {tr && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={() => setTr(null)}>
          <div className="w-full max-w-md rounded-2xl border border-rule bg-paper p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <SectionHeading title="Move money between accounts" />
            <div className="grid gap-3 sm:grid-cols-2">
              {(["from", "to"] as const).map((k) => (
                <label key={k} className="text-xs"><span className="eyebrow text-ink-faint">{k === "from" ? "From" : "To"}</span>
                  <select className={field} value={tr[k]} onChange={(e) => setTr({ ...tr, [k]: e.target.value })}>
                    <option value="">Choose</option>{accounts.filter((a) => a.active).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select></label>
              ))}
              <label className="text-xs"><span className="eyebrow text-ink-faint">Amount (UGX)</span><input className={field} inputMode="numeric" value={tr.amount} onChange={(e) => setTr({ ...tr, amount: e.target.value.replace(/[^\d]/g, "") })} /></label>
              <label className="text-xs"><span className="eyebrow text-ink-faint">Date</span><input type="date" className={field} value={tr.date} onChange={(e) => setTr({ ...tr, date: e.target.value })} /></label>
              <label className="text-xs"><span className="eyebrow text-ink-faint">TID{momo(tr.from) || momo(tr.to) ? ", required" : ""}</span><input className={field} value={tr.tid} onChange={(e) => setTr({ ...tr, tid: e.target.value })} /></label>
              <label className="text-xs"><span className="eyebrow text-ink-faint">Charge (UGX)</span><input className={field} inputMode="numeric" value={tr.charge} onChange={(e) => setTr({ ...tr, charge: e.target.value.replace(/[^\d]/g, "") })} /></label>
              <label className="text-xs sm:col-span-2"><span className="eyebrow text-ink-faint">Note</span><input className={field} value={tr.note} onChange={(e) => setTr({ ...tr, note: e.target.value })} /></label>
            </div>
            <div className="mt-4 flex justify-end gap-2"><button className={pill} onClick={() => setTr(null)}>Cancel</button><button className={solid} disabled={busy} onClick={transfer}>Record transfer</button></div>
          </div>
        </div>
      )}
    </FinancePage>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import FinancePage from "@/components/finance/FinancePage";
import { Money, SectionHeading, StatusChip } from "@/components/system";
import { useMyRoles } from "@/hooks/useMyRoles";

type Budget = { id: string; month: string; estimate_ugx: number; estimate_note: string | null; approved_limit_ugx: number | null; status: string; decision_note: string | null };
type Req = { id: string; budget_id: string; doc_number: string; amount_ugx: number; purpose: string; status: string; requested_at: string; decline_reason: string | null };
type Acc = { id: string; name: string; kind: string; is_production_fund: boolean; active: boolean };

const field = "mt-1.5 w-full rounded-lg border border-rule bg-paper-raised px-3 py-2 text-sm outline-none focus:border-signal focus:ring-4 focus:ring-signal/10";
const solid = "press rounded-full border border-signal bg-signal text-paper px-4 py-2 text-xs font-semibold focus-ring disabled:opacity-50";
const pill = "press rounded-full border border-rule bg-paper-raised px-3 py-1.5 text-xs font-semibold focus-ring disabled:opacity-50";
const monthStart = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
const label = (m: string) => new Date(m + "T00:00:00").toLocaleDateString("en-UG", { month: "long", year: "numeric" });
const digits = (v: string) => v.replace(/[^\d]/g, "");

export default function ProductionFund() {
  const { has } = useMyRoles();
  const canRequest = has("creative_director", "strategist", "admin");
  const isFounder = has("founder", "admin");
  const isFinance = has("admin", "founder", "managing_director", "finance_ops");
  const [month, setMonth] = useState(monthStart());
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [reqs, setReqs] = useState<Req[]>([]);
  const [accounts, setAccounts] = useState<Acc[]>([]);
  const [est, setEst] = useState({ amount: "", note: "" });
  const [limit, setLimit] = useState("");
  const [req, setReq] = useState({ amount: "", purpose: "" });
  const [release, setRelease] = useState<{ id: string; from: string; tid: string; charge: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [b, r, a] = await Promise.all([
      supabase.from("production_fund_budgets").select("*").order("month", { ascending: false }),
      supabase.from("production_fund_requests").select("*").order("requested_at", { ascending: false }),
      isFinance ? supabase.from("wallets").select("id, name, kind, is_production_fund, active").order("sort") : Promise.resolve({ data: [] }),
    ]);
    setBudgets((b.data as Budget[]) ?? []);
    setReqs((r.data as Req[]) ?? []);
    setAccounts((a.data as Acc[]) ?? []);
  }, [isFinance]);
  useEffect(() => { load(); }, [load]);

  const budget = budgets.find((b) => b.month === month);
  const mine = useMemo(() => reqs.filter((r) => r.budget_id === budget?.id), [reqs, budget]);
  const used = mine.filter((r) => r.status !== "declined").reduce((s, r) => s + Number(r.amount_ugx), 0);
  const drawn = mine.filter((r) => r.status === "transferred").reduce((s, r) => s + Number(r.amount_ugx), 0);
  const lim = Number(budget?.approved_limit_ugx ?? 0);

  const call = async (fn: string, args: Record<string, unknown>, ok: string) => {
    setBusy(true);
    const { error } = await supabase.rpc(fn as never, args as never);
    setBusy(false);
    if (error) { toast.error(error.message); return false; }
    toast.success(ok); load(); return true;
  };

  const months = Array.from(new Set([monthStart(), monthStart(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)), ...budgets.map((b) => b.month)])).sort().reverse();

  return (
    <FinancePage gate={false} title="Production fund." path="/app/finance/production-fund"
      lede="Day-to-day production money. The Head of Content Creation and Strategy sends a monthly estimate, a Co-founder sets the limit, and each request moves money into the fund until the limit is used up.">
      <div className="mb-4 flex flex-wrap gap-2">
        {months.map((m) => <button key={m} className={m === month ? solid : pill} onClick={() => setMonth(m)}>{label(m)}</button>)}
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[["Estimate sent", Number(budget?.estimate_ugx ?? 0)], ["Approved limit", lim], ["Moved into the fund", drawn], ["Left to request", Math.max(lim - used, 0)]].map(([t, v]) => (
          <div key={t as string} className="rounded-2xl border border-rule bg-paper-raised p-4 shadow-sm">
            <div className="eyebrow text-ink-faint">{t}</div><div className="mt-1 text-xl font-semibold"><Money amount={v as number} /></div>
          </div>
        ))}
      </div>
      {lim > 0 && <div className="mt-3 h-2 overflow-hidden rounded-full bg-rule"><div className="h-full bg-signal" style={{ width: `${Math.min(100, (used / lim) * 100)}%` }} /></div>}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-rule bg-paper-raised p-5 shadow-sm">
          <SectionHeading title={`Estimate for ${label(month)}`} />
          {budget && <div className="mb-3 flex items-center gap-2 text-sm"><StatusChip value={budget.status} />{budget.decision_note && <span className="text-ink-soft">{budget.decision_note}</span>}</div>}
          {budget?.estimate_note && <p className="mb-3 whitespace-pre-wrap text-sm text-ink-soft">{budget.estimate_note}</p>}
          {canRequest && budget?.status !== "approved" && (
            <div className="grid gap-3">
              <label className="text-xs"><span className="eyebrow text-ink-faint">What you expect to spend (UGX)</span><input className={field} inputMode="numeric" value={est.amount} onChange={(e) => setEst({ ...est, amount: digits(e.target.value) })} /></label>
              <label className="text-xs"><span className="eyebrow text-ink-faint">Breakdown for the Co-founders</span><textarea rows={4} className={field} value={est.note} onChange={(e) => setEst({ ...est, note: e.target.value })} placeholder="Transport for shoots, props, data, meals..." /></label>
              <button className={solid} disabled={busy || !est.amount} onClick={async () => { if (await call("submit_production_estimate", { _month: month, _estimate: Number(est.amount), _note: est.note }, "Estimate sent to the Co-founders.")) setEst({ amount: "", note: "" }); }}>Send estimate</button>
            </div>
          )}
          {isFounder && budget?.status === "submitted" && (
            <div className="mt-4 grid gap-3 border-t border-rule pt-4">
              <label className="text-xs"><span className="eyebrow text-ink-faint">Limit to work with (UGX)</span><input className={field} inputMode="numeric" placeholder={String(budget.estimate_ugx)} value={limit} onChange={(e) => setLimit(digits(e.target.value))} /></label>
              <div className="flex gap-2">
                <button className={solid} disabled={busy} onClick={() => call("decide_production_estimate", { _id: budget.id, _approve: true, _limit: limit ? Number(limit) : null, _note: null }, "Limit approved.")}>Approve limit</button>
                <button className={pill} disabled={busy} onClick={() => { const n = prompt("Why is it declined?"); if (n) call("decide_production_estimate", { _id: budget.id, _approve: false, _limit: null, _note: n }, "Declined."); }}>Decline</button>
              </div>
            </div>
          )}
          {!budget && !canRequest && <p className="text-sm text-ink-soft">No estimate has been sent for this month yet.</p>}
        </section>

        <section className="rounded-2xl border border-rule bg-paper-raised p-5 shadow-sm">
          <SectionHeading title="Requests" />
          {canRequest && budget?.status === "approved" && (
            <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
              <label className="text-xs"><span className="eyebrow text-ink-faint">Amount</span><input className={field} inputMode="numeric" value={req.amount} onChange={(e) => setReq({ ...req, amount: digits(e.target.value) })} /></label>
              <label className="text-xs"><span className="eyebrow text-ink-faint">For</span><input className={field} value={req.purpose} onChange={(e) => setReq({ ...req, purpose: e.target.value })} /></label>
              <button className={solid} disabled={busy || !req.amount || !req.purpose.trim()} onClick={async () => { if (await call("request_production_funds", { _budget: budget.id, _amount: Number(req.amount), _purpose: req.purpose }, "Request sent to Finance.")) setReq({ amount: "", purpose: "" }); }}>Request</button>
            </div>
          )}
          <ul className="divide-y divide-rule">
            {mine.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div><div className="font-medium">{r.purpose}</div><div className="num text-[11px] text-ink-faint">{r.doc_number} · {new Date(r.requested_at).toLocaleDateString("en-UG")}{r.decline_reason ? ` · ${r.decline_reason}` : ""}</div></div>
                <div className="flex items-center gap-2"><Money amount={Number(r.amount_ugx)} /><StatusChip value={r.status} />
                  {isFinance && r.status === "requested" && (<>
                    <button className={solid} onClick={() => setRelease({ id: r.id, from: "", tid: "", charge: "" })}>Send money</button>
                    <button className={pill} onClick={() => { const n = prompt("Reason"); if (n) call("decline_production_request", { _id: r.id, _reason: n }, "Declined."); }}>Decline</button>
                  </>)}</div>
              </li>
            ))}
            {!mine.length && <li className="py-3 text-sm text-ink-soft">No requests this month.</li>}
          </ul>
        </section>
      </div>

      {release && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={() => setRelease(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-rule bg-paper p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <SectionHeading title="Move money into the production fund" />
            <div className="grid gap-3">
              <label className="text-xs"><span className="eyebrow text-ink-faint">From account</span>
                <select className={field} value={release.from} onChange={(e) => setRelease({ ...release, from: e.target.value })}><option value="">Choose</option>
                  {accounts.filter((a) => a.active && !a.is_production_fund).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
              <label className="text-xs"><span className="eyebrow text-ink-faint">TID{accounts.find((a) => a.id === release.from)?.kind === "mobile_money" ? ", required" : ""}</span><input className={field} value={release.tid} onChange={(e) => setRelease({ ...release, tid: e.target.value })} /></label>
              <label className="text-xs"><span className="eyebrow text-ink-faint">Charge (UGX)</span><input className={field} inputMode="numeric" value={release.charge} onChange={(e) => setRelease({ ...release, charge: digits(e.target.value) })} /></label>
            </div>
            <div className="mt-4 flex justify-end gap-2"><button className={pill} onClick={() => setRelease(null)}>Cancel</button>
              <button className={solid} disabled={busy || !release.from} onClick={async () => { if (await call("release_production_funds", { _id: release.id, _from: release.from, _tid: release.tid || null, _charge: Number(release.charge) || 0 }, "Money moved into the production fund.")) setRelease(null); }}>Send</button></div>
          </div>
        </div>
      )}
    </FinancePage>
  );
}

/**
 * Forward-looking finance: what money should arrive and leave over the coming months,
 * built only from records we already hold (contracts, recurring payments, invoices, cashbook).
 */
import { supabase } from "@/integrations/supabase/client";

export type ProjMonth = {
  month: string; // "Oct 26"
  key: string; // "2026-10"
  contracted: number; // signed retainers running that month
  renewals: number; // retainers whose contract ended but would likely renew (weighted)
  costs: number; // recurring payments + average variable spend
  net: number;
  cash: number; // projected closing cash (base case)
  best: number;
  worst: number;
};

export type Projection = {
  months: ProjMonth[];
  openingCash: number;
  avgIn: number;
  avgOut: number;
  recurringOut: number;
  owedToUs: number;
  weOwe: number;
  runwayMonths: number | null;
  concentration: { name: string; share: number; monthly: number }[];
  history: { month: string; in: number; out: number }[];
  renewalRate: number;
};

const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const label = (d: Date) => d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });

export async function loadProjection(horizon = 12, renewalRate = 0.6): Promise<Projection> {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const histFrom = new Date(start.getFullYear(), start.getMonth() - 6, 1).toISOString().slice(0, 10);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const [cons, rec, inv, cash, res] = await Promise.all([
    db.from("resident_contracts").select("id,resident_id,status,approval_state,starts_on,ends_on,monthly_retainer_ugx").neq("status", "cancelled"),
    db.from("recurring_payments").select("amount_ugx").eq("active", true),
    db.from("invoices").select("direction,status,total_ugx,amount_paid_ugx").not("status", "in", "(void,cancelled,draft)"),
    db.from("cashbook_entries").select("direction,amount_ugx,entry_date,category,transfer_group_id").gte("entry_date", histFrom),
    db.from("residents").select("id,name"),
  ]);
  const names = new Map<string, string>(((res.data ?? []) as { id: string; name: string }[]).map((r) => [r.id, r.name]));

  // Cash history, ignoring wallet-to-wallet moves.
  const hist = new Map<string, { in: number; out: number }>();
  for (let i = 6; i >= 1; i--) hist.set(ym(new Date(start.getFullYear(), start.getMonth() - i, 1)), { in: 0, out: 0 });
  const { data: allCash } = await db.from("cashbook_entries").select("direction,amount_ugx,transfer_group_id");
  let openingCash = 0;
  ((allCash ?? []) as { direction: string; amount_ugx: number; transfer_group_id: string | null }[]).forEach((e) => {
    if (e.transfer_group_id) return;
    openingCash += e.direction === "in" ? Number(e.amount_ugx) : -Number(e.amount_ugx);
  });
  ((cash.data ?? []) as { direction: string; amount_ugx: number; entry_date: string; transfer_group_id: string | null }[]).forEach((e) => {
    if (e.transfer_group_id) return;
    const h = hist.get(e.entry_date.slice(0, 7));
    if (!h) return;
    if (e.direction === "in") h.in += Number(e.amount_ugx);
    else h.out += Number(e.amount_ugx);
  });
  const history = [...hist.entries()].map(([k, v]) => ({ month: label(new Date(`${k}-01T00:00:00`)), ...v }));
  const active = history.filter((h) => h.in || h.out);
  const avgIn = active.length ? active.reduce((t, h) => t + h.in, 0) / active.length : 0;
  const avgOut = active.length ? active.reduce((t, h) => t + h.out, 0) / active.length : 0;
  const recurringOut = ((rec.data ?? []) as { amount_ugx: number }[]).reduce((t, r) => t + Number(r.amount_ugx), 0);
  // Costs: recurring bills, or recent average spend if that is higher (captures one-offs).
  const monthlyCost = Math.max(recurringOut, avgOut);

  let owedToUs = 0;
  let weOwe = 0;
  ((inv.data ?? []) as { direction: string; status: string; total_ugx: number; amount_paid_ugx: number }[]).forEach((i) => {
    const left = Math.max(0, Number(i.total_ugx ?? 0) - Number(i.amount_paid_ugx ?? 0));
    if (i.direction === "out") owedToUs += left; // we bill clients
    else weOwe += left;
  });

  type Con = { id: string; resident_id: string; status: string; approval_state: string; starts_on: string | null; ends_on: string | null; monthly_retainer_ugx: number | null };
  const contracts = ((cons.data ?? []) as Con[]).filter((c) => c.monthly_retainer_ugx && c.starts_on);
  const byClient = new Map<string, number>();

  let cashBase = openingCash;
  let cashBest = openingCash;
  let cashWorst = openingCash;
  const months: ProjMonth[] = [];
  for (let i = 0; i < horizon; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const key = ym(d);
    let contracted = 0;
    let renewals = 0;
    contracts.forEach((c) => {
      const s = c.starts_on!.slice(0, 7);
      const e = c.ends_on ? c.ends_on.slice(0, 7) : "9999-12";
      const amt = Number(c.monthly_retainer_ugx);
      if (key >= s && key <= e) {
        contracted += amt;
        if (i === 0) byClient.set(c.resident_id, (byClient.get(c.resident_id) ?? 0) + amt);
      } else if (key > e) {
        // Only one renewal guess per client, so overlapping old contracts do not double count.
        const newer = contracts.some((o) => o.resident_id === c.resident_id && o.id !== c.id && (o.ends_on ?? "9999") > (c.ends_on ?? ""));
        if (!newer) renewals += amt * renewalRate;
      }
    });
    // First month also collects what is already owed to us.
    const inBase = contracted + renewals + (i === 0 ? owedToUs * 0.7 : 0);
    const outBase = monthlyCost + (i === 0 ? weOwe : 0);
    const net = inBase - outBase;
    cashBase += net;
    cashBest += contracted + renewals / renewalRate * Math.min(1, renewalRate + 0.25) + (i === 0 ? owedToUs : 0) - outBase * 0.95;
    cashWorst += contracted * 0.9 + (i === 0 ? owedToUs * 0.4 : 0) - outBase * 1.1;
    months.push({ month: label(d), key, contracted, renewals: Math.round(renewals), costs: Math.round(outBase), net: Math.round(net), cash: Math.round(cashBase), best: Math.round(cashBest), worst: Math.round(cashWorst) });
  }

  const totalNow = [...byClient.values()].reduce((t, v) => t + v, 0) || 1;
  const concentration = [...byClient.entries()]
    .map(([id, monthly]) => ({ name: names.get(id) ?? "Client", monthly, share: Math.round((monthly / totalNow) * 100) }))
    .sort((a, b) => b.monthly - a.monthly)
    .slice(0, 8);

  const burn = monthlyCost - (months[0]?.contracted ?? 0);
  const runwayMonths = burn > 0 ? Math.max(0, Math.round((openingCash / burn) * 10) / 10) : null;

  return { months, openingCash, avgIn, avgOut, recurringOut, owedToUs, weOwe, runwayMonths, concentration, history, renewalRate };
}

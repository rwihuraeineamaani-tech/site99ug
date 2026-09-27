import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import FinancePage from "@/components/finance/FinancePage";
import { SectionHeading, Metric, Money } from "@/components/system";
import { catLabel, monthLabel, todayISO } from "@/lib/finance";
import { loadContractMoney, type ContractMoney } from "@/lib/contractLifecycle";

type Balance = { wallet_id: string; wallet_name: string; balance: number };
type Row = { category: string; money_in: number; money_out: number };

export default function FinanceOverview() {
  const month = todayISO().slice(0, 7);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [pending, setPending] = useState(0);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [recurring, setRecurring] = useState(0);
  const [contractMoney, setContractMoney] = useState<ContractMoney[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const [b, s, r, rec] = await Promise.all([
        supabase.rpc("wallet_balances"),
        supabase.rpc("finance_month_summary", { _month: `${month}-01` }),
        supabase.from("cash_requests").select("amount_ugx, status").in("status", ["pending", "md_approved"]),
        supabase.from("recurring_payments").select("amount_ugx").eq("active", true),
      ]);
      setBalances((b.data as Balance[]) ?? []);
      setRows((s.data as Row[]) ?? []);
      const reqs = (r.data as { amount_ugx: number }[]) ?? [];
      setPending(reqs.length);
      setPendingAmount(reqs.reduce((t, x) => t + x.amount_ugx, 0));
      setRecurring(((rec.data as { amount_ugx: number }[]) ?? []).reduce((t, x) => t + x.amount_ugx, 0));
      const [cm, rs] = await Promise.all([loadContractMoney(), supabase.from("residents").select("id, name")]);
      setContractMoney(cm);
      setNames(Object.fromEntries(((rs.data as { id: string; name: string }[]) ?? []).map((x) => [x.id, x.name])));
    })();
  }, [month]);

  const ending = contractMoney.filter((c) => c.status === "renewal_due");
  const owedList = contractMoney.filter((c) => c.status === "ended_unpaid");

  const total = balances.reduce((t, b) => t + Number(b.balance ?? 0), 0);
  const inn = rows.reduce((t, r) => t + Number(r.money_in ?? 0), 0);
  const out = rows.reduce((t, r) => t + Number(r.money_out ?? 0), 0);
  const spend = [...rows].filter((r) => r.money_out > 0).sort((a, b) => b.money_out - a.money_out).slice(0, 6);
  const top = spend[0]?.money_out ?? 1;

  return (
    <FinancePage
      title="Finance."
      lede={`Where the money stands right now — ${monthLabel(`${month}-01`)}.`}
      path="/app/finance"
      actions={
        <Link
          to="/app/finance/cashbook"
          className="press rounded-full border border-signal bg-signal text-paper px-4 py-2 text-xs font-semibold focus-ring"
        >
          Open the cashbook
        </Link>
      }
    >
      <section className="mb-10">
        <SectionHeading index="01" title="On hand" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="All wallets" value={<Money amount={total} />} tone="signal" />
          {balances.map((b) => (
            <Metric key={b.wallet_id} label={b.wallet_name} value={<Money amount={b.balance} />} />
          ))}
        </div>
      </section>

      <section className="mb-10">
        <SectionHeading index="02" title="This month" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Money in" value={<Money amount={inn} />} />
          <Metric label="Money out" value={<Money amount={out} />} />
          <Metric label="Net" value={<Money amount={inn - out} signed />} />
          <Metric label="Recurring each month" value={<Money amount={recurring} />} />
        </div>
      </section>

      <section className="mb-10">
        <SectionHeading index="03" title="Waiting on someone" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Link to="/app/finance/requests" className="surface card-lift rounded-sm p-5 block">
            <div className="eyebrow text-ink-faint">Requests waiting for approval</div>
            <div className="display text-2xl mt-2">{pending}</div>
            <div className="mt-1 text-[11px] text-ink-soft">
              <Money amount={pendingAmount} /> in total
            </div>
          </Link>
          <Link to="/app/finance/monthly" className="surface card-lift rounded-sm p-5 block">
            <div className="eyebrow text-ink-faint">Monthly run</div>
            <div className="display text-2xl mt-2">Build and approve</div>
            <div className="mt-1 text-[11px] text-ink-soft">Salaries, retainers and repeat payments</div>
          </Link>
        </div>
      </section>

      <section className="mb-10">
        <SectionHeading index="04" title="Client contracts" hint="renewals and money still owed" />
        <div className="grid gap-3 md:grid-cols-2">
          {[
            { title: "Ending soon — renew within 14 days", list: ending, empty: "No contracts ending in the next 14 days." },
            { title: "Ended with a balance owed", list: owedList, empty: "Every ended contract is fully paid." },
          ].map((box) => (
            <div key={box.title} className="surface rounded-sm p-5">
              <div className="eyebrow text-ink-faint mb-3">{box.title}</div>
              {box.list.length ? (
                <ul className="divide-y divide-rule">
                  {box.list.map((c) => (
                    <li key={c.contract_id} className="py-2 flex items-center gap-3 text-sm">
                      <Link to={`/app/residents/${c.resident_id}`} className="flex-1 min-w-0 truncate underline-offset-2 hover:underline">
                        {names[c.resident_id] ?? "Client"} · {c.title}
                      </Link>
                      <span className="text-[11px] text-ink-soft">{c.ends_on ?? ""}</span>
                      <Link to={`/app/finance/invoices?resident=${c.resident_id}&contract=${c.contract_id}`} className="text-xs num">
                        Owed <Money amount={c.outstanding_ugx} />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-soft">{box.empty}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionHeading index="04" title="Where it went this month" />
        <div className="rule-t">
          {spend.map((r) => (
            <div key={r.category} className="rule-b py-3 flex items-center gap-4">
              <span className="text-sm w-48">{catLabel(r.category)}</span>
              <span className="flex-1 h-2 rounded-full bg-paper-sunken overflow-hidden">
                <span className="block h-full bg-signal" style={{ width: `${(r.money_out / top) * 100}%` }} />
              </span>
              <Money amount={r.money_out} className="text-sm" />
            </div>
          ))}
          {!spend.length && <p className="py-6 text-sm text-ink-soft">Nothing spent yet this month.</p>}
        </div>
      </section>
    </FinancePage>
  );
}

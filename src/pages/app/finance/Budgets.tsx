import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import FinancePage from "@/components/finance/FinancePage";
import { SectionHeading, Money } from "@/components/system";
import { EXPENSE_CATEGORIES, catLabel, monthLabel, todayISO } from "@/lib/finance";

type Budget = { id: string; month: string; category: string; cap_ugx: number };
type Row = { category: string; money_in: number; money_out: number };

const field =
  "mt-1.5 w-full rounded-lg border border-rule bg-paper-raised px-3 py-2 text-sm outline-none press focus:border-signal focus:ring-4 focus:ring-signal/10";
const solid = "press rounded-full border border-signal bg-signal text-paper px-4 py-2 text-xs font-semibold focus-ring disabled:opacity-50";

export default function Budgets() {
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [spend, setSpend] = useState<Row[]>([]);
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [cap, setCap] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [b, s] = await Promise.all([
      supabase.from("budgets").select("id, month, category, cap_ugx").eq("month", `${month}-01`),
      supabase.rpc("finance_month_summary", { _month: `${month}-01` }),
    ]);
    setBudgets((b.data as Budget[]) ?? []);
    setSpend((s.data as Row[]) ?? []);
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    const amt = Math.round(Number(cap));
    if (!amt || amt <= 0) return toast.error("Put in a cap first.");
    setBusy(true);
    const { error } = await supabase
      .from("budgets")
      .upsert({ month: `${month}-01`, category, cap_ugx: amt }, { onConflict: "month,category" });
    setBusy(false);
    if (error) return toast.error(error.message);
    setCap("");
    toast.success("Cap saved.");
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("budgets").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const spentOn = (c: string) => Number(spend.find((s) => s.category === c)?.money_out ?? 0);

  return (
    <FinancePage title="Budgets." lede="A monthly cap per category, and how close you are to it." path="/app/finance/budgets">
      <section className="mb-8">
        <SectionHeading index="01" title="Set a cap" hint={monthLabel(`${month}-01`)} />
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs">
            <span className="eyebrow text-ink-faint">Month</span>
            <input type="month" className={field} value={month} onChange={(e) => setMonth(e.target.value)} />
          </label>
          <label className="text-xs">
            <span className="eyebrow text-ink-faint">Category</span>
            <select className={field} value={category} onChange={(e) => setCategory(e.target.value)}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {catLabel(c)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            <span className="eyebrow text-ink-faint">Cap (UGX)</span>
            <input className={field} inputMode="numeric" value={cap} onChange={(e) => setCap(e.target.value)} />
          </label>
          <button className={solid} onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save cap"}
          </button>
        </div>
      </section>

      <section>
        <SectionHeading index="02" title="How you're tracking" />
        <div className="rule-t">
          {budgets.map((b) => {
            const used = spentOn(b.category);
            const pct = Math.min(100, (used / b.cap_ugx) * 100);
            const over = used > b.cap_ugx;
            return (
              <div key={b.id} className="rule-b py-3 flex flex-wrap items-center gap-4">
                <span className="text-sm w-44">{catLabel(b.category)}</span>
                <span className="flex-1 min-w-[140px] h-2 rounded-full bg-paper-sunken overflow-hidden">
                  <span
                    className={`block h-full ${over ? "bg-signal" : "bg-acc-teal"}`}
                    style={{ width: `${pct}%` }}
                  />
                </span>
                <span className="text-xs text-ink-soft">
                  <Money amount={used} /> of <Money amount={b.cap_ugx} />
                </span>
                <button
                  className="press rounded-full border border-rule bg-paper-raised px-3 py-1.5 text-xs font-semibold focus-ring"
                  onClick={() => remove(b.id)}
                >
                  Remove
                </button>
              </div>
            );
          })}
          {!budgets.length && <p className="py-6 text-sm text-ink-soft">No caps set for this month.</p>}
        </div>
      </section>
    </FinancePage>
  );
}

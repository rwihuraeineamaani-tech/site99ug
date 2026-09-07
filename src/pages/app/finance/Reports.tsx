import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import FinancePage from "@/components/finance/FinancePage";
import { SectionHeading, Metric, Money } from "@/components/system";
import { catLabel, csv, download, monthBounds, monthLabel, todayISO } from "@/lib/finance";

type Entry = {
  id: string;
  direction: string;
  amount_ugx: number;
  entry_date: string;
  category: string;
  counterparty_name: string;
  resident_id: string | null;
  project_id: string | null;
};

const pill = "press rounded-full border border-rule bg-paper-raised px-3 py-1.5 text-xs font-semibold focus-ring disabled:opacity-50";

export default function Reports() {
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [rows, setRows] = useState<Entry[]>([]);
  const [residents, setResidents] = useState<Record<string, string>>({});
  const [projects, setProjects] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const { from, to } = monthBounds(month);
    const [e, r, p] = await Promise.all([
      supabase
        .from("cashbook_entries")
        .select("id, direction, amount_ugx, entry_date, category, counterparty_name, resident_id, project_id")
        .gte("entry_date", from)
        .lt("entry_date", to)
        .order("entry_date"),
      supabase.rpc("resident_options"),
      supabase.from("projects").select("id, title"),
    ]);
    setRows((e.data as Entry[]) ?? []);
    const rm: Record<string, string> = {};
    ((r.data as { id: string; name: string }[]) ?? []).forEach((x) => (rm[x.id] = x.name));
    setResidents(rm);
    const pm: Record<string, string> = {};
    ((p.data as { id: string; title: string }[]) ?? []).forEach((x) => (pm[x.id] = x.title));
    setProjects(pm);
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  const inn = rows.filter((r) => r.direction === "in").reduce((t, r) => t + r.amount_ugx, 0);
  const out = rows.filter((r) => r.direction === "out").reduce((t, r) => t + r.amount_ugx, 0);

  const byCategory = useMemo(() => {
    const m = new Map<string, { inn: number; out: number }>();
    rows.forEach((r) => {
      const c = m.get(r.category) ?? { inn: 0, out: 0 };
      if (r.direction === "in") c.inn += r.amount_ugx;
      else c.out += r.amount_ugx;
      m.set(r.category, c);
    });
    return [...m.entries()].sort((a, b) => b[1].out + b[1].inn - (a[1].out + a[1].inn));
  }, [rows]);

  const byOwner = useMemo(() => {
    const m = new Map<string, { name: string; inn: number; out: number }>();
    rows.forEach((r) => {
      const key = r.resident_id ? `r:${r.resident_id}` : r.project_id ? `p:${r.project_id}` : null;
      if (!key) return;
      const name = r.resident_id ? residents[r.resident_id] ?? "Resident" : projects[r.project_id as string] ?? "Project";
      const c = m.get(key) ?? { name, inn: 0, out: 0 };
      if (r.direction === "in") c.inn += r.amount_ugx;
      else c.out += r.amount_ugx;
      m.set(key, c);
    });
    return [...m.values()].sort((a, b) => b.inn - b.out - (a.inn - a.out));
  }, [rows, residents, projects]);

  const exportStatement = () =>
    download(
      `statement-${month}.csv`,
      csv([
        ["Date", "In/Out", "Amount UGX", "Category", "Who"],
        ...rows.map((r) => [r.entry_date, r.direction, r.amount_ugx, r.category, r.counterparty_name]),
      ])
    );

  const exportOwners = () =>
    download(
      `profitability-${month}.csv`,
      csv([
        ["Resident or project", "Money in UGX", "Money out UGX", "Net UGX"],
        ...byOwner.map((o) => [o.name, o.inn, o.out, o.inn - o.out]),
      ])
    );

  return (
    <FinancePage
      title="Reports."
      lede="The monthly statement, category breakdown and what each resident or project made."
      path="/app/finance/reports"
      actions={
        <>
          <button className={pill} onClick={exportStatement} disabled={!rows.length}>
            Export statement
          </button>
          <button className={pill} onClick={() => window.print()}>
            Print
          </button>
        </>
      }
    >
      <section className="mb-8">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs">
            <span className="eyebrow text-ink-faint">Month</span>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="mt-1.5 rounded-lg border border-rule bg-paper-raised px-3 py-2 text-sm outline-none press focus:border-signal"
            />
          </label>
        </div>
      </section>

      <section className="mb-10">
        <SectionHeading index="01" title="Statement" hint={monthLabel(`${month}-01`)} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Money in" value={<Money amount={inn} />} />
          <Metric label="Money out" value={<Money amount={out} />} />
          <Metric label="Net" value={<Money amount={inn - out} signed />} tone="signal" />
        </div>
      </section>

      <section className="mb-10">
        <SectionHeading index="02" title="By category" />
        <div className="rule-t">
          {byCategory.map(([c, v]) => (
            <div key={c} className="rule-b py-3 flex items-center gap-4">
              <span className="text-sm flex-1">{catLabel(c)}</span>
              <Money amount={v.inn} className="text-xs text-acc-teal" />
              <Money amount={v.out} className="text-xs" />
            </div>
          ))}
          {!byCategory.length && <p className="py-6 text-sm text-ink-soft">Nothing recorded this month.</p>}
        </div>
      </section>

      <section>
        <SectionHeading
          index="03"
          title="Residents and projects"
          hint={byOwner.length ? "Money in minus money out" : undefined}
        />
        <div className="rule-t">
          {byOwner.map((o) => (
            <div key={o.name} className="rule-b py-3 flex flex-wrap items-center gap-4">
              <span className="text-sm flex-1 min-w-[160px]">{o.name}</span>
              <span className="text-xs text-ink-soft">
                In <Money amount={o.inn} /> · Out <Money amount={o.out} />
              </span>
              <Money amount={o.inn - o.out} signed className="text-sm" />
            </div>
          ))}
          {!byOwner.length && <p className="py-6 text-sm text-ink-soft">Nothing tagged to a resident or project yet.</p>}
        </div>
        {byOwner.length > 0 && (
          <button className={`${pill} mt-4`} onClick={exportOwners}>
            Export this table
          </button>
        )}
      </section>
    </FinancePage>
  );
}

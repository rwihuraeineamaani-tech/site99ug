import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SectionPage from "@/components/system/SectionPage";
import { Metric, SectionHeading, Money } from "@/components/system";
import { useMyRoles } from "@/hooks/useMyRoles";

type Ops = {
  residents_active: number;
  residents_total: number;
  contracts_active: number;
  contracts_expiring: number;
  team_size: number;
  shoots_month: number;
  shoots_upcoming: number;
  content_by_stage: Record<string, number>;
  content_month: number;
  metrics_overdue: number;
};

type MonthRow = { category: string; money_in: number; money_out: number };

export default function OpsOverview() {
  const { canSeeFinance, isLeadership } = useMyRoles();
  const money = canSeeFinance || isLeadership;
  const [ops, setOps] = useState<Ops | null>(null);
  const [rows, setRows] = useState<MonthRow[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("ops_overview");
      setOps(data as unknown as Ops);
      if (money) {
        const first = `${new Date().toISOString().slice(0, 7)}-01`;
        const { data: m } = await supabase.rpc("finance_month_summary", { _month: first });
        setRows((m as MonthRow[]) ?? []);
      }
    })();
  }, [money]);

  const totalIn = rows.reduce((s, r) => s + Number(r.money_in ?? 0), 0);
  const totalOut = rows.reduce((s, r) => s + Number(r.money_out ?? 0), 0);
  const stages = Object.entries(ops?.content_by_stage ?? {});

  return (
    <SectionPage
      eyebrow="Management"
      title="The business today."
      lede="Residents, contracts, content, shoots and what is running late — all on one screen."
      path="/app/ops"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-10">
        <Metric label="Residents on the books" value={ops?.residents_active ?? "—"} hint={`${ops?.residents_total ?? 0} in total`} />
        <Metric label="Contracts running" value={ops?.contracts_active ?? "—"} hint={`${ops?.contracts_expiring ?? 0} expiring soon`} />
        <Metric label="People on the team" value={ops?.team_size ?? "—"} />
        <Metric label="Shoots this month" value={ops?.shoots_month ?? "—"} hint={`${ops?.shoots_upcoming ?? 0} still ahead`} />
      </div>

      {money && (
        <>
          <SectionHeading index="01" title="Money this month" hint="In and out" />
          <div className="grid gap-4 sm:grid-cols-3 mb-10">
            <Metric label="In" value={<Money amount={totalIn} compact />} />
            <Metric label="Out" value={<Money amount={totalOut} compact />} />
            <Metric label="Difference" value={<Money amount={totalIn - totalOut} compact signed />} tone="signal" />
          </div>
        </>
      )}

      <SectionHeading index={money ? "02" : "01"} title="Where the content sits" hint={`${ops?.content_month ?? 0} added this month`} />
      {!stages.length ? (
        <div className="surface rounded-xl p-8 text-sm text-ink-soft mb-10">No content recorded yet.</div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4 mb-10">
          {stages.map(([stage, n]) => (
            <li key={stage} className="surface card-lift rounded-xl px-4 py-3 flex items-baseline justify-between">
              <span className="text-sm">{stage}</span>
              <span className="display text-xl num">{n}</span>
            </li>
          ))}
        </ul>
      )}

      <SectionHeading index={money ? "03" : "02"} title="Running late" hint="Needs a nudge" />
      <div className="surface rounded-xl px-5 py-4 text-sm mb-10">
        {ops?.metrics_overdue ? (
          <span>
            <strong className="num">{ops.metrics_overdue}</strong> posted items are past their day for numbers.
          </span>
        ) : (
          <span className="text-ink-soft">Nothing overdue.</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { to: "/app/ops/people", label: "People" },
          { to: "/app/ops/workload", label: "Workload" },
          { to: "/app/ops/deadlines", label: "Deadlines" },
          { to: "/app/ops/report", label: "Weekly report" },
        ].map((l) => (
          <Link key={l.to} to={l.to} className="ctl eyebrow px-5 py-2.5 focus-ring">
            {l.label} →
          </Link>
        ))}
      </div>
    </SectionPage>
  );
}

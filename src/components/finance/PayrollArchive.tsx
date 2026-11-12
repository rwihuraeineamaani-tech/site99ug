import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Money, SectionHeading, StatusChip } from "@/components/system";
import { checkRun, type CashLine } from "@/lib/payrollMatch";

type Row = {
  id: string; run_label: string; run_date: string | null; line_no: number; full_name: string; role: string | null;
  channel: string | null; account_name: string | null; account_number: string | null; amount_ugx: number; charges_ugx: number;
  with_charges_ugx: number; contacted_by: string | null; processed_by: string | null; approved_by: string | null;
  flags: string[]; flag_note: string | null;
};
const FLAG: Record<string, string> = {
  no_account: "No account", paid_to_other: "Paid to someone else", no_charges: "No charge recorded",
  no_date: "No date", self_processed: "Processed own pay", self_contacted: "Contacted self",
};
const fmtDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** The old payroll sheet, read only, checked against the cashbook. */
export function PayrollArchive({ cash }: { cash: CashLine[] }) {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    supabase.from("legacy_payroll").select("*").order("run_label").order("line_no").then(({ data }) => setRows((data as Row[]) ?? []));
  }, []);
  const runs = useMemo(() => {
    const m = new Map<string, Row[]>();
    rows.forEach((r) => m.set(r.run_label, [...(m.get(r.run_label) ?? []), r]));
    return [...m.entries()].map(([label, lines]) => ({ label, date: lines[0].run_date, lines, check: checkRun(lines, lines[0].run_date, cash) }));
  }, [rows, cash]);

  if (!rows.length) return <p className="text-sm text-ink-soft">No payroll sheet rows yet.</p>;

  return (
    <div className="grid gap-6">
      <p className="text-sm text-ink-soft">
        The payroll and volunteer sheet, read only. Each run is checked against the cashbook so Finance can see what was paid, what is missing and which rows need an explanation.
      </p>
      {runs.map((run) => {
        const c = run.check;
        const issues: string[] = [];
        if (c.found.some((f) => f.swapped)) issues.push(`The cashbook has this payment on ${fmtDay(c.found.find((f) => f.swapped)!.entry_date)}. The day and month look swapped; it should be ${fmtDay(run.date!)}.`);
        if (!c.found.length) issues.push("No cashbook line pays this run.");
        if (c.missing) issues.push(`UGX ${c.missing.toLocaleString("en-US")} paid to people on this run is not in the cashbook.`);
        if (c.chargesMissing) issues.push(`Mobile money charges of UGX ${c.charges.toLocaleString("en-US")} are on the sheet but not in the cashbook. The real cost was UGX ${c.withCharges.toLocaleString("en-US")}.`);
        if (run.lines.some((l) => l.flags.includes("no_date"))) issues.push("The sheet has no date for this run.");
        return (
          <section key={run.label} className="rounded-2xl border border-rule bg-paper-raised p-4 shadow-sm">
            <SectionHeading title={run.label} hint={`${run.lines.length} people`} />
            <div className="mb-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-paper-sunken p-3"><div className="text-[11px] text-ink-faint">Paid to people</div><Money amount={c.amount} className="text-lg font-semibold" /></div>
              <div className="rounded-xl bg-paper-sunken p-3"><div className="text-[11px] text-ink-faint">Charges</div><Money amount={c.charges} className="text-lg font-semibold" /></div>
              <div className="rounded-xl bg-paper-sunken p-3"><div className="text-[11px] text-ink-faint">Real cost with charges</div><Money amount={c.withCharges} className="text-lg font-semibold" /></div>
            </div>
            <div className="mb-3 rounded-xl border border-rule p-3 text-sm">
              <div className="eyebrow mb-1 text-ink-faint">In the cashbook</div>
              {c.found.length ? c.found.map((f) => (
                <div key={f.id} className="flex flex-wrap gap-2"><span className="num text-xs text-ink-faint">{f.doc_number}</span><span>{f.counterparty_name}</span><span className="text-ink-faint">{f.entry_date}</span><Money amount={f.amount_ugx} className="ml-auto font-semibold" /></div>
              )) : <span className="text-ink-soft">Nothing found.</span>}
              {issues.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-signal">{issues.map((i) => <li key={i}>{i}</li>)}</ul>}
              {!issues.length && <p className="mt-2 text-[13px] text-ink-soft">This run matches the cashbook.</p>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-[11px] text-ink-faint"><tr className="border-b border-rule">
                  <th className="px-2 py-2">#</th><th className="px-2 py-2">Name</th><th className="px-2 py-2">Role</th><th className="px-2 py-2">Paid through</th>
                  <th className="px-2 py-2 text-right">Amount</th><th className="px-2 py-2 text-right">Charge</th><th className="px-2 py-2">Processed / approved</th><th className="px-2 py-2">Check</th></tr></thead>
                <tbody>{run.lines.map((l) => (
                  <tr key={l.id} className="border-b border-rule/60 align-top">
                    <td className="px-2 py-2 num text-xs">{l.line_no}</td>
                    <td className="px-2 py-2 font-medium">{l.full_name}</td>
                    <td className="px-2 py-2 text-ink-soft">{l.role}</td>
                    <td className="px-2 py-2 text-xs">{l.channel ?? "Not given"}{l.account_name && <div className="text-ink-faint">{l.account_name}{l.account_number ? ` · ${l.account_number}` : ""}</div>}</td>
                    <td className="px-2 py-2 num text-right">{l.amount_ugx.toLocaleString("en-US")}</td>
                    <td className="px-2 py-2 num text-right text-ink-soft">{l.charges_ugx.toLocaleString("en-US")}</td>
                    <td className="px-2 py-2 text-xs text-ink-soft">{l.processed_by}{l.approved_by ? ` / ${l.approved_by}` : ""}</td>
                    <td className="px-2 py-2"><div className="flex flex-wrap gap-1">{l.flags.map((f) => <StatusChip key={f} tone="warn" value={FLAG[f] ?? f} />)}</div></td>
                  </tr>))}</tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

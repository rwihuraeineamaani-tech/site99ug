import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import FinancePage from "@/components/finance/FinancePage";
import { SearchInput, StatusChip, SectionHeading } from "@/components/system";
import { matchSheetToApp, type AppLine } from "@/lib/sheetMatch";
import { liveEntries } from "@/lib/statements";

type Row = {
  id: string; row_no: number; entry_date: string | null; original_id: string | null; system_id: string | null;
  description: string | null; sheet_type: string | null; money_in: number; money_out: number; corrected_direction: string | null;
  sheet_balance: number | null; flags: string[]; flag_note: string | null;
};
const FLAG: Record<string, string> = {
  loan: "Loan, not revenue", capital: "Owner capital", note_row: "Note, not money", unknown: "Unknown",
  transfer: "Transfer", missing_amount: "No amount", missing_description: "No description",
  balance_mismatch: "Balance wrong", out_of_order: "Date out of order",
};

export default function FinanceOldSheet() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [tab, setTab] = useState<"sheet" | "compare">("compare");
  const [app, setApp] = useState<(AppLine & { category: string; reverses_id: string | null; transfer_group_id: string | null })[]>([]);
  useEffect(() => {
    supabase.from("legacy_ledger").select("*").order("row_no").then(({ data }) => setRows((data as Row[]) ?? []));
    supabase.from("cashbook_entries").select("id, entry_date, direction, amount_ugx, counterparty_name, doc_number, category, reverses_id, transfer_group_id")
      .order("entry_date").then(({ data }) => setApp((data as never) ?? []));
  }, []);
  const compare = useMemo(() => {
    const sheet = rows.filter((r) => (r.entry_date ?? "") >= "2026-10-01" && !r.flags.includes("note_row"))
      .map((r) => ({ id: r.id, entry_date: r.entry_date, direction: (r.corrected_direction === "in" ? "in" : "out") as "in" | "out", amount: r.money_in || r.money_out, description: r.description, system_id: r.system_id }));
    return matchSheetToApp(sheet, liveEntries(app));
  }, [rows, app]);
  const shown = useMemo(() => rows.filter((r) =>
    (!onlyFlagged || r.flags.length) &&
    [r.description, r.original_id, r.system_id].join(" ").toLowerCase().includes(q.toLowerCase())), [rows, q, onlyFlagged]);
  const flagged = rows.filter((r) => r.flags.length).length;

  return (
    <FinancePage gate={false} title="Old sheet archive." path="/app/finance/old-sheet"
      lede="The Google Sheet from March to November 2026, read only. Each row has its new system number beside the old one, and problems are flagged so nothing gets copied into the live books by mistake.">
      <div className="mb-4 flex gap-2">
        <button className={`press rounded-full border px-4 py-2 text-xs font-semibold ${tab === "compare" ? "border-signal bg-signal text-paper" : "border-rule bg-paper-raised"}`} onClick={() => setTab("compare")}>Compare October and November with the app</button>
        <button className={`press rounded-full border px-4 py-2 text-xs font-semibold ${tab === "sheet" ? "border-signal bg-signal text-paper" : "border-rule bg-paper-raised"}`} onClick={() => setTab("sheet")}>Whole sheet</button>
      </div>
      {tab === "compare" && (
        <div className="grid gap-4">
          <p className="text-sm text-ink-soft">Each sheet row from 1 October is paired with an app entry of the same amount and direction. Reversed entries and transfers are left out. Finance should fix or explain everything below that is not matched.</p>
          {[
            { title: `Different dates (${compare.matched.filter((m) => m.dateNote).length})`, items: compare.matched.filter((m) => m.dateNote).map((m) => ({ k: m.app.id, date: m.app.entry_date, name: `${m.sheet.description} / ${m.app.counterparty_name}`, num: m.app.doc_number, amt: m.app.amount_ugx, dir: m.app.direction, note: m.dateNote })) },
            { title: `On the sheet, missing in the app (${compare.sheetOnly.length})`, items: compare.sheetOnly.map((x) => ({ k: x.id, date: x.entry_date, name: x.description || "No description", num: x.system_id, amt: x.amount, dir: x.direction, note: x.amount ? null : "The sheet has no amount for this row" })) },
            { title: `In the app, missing on the sheet (${compare.appOnly.filter((x) => x.entry_date >= "2026-10-01" || x.entry_date < "2026-04-01").length})`, items: compare.appOnly.filter((x) => x.entry_date >= "2026-10-01" || x.entry_date < "2026-04-01").map((x) => ({ k: x.id, date: x.entry_date, name: x.counterparty_name, num: x.doc_number, amt: x.amount_ugx, dir: x.direction, note: null })) },
          ].map((g) => (
            <section key={g.title} className="rounded-2xl border border-rule bg-paper-raised p-4 shadow-sm">
              <SectionHeading title={g.title} />
              <ul className="divide-y divide-rule/60">
                {g.items.map((i) => (
                  <li key={i.k} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm">
                    <span><span className="num text-xs text-ink-faint">{i.date} · {i.num}</span> <span className="ml-1">{i.name}</span>{i.note && <span className="block text-[11px] text-signal">{i.note}</span>}</span>
                    <span className="num">{i.dir === "in" ? "+" : "-"}{Number(i.amt || 0).toLocaleString("en-UG")}</span>
                  </li>
                ))}
                {!g.items.length && <li className="py-2 text-sm text-ink-soft">Nothing here.</li>}
              </ul>
            </section>
          ))}
          <p className="text-xs text-ink-faint">{compare.matched.filter((m) => !m.dateNote).length} rows match exactly.</p>
        </div>
      )}
      {tab === "sheet" && (<>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={q} onChange={setQ} placeholder="Description or number" />
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={onlyFlagged} onChange={(e) => setOnlyFlagged(e.target.checked)} /> Only problem rows ({flagged} of {rows.length})</label>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-rule bg-paper-raised shadow-sm">
        <table className="w-full text-sm">
          <thead className="text-left text-[11px] text-ink-faint"><tr className="border-b border-rule">
            <th className="px-3 py-2">Date</th><th className="px-3 py-2">New number</th><th className="px-3 py-2">Old number</th>
            <th className="px-3 py-2">Description</th><th className="px-3 py-2 text-right">In</th><th className="px-3 py-2 text-right">Out</th>
            <th className="px-3 py-2 text-right">Sheet balance</th><th className="px-3 py-2">Problems</th></tr></thead>
          <tbody>{shown.map((r) => (
            <tr key={r.id} className="border-b border-rule/60 align-top">
              <td className="px-3 py-2 num text-xs">{r.entry_date}</td>
              <td className="px-3 py-2 num text-xs font-semibold">{r.system_id}</td>
              <td className="px-3 py-2 num text-[11px] text-ink-faint">{r.original_id}</td>
              <td className="px-3 py-2">{r.description || "—"}<div className="text-[11px] text-ink-faint">{r.sheet_type}</div></td>
              <td className="px-3 py-2 num text-right">{r.money_in ? r.money_in.toLocaleString("en-UG") : ""}</td>
              <td className="px-3 py-2 num text-right">{r.money_out ? r.money_out.toLocaleString("en-UG") : ""}</td>
              <td className="px-3 py-2 num text-right text-ink-soft">{r.sheet_balance?.toLocaleString("en-UG")}</td>
              <td className="px-3 py-2"><div className="flex flex-wrap gap-1">{r.flags.map((f) => <StatusChip key={f} tone="warn" value={FLAG[f] ?? f} />)}</div>
                {r.flag_note && <div className="mt-1 text-[11px] text-ink-soft">{r.flag_note}</div>}</td>
            </tr>))}</tbody>
        </table>
      </div>
      </>)}
    </FinancePage>
  );
}

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import FinancePage from "@/components/finance/FinancePage";
import { SearchInput, StatusChip } from "@/components/system";

type Row = {
  id: string; row_no: number; entry_date: string | null; original_id: string | null; system_id: string | null;
  description: string | null; sheet_type: string | null; money_in: number; money_out: number;
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
  useEffect(() => {
    supabase.from("legacy_ledger").select("*").order("row_no").then(({ data }) => setRows((data as Row[]) ?? []));
  }, []);
  const shown = useMemo(() => rows.filter((r) =>
    (!onlyFlagged || r.flags.length) &&
    [r.description, r.original_id, r.system_id].join(" ").toLowerCase().includes(q.toLowerCase())), [rows, q, onlyFlagged]);
  const flagged = rows.filter((r) => r.flags.length).length;

  return (
    <FinancePage gate={false} title="Old sheet archive." path="/app/finance/old-sheet"
      lede="The Google Sheet from March to November 2026, read only. Each row has its new system number beside the old one, and problems are flagged so nothing gets copied into the live books by mistake.">
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
    </FinancePage>
  );
}

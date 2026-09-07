import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SectionHeading, StatusChip, Money, SearchInput, FilterBar } from "@/components/system";
import { SOURCE_LABEL, csv, dayLabel, download } from "@/lib/finance";

type Hit = {
  id: string;
  txn_ref: string;
  direction: string;
  payee_name: string;
  payee_kind: string;
  amount_ugx: number;
  category: string;
  method: string | null;
  method_reference: string | null;
  invoice_no: string | null;
  source_kind: string;
  source_id: string | null;
  paid_at: string;
  reverses_txn_id: string | null;
};

export default function LookupPanel() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!q.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("finance_lookup", { _q: q.trim(), _limit: 50 });
    setBusy(false);
    if (error) return toast.error(error.message);
    setHits((data as Hit[]) ?? []);
  };

  const exportCsv = () => {
    if (!hits?.length) return;
    download(
      `finance-${q.replace(/\W+/g, "-")}.csv`,
      csv([
        ["Reference", "Date", "Payee", "Direction", "Amount UGX", "Category", "Method", "Transaction ID", "Invoice"],
        ...hits.map((h) => [
          h.txn_ref,
          h.paid_at,
          h.payee_name,
          h.direction,
          h.amount_ugx,
          h.category,
          h.method ?? "",
          h.method_reference ?? "",
          h.invoice_no ?? "",
        ]),
      ])
    );
  };

  return (
    <section>
      <SectionHeading index="01" title="Find a payment" hint="Name, reference, transaction ID or invoice" />
      <FilterBar>
        <SearchInput value={q} onChange={setQ} placeholder="Search payments…" className="min-w-[18rem]" />
        <button className="ctl ctl-solid eyebrow px-4 py-2.5 focus-ring" disabled={busy} onClick={run}>
          Search
        </button>
        {!!hits?.length && (
          <button
            className="press rounded-full border border-rule bg-paper-raised px-3 py-1.5 text-xs font-semibold focus-ring"
            onClick={exportCsv}
          >
            Export
          </button>
        )}
      </FilterBar>
      {hits === null ? (
        <p className="text-sm text-ink-soft">Type anything you remember about the payment.</p>
      ) : hits.length === 0 ? (
        <p className="text-sm text-ink-soft">Nothing matched that.</p>
      ) : (
        <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule">
          {hits.map((h) => (
            <li key={h.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
              <Link to={`/app/finance/t/${h.id}`} className="num text-xs text-signal focus-ring">
                {h.txn_ref}
              </Link>
              <span className="font-medium">{h.payee_name}</span>
              <Money amount={h.direction === "in" ? h.amount_ugx : -h.amount_ugx} signed className="font-semibold" />
              <StatusChip value={SOURCE_LABEL[h.source_kind] ?? h.source_kind} tone="neutral" />
              <span className="text-[11px] text-ink-faint">
                {h.method ?? "—"}
                {h.method_reference ? ` · ${h.method_reference}` : ""}
                {h.invoice_no ? ` · invoice ${h.invoice_no}` : ""} · {dayLabel(h.paid_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

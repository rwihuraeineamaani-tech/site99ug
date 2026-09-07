import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Seo from "@/components/Seo";
import AppShell from "@/components/system/AppShell";
import { PageHeader, SectionHeading, StatusChip, Money } from "@/components/system";
import { SOURCE_LABEL, dayLabel } from "@/lib/finance";

type Txn = {
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
  invoice_path: string | null;
  note: string | null;
  source_kind: string;
  source_id: string | null;
  paid_at: string;
  paid_by: string | null;
  reverses_txn_id: string | null;
};

type Audit = { id: string; action: string; detail: string | null; actor: string | null; created_at: string };

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rule-b py-3 flex items-baseline gap-4">
      <span className="eyebrow text-ink-faint w-44 shrink-0">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

export default function FinanceTransaction() {
  const { id } = useParams();
  const [txn, setTxn] = useState<Txn | null>(null);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const [{ data: t }, { data: a }, { data: team }] = await Promise.all([
        supabase.from("transactions").select("*").eq("id", id).maybeSingle(),
        supabase.from("finance_audit").select("id, action, detail, actor, created_at").eq("entity_id", id).order("created_at"),
        supabase.from("team_members").select("user_id, display_name, email"),
      ]);
      setTxn((t as Txn) ?? null);
      setAudit((a as Audit[]) ?? []);
      const map: Record<string, string> = {};
      (team ?? []).forEach((m) => (map[m.user_id] = m.display_name || m.email || "Team member"));
      setNames(map);
      setLoading(false);
    };
    load();
  }, [id]);

  const openInvoice = async () => {
    if (!txn?.invoice_path) return;
    const { data, error } = await supabase.storage.from("finance-files").createSignedUrl(txn.invoice_path, 120);
    if (error || !data) return toast.error("Could not open that file.");
    window.open(data.signedUrl, "_blank", "noopener");
  };

  return (
    <AppShell>
      <Seo title="Payment — Site 99" description="A single payment and everything behind it." path="/app/finance" noindex />
      <PageHeader
        eyebrow="Finance"
        title={txn?.txn_ref ?? "Payment"}
        lede="Everything recorded about this payment."
        actions={
          <Link to="/app/finance" className="press rounded-full border border-rule bg-paper-raised px-4 py-2 text-xs font-semibold focus-ring">
            Back to finance
          </Link>
        }
      />
      {loading ? (
        <p className="text-sm text-ink-faint">Loading…</p>
      ) : !txn ? (
        <p className="text-sm text-ink-soft">That payment could not be found.</p>
      ) : (
        <>
          <div className="mt-8 surface rounded-2xl p-5">
            <Row label="Amount" value={<Money amount={txn.direction === "in" ? txn.amount_ugx : -txn.amount_ugx} signed className="font-semibold" />} />
            <Row label="Paid to" value={txn.payee_name} />
            <Row label="Date" value={dayLabel(txn.paid_at)} />
            <Row label="Category" value={txn.category} />
            <Row label="Reason" value={<StatusChip value={SOURCE_LABEL[txn.source_kind] ?? txn.source_kind} tone="violet" />} />
            <Row label="How it was paid" value={txn.method ?? "—"} />
            <Row label="Transaction ID" value={txn.method_reference ?? "—"} />
            <Row label="Invoice number" value={txn.invoice_no ?? "—"} />
            <Row label="Recorded by" value={txn.paid_by ? names[txn.paid_by] ?? "Team member" : "—"} />
            {txn.note && <Row label="Note" value={txn.note} />}
            {txn.reverses_txn_id && (
              <Row
                label="Reverses"
                value={
                  <Link to={`/app/finance/t/${txn.reverses_txn_id}`} className="text-signal focus-ring">
                    the earlier payment
                  </Link>
                }
              />
            )}
            {txn.invoice_path && (
              <div className="pt-4">
                <button className="press rounded-full border border-rule bg-paper-raised px-4 py-2 text-xs font-semibold focus-ring" onClick={openInvoice}>
                  Open the invoice
                </button>
              </div>
            )}
          </div>

          <div className="mt-10">
            <SectionHeading index="01" title="History" hint={`${audit.length} entries`} />
            <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule">
              {audit.map((a) => (
                <li key={a.id} className="px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-medium">{a.action.replace(/_/g, " ")}</span>
                  {a.detail && <span className="text-ink-soft">{a.detail}</span>}
                  <span className="ml-auto text-[11px] text-ink-faint">
                    {a.actor ? names[a.actor] ?? "Team member" : "System"} · {dayLabel(a.created_at)}
                  </span>
                </li>
              ))}
              {audit.length === 0 && <li className="px-4 py-3 text-sm text-ink-soft">No history recorded.</li>}
            </ul>
          </div>
        </>
      )}
    </AppShell>
  );
}

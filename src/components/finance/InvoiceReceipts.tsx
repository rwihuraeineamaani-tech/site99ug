import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Money } from "@/components/system";
import { dayLabel } from "@/lib/finance";
import { downloadFinanceDoc, loadDocProfile, loadReceipts, receiptDoc, type ReceiptRow } from "@/lib/financeDocs";
import { emailReceipt } from "@/lib/docEmail";
import type { Invoice } from "@/lib/invoices";
import { EmailDocButton } from "./EmailDocButton";

const pill = "press rounded-full border border-rule bg-paper-raised px-3 py-1.5 text-xs font-semibold focus-ring disabled:opacity-50";

type Party = { name: string; address?: string | null; email?: string | null };

/** One receipt per payment recorded against the invoice, ready to download or email. */
export function InvoiceReceipts({ inv, party, canEmail }: { inv: Invoice; party: () => Promise<Party>; canEmail: boolean }) {
  const [rows, setRows] = useState<ReceiptRow[] | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    loadReceipts(inv.id)
      .then((r) => live && setRows(r))
      .catch(() => live && setRows([]));
    party().then((p) => live && setEmail(p.email ?? null));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inv.id, inv.amount_paid_ugx]);

  if (rows === null) return <p className="text-xs text-ink-faint">Loading receipts…</p>;
  if (rows.length === 0)
    return inv.amount_paid_ugx > 0 ? (
      <p className="text-xs text-ink-soft">
        Money is recorded as paid but no cashbook line is linked to this invoice yet, so there is no receipt. Link the payment in the Cashbook.
      </p>
    ) : null;

  const download = async (r: ReceiptRow) => {
    try {
      const p = await party();
      await downloadFinanceDoc(receiptDoc(inv, r, p, rows));
    } catch {
      toast.error("Could not build the receipt.");
    }
  };

  return (
    <div className="rounded-xl border border-rule bg-paper-sunken p-3">
      <div className="eyebrow mb-2 text-ink-faint">Receipts · {rows.length}</div>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.entry_id} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="num text-xs font-semibold">{r.doc_number ?? "No number"}</span>
            <span className="text-ink-soft">{dayLabel(r.entry_date)}</span>
            <span className="text-ink-faint">{r.account_name ?? ""}{r.tid ? ` · TID ${r.tid}` : ""}</span>
            <Money amount={r.amount_ugx} className="font-semibold" />
            <span className="ml-auto flex flex-wrap gap-2">
              <button className={pill} onClick={() => download(r)}>
                Download receipt
              </button>
              {canEmail && (
                <EmailDocButton
                  label="Email receipt"
                  defaultTo={email}
                  send={async (to) => {
                    const p = await party();
                    const doc = receiptDoc(inv, r, p, rows);
                    await emailReceipt({
                      entryId: r.entry_id,
                      to,
                      clientName: p.name,
                      receiptNumber: doc.number,
                      invoiceNumber: inv.number,
                      amount: r.amount_ugx,
                      date: r.entry_date,
                      method: r.account_name,
                      tid: r.tid || r.reference,
                      balance: doc.balanceAfter,
                      profile: await loadDocProfile(),
                    });
                  }}
                />
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

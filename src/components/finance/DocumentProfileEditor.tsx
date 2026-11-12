import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { DEFAULT_PROFILE, downloadFinanceDoc, loadDocProfile, type DocProfile } from "@/lib/financeDocs";

const field = "mt-1 w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm";

const GROUPS: { title: string; keys: [keyof DocProfile, string][] }[] = [
  {
    title: "Letterhead",
    keys: [
      ["company_name", "Company name"],
      ["tin", "TIN (URA)"],
      ["address", "Address"],
      ["phone", "Phone"],
      ["email", "Email"],
      ["website", "Website"],
    ],
  },
  {
    title: "Bank transfer",
    keys: [
      ["bank_name", "Bank"],
      ["bank_account_name", "Account name"],
      ["bank_account_number", "Account number"],
      ["bank_branch", "Branch"],
      ["bank_swift", "SWIFT code"],
    ],
  },
  {
    title: "Mobile money",
    keys: [
      ["momo_network", "Network"],
      ["momo_code", "Merchant code"],
      ["momo_name", "Registered name"],
    ],
  },
  {
    title: "Sign-off",
    keys: [
      ["signatory_name", "Who signs"],
      ["signatory_title", "Their title"],
    ],
  },
];

/** What every invoice and receipt prints: letterhead, TIN, how to pay, terms and who signs. */
export function DocumentProfileEditor({ canEdit }: { canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [p, setP] = useState<DocProfile>(DEFAULT_PROFILE);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) loadDocProfile().then(setP);
  }, [open]);

  const missing = [!p.tin && "TIN", !p.bank_account_number && "bank account", !p.signatory_name && "who signs"].filter(Boolean);

  const save = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("document_profile")
      .update({ ...p, updated_at: new Date().toISOString() })
      .eq("id", 1);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Invoice and receipt details saved.");
  };

  const sample = () =>
    downloadFinanceDoc(
      {
        kind: "invoice",
        number: "S9926INVA000",
        partyName: "Sample Client Ltd",
        partyEmail: "accounts@sample.ug",
        date: new Date().toISOString().slice(0, 10),
        dueDate: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
        periodLabel: "Monthly retainer, sample",
        lines: [{ description: "Content retainer", tax: 0, amount: 1500000 }],
        subtotal: 1500000,
        tax: 0,
        total: 1500000,
        vatExempt: true,
      },
      p,
    );

  return (
    <section className="mb-6 rounded-2xl border border-rule bg-paper-raised p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <div className="font-semibold">Invoice and receipt details</div>
          <p className="text-xs text-ink-soft">Letterhead, TIN, how clients pay, terms and who signs. Printed on every invoice and receipt.</p>
        </div>
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => setOpen((v) => !v)}>
          {open ? "Close" : "Edit details"}
        </Button>
      </div>
      {open && (
        <div className="mt-4 space-y-5">
          {missing.length > 0 && (
            <p className="rounded-lg border border-state-warn/40 bg-state-warn/10 px-3 py-2 text-xs">
              Still missing: {missing.join(", ")}. Invoices print without them until they are filled in.
            </p>
          )}
          {GROUPS.map((g) => (
            <div key={g.title}>
              <div className="eyebrow mb-2 text-ink-faint">{g.title}</div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {g.keys.map(([k, lbl]) => (
                  <label key={k} className="text-sm">
                    <span className="text-xs text-ink-soft">{lbl}</span>
                    <input
                      className={field}
                      disabled={!canEdit}
                      value={(p[k] as string | null) ?? ""}
                      onChange={(e) => setP({ ...p, [k]: e.target.value || null })}
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              <span className="text-xs text-ink-soft">Invoice terms</span>
              <textarea rows={3} className={field} disabled={!canEdit} value={p.invoice_terms ?? ""} onChange={(e) => setP({ ...p, invoice_terms: e.target.value })} />
            </label>
            <label className="text-sm">
              <span className="text-xs text-ink-soft">Note on receipts</span>
              <textarea rows={3} className={field} disabled={!canEdit} value={p.receipt_note ?? ""} onChange={(e) => setP({ ...p, receipt_note: e.target.value })} />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <Button onClick={save} disabled={busy || !p.company_name.trim()}>
                {busy ? "Saving…" : "Save details"}
              </Button>
            )}
            <Button variant="outline" onClick={sample}>
              Download a sample invoice
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

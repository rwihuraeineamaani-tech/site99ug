import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import FinancePage from "@/components/finance/FinancePage";
import { Money, SectionHeading, StatusChip } from "@/components/system";
import { Button } from "@/components/ui/button";
import { useMyRoles } from "@/hooks/useMyRoles";
import { DEFAULT_PROFILE, downloadFinanceDoc, loadDocProfile, type DocProfile } from "@/lib/financeDocs";

const field = "mt-1 w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm disabled:opacity-60";
type Key = keyof DocProfile;
type F = { k: Key; label: string; hint?: string; type?: "text" | "date" | "number" };

const SECTIONS: { id: string; title: string; hint: string; fields: F[] }[] = [
  {
    id: "company",
    title: "Company and tax",
    hint: "Registration and tax numbers. TIN and registration number print on every invoice and receipt.",
    fields: [
      { k: "company_name", label: "Registered company name" },
      { k: "reg_number", label: "Company registration number (URSB)" },
      { k: "tin", label: "TIN (URA)" },
      { k: "nssf_number", label: "NSSF employer number" },
      { k: "financial_year_start", label: "Financial year starts", type: "date" },
      { k: "books_start_date", label: "Books start date", type: "date", hint: "The day the new system's books begin." },
    ],
  },
  {
    id: "contact",
    title: "Letterhead and contacts",
    hint: "What sits at the top of each document, and who clients call about money.",
    fields: [
      { k: "address", label: "Address" },
      { k: "phone", label: "Office phone" },
      { k: "email", label: "Office email" },
      { k: "website", label: "Website" },
      { k: "finance_contact_name", label: "Finance contact person" },
      { k: "finance_contact_phone", label: "Finance phone" },
      { k: "finance_contact_email", label: "Finance email" },
    ],
  },
  {
    id: "bank",
    title: "Bank account clients pay into",
    hint: "Printed under How to pay on invoices and in invoice emails. Leave empty to show mobile money only.",
    fields: [
      { k: "bank_name", label: "Bank" },
      { k: "bank_account_name", label: "Account name" },
      { k: "bank_account_number", label: "Account number" },
      { k: "bank_branch", label: "Branch" },
      { k: "bank_swift", label: "SWIFT code" },
    ],
  },
  {
    id: "momo",
    title: "Mobile money clients pay into",
    hint: "Clients send the transaction ID (TID) to Finance after paying.",
    fields: [
      { k: "momo_network", label: "Network" },
      { k: "momo_code", label: "Merchant code" },
      { k: "momo_name", label: "Registered name" },
    ],
  },
  {
    id: "docs",
    title: "Invoices and receipts",
    hint: "Who signs, how many days clients get to pay, and the wording at the bottom.",
    fields: [
      { k: "signatory_name", label: "Who signs" },
      { k: "signatory_title", label: "Their title" },
      { k: "invoice_due_days", label: "Days to pay after issue", type: "number" },
    ],
  },
];

type Wallet = { id: string; name: string; kind: string; color: string | null; opening_balance_ugx: number; opening_date: string | null; active: boolean };

export default function FinanceOffice() {
  const { has } = useMyRoles();
  const canEdit = has("admin", "founder", "managing_director", "finance_ops");
  const isFounder = has("admin", "founder");
  const [p, setP] = useState<DocProfile>(DEFAULT_PROFILE);
  const [saved, setSaved] = useState<DocProfile>(DEFAULT_PROFILE);
  const [busy, setBusy] = useState(false);
  const [threshold, setThreshold] = useState("");
  const [wallets, setWallets] = useState<Wallet[]>([]);

  useEffect(() => {
    loadDocProfile().then((x) => {
      setP(x);
      setSaved(x);
    });
    supabase.from("finance_settings").select("dual_pin_threshold_ugx").eq("id", 1).maybeSingle().then(({ data }) => setThreshold(String(data?.dual_pin_threshold_ugx ?? "")));
    supabase.from("wallets").select("id, name, kind, color, opening_balance_ugx, opening_date, active").eq("active", true).order("sort").then(({ data }) => setWallets((data as Wallet[]) ?? []));
  }, []);

  const dirty = JSON.stringify(p) !== JSON.stringify(saved);
  const checklist = useMemo(
    () => [
      { ok: !!p.tin, label: "TIN" },
      { ok: !!p.reg_number, label: "Registration number" },
      { ok: !!(p.bank_name && p.bank_account_number), label: "Bank account" },
      { ok: !!p.momo_code, label: "Mobile money" },
      { ok: !!p.signatory_name, label: "Who signs" },
    ],
    [p],
  );

  const set = (k: Key, v: string) =>
    setP({ ...p, [k]: k === "invoice_due_days" ? Math.max(0, Math.round(Number(v) || 0)) : v || null });

  const save = async () => {
    if (!p.company_name?.trim()) return toast.error("The company name cannot be empty.");
    setBusy(true);
    const { error } = await supabase.from("document_profile").update({ ...p, updated_at: new Date().toISOString() } as never).eq("id", 1);
    setBusy(false);
    if (error) return toast.error(error.message);
    setSaved(p);
    toast.success("Finance office details saved. New invoices and receipts use them straight away.");
  };

  const saveThreshold = async () => {
    const n = Math.round(Number(threshold));
    if (!n || n < 0) return toast.error("Enter an amount in UGX.");
    const { error } = await supabase.from("finance_settings").update({ dual_pin_threshold_ugx: n }).eq("id", 1);
    if (error) return toast.error(error.message);
    toast.success("Second PIN limit saved.");
  };

  const sample = () =>
    downloadFinanceDoc(
      {
        kind: "invoice",
        number: "S9926INVA000",
        partyName: "Sample Client Ltd",
        partyEmail: "accounts@sample.ug",
        date: new Date().toISOString().slice(0, 10),
        dueDate: new Date(Date.now() + (p.invoice_due_days ?? 7) * 864e5).toISOString().slice(0, 10),
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
    <FinancePage
      title="Finance office"
      lede="Company, tax and payment details in one place. Everything here prints on invoices and receipts and goes into invoice emails."
      path="/app/finance/office"
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={sample}>
            Sample invoice
          </Button>
          {canEdit && (
            <Button onClick={save} disabled={busy || !dirty}>
              {busy ? "Saving…" : dirty ? "Save changes" : "Saved"}
            </Button>
          )}
        </div>
      }
    >
      <section className="mb-6 rounded-2xl border border-rule bg-paper-raised p-4">
        <div className="eyebrow mb-2 text-ink-faint">Ready to print</div>
        <div className="flex flex-wrap gap-2">
          {checklist.map((c) => (
            <StatusChip key={c.label} tone={c.ok ? "teal" : "amber"} value={`${c.label}${c.ok ? "" : ": missing"}`} />
          ))}
        </div>
        {!canEdit && <p className="mt-2 text-xs text-ink-soft">Only Finance, the MD and the Co-founders can change these details.</p>}
      </section>

      <div className="grid gap-6">
        {SECTIONS.map((s) => (
          <section key={s.id} className="rounded-2xl border border-rule bg-paper-raised p-4">
            <SectionHeading title={s.title} hint={s.hint} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {s.fields.map((f) => (
                <label key={f.k} className="text-sm">
                  <span className="text-xs text-ink-soft">{f.label}</span>
                  <input
                    type={f.type ?? "text"}
                    className={field}
                    disabled={!canEdit}
                    value={(p[f.k] as string | number | null | undefined) ?? ""}
                    onChange={(e) => set(f.k, e.target.value)}
                  />
                  {f.hint && <span className="mt-1 block text-[11px] text-ink-faint">{f.hint}</span>}
                </label>
              ))}
              {s.id === "company" && (
                <>
                  <label className="flex items-center gap-2 text-sm sm:col-span-2 lg:col-span-1">
                    <input type="checkbox" disabled={!canEdit} checked={!!p.vat_registered} onChange={(e) => setP({ ...p, vat_registered: e.target.checked })} />
                    <span>Site 99 is registered for VAT with URA</span>
                  </label>
                  <label className="text-sm">
                    <span className="text-xs text-ink-soft">Standard VAT rate</span>
                    <select
                      className={field}
                      disabled={!canEdit}
                      value={String(p.default_vat_rate ?? 0.18)}
                      onChange={(e) => setP({ ...p, default_vat_rate: Number(e.target.value) })}
                    >
                      <option value="0.18">18%</option>
                      <option value="0">0% (exempt)</option>
                    </select>
                    <span className="mt-1 block text-[11px] text-ink-faint">Used as the starting VAT on new invoices. Each contract still decides if VAT applies.</span>
                  </label>
                </>
              )}
            </div>
            {s.id === "docs" && (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="text-sm">
                  <span className="text-xs text-ink-soft">Terms on invoices</span>
                  <textarea rows={3} className={field} disabled={!canEdit} value={p.invoice_terms ?? ""} onChange={(e) => setP({ ...p, invoice_terms: e.target.value })} />
                </label>
                <label className="text-sm">
                  <span className="text-xs text-ink-soft">Note on receipts</span>
                  <textarea rows={3} className={field} disabled={!canEdit} value={p.receipt_note ?? ""} onChange={(e) => setP({ ...p, receipt_note: e.target.value })} />
                </label>
              </div>
            )}
          </section>
        ))}

        <section className="rounded-2xl border border-rule bg-paper-raised p-4">
          <SectionHeading title="Our accounts" hint="Every account we hold money in. Opening balances are left for Finance to fill in from 1 November 2026." />
          <ul className="divide-y divide-rule/60">
            {wallets.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <span className="h-3 w-3 rounded-full" style={{ background: w.color ?? "hsl(var(--ink-faint))" }} />
                <span className="font-medium">{w.name}</span>
                <span className="text-xs text-ink-faint">{w.kind.replace(/_/g, " ")}</span>
                <span className="ml-auto">
                  {Number(w.opening_balance_ugx) ? (
                    <span className="text-ink-soft">
                      Opening <Money amount={w.opening_balance_ugx} />
                    </span>
                  ) : (
                    <StatusChip tone="amber" value="Opening balance open" />
                  )}
                </span>
              </li>
            ))}
          </ul>
          <Link to="/app/finance/accounts" className="mt-3 inline-block text-xs font-semibold text-signal">
            Add or edit accounts, colours and opening balances
          </Link>
        </section>

        <section className="rounded-2xl border border-rule bg-paper-raised p-4">
          <SectionHeading title="Payment safety" hint="Any single payment at or above this amount needs a second person's PIN before it is released." />
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-sm">
              <span className="text-xs text-ink-soft">Second PIN needed from (UGX)</span>
              <input className={field} inputMode="numeric" disabled={!isFounder} value={threshold} onChange={(e) => setThreshold(e.target.value.replace(/[^\d]/g, ""))} />
            </label>
            {isFounder && (
              <Button variant="outline" onClick={saveThreshold}>
                Save limit
              </Button>
            )}
          </div>
          {!isFounder && <p className="mt-2 text-xs text-ink-faint">Only a Co-founder can change this limit.</p>}
        </section>
      </div>
    </FinancePage>
  );
}

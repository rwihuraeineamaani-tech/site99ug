import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { downloadFinanceDoc } from "@/lib/financeDocs";
import { toast } from "sonner";

const lbl = "mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground";

const fmtUGX = (n: number | null | undefined) =>
  `UGX ${Math.round(Number(n ?? 0)).toLocaleString("en-US")}`;

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Not set";

const VAT_LABEL: Record<string, string> = {
  inclusive: "VAT included in the figures",
  exclusive: "VAT added on top of the figures",
  exempt: "No VAT",
  unknown: "Not set",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Being drafted",
  active: "Active",
  archived: "Finished",
  cancelled: "Cancelled",
};

type Contract = {
  id: string;
  title: string;
  contract_type: string | null;
  status: string;
  starts_on: string | null;
  ends_on: string | null;
  months: number | null;
  monthly_retainer_ugx: number | null;
  value_ugx: number | null;
  vat_mode: string | null;
  services: unknown;
  payment_terms: string | null;
  invoice_day: number | null;
  due_days: number | null;
  notice_days: number | null;
  renewal_terms: string | null;
  client_signatory: string | null;
  site99_signatory: string | null;
  notes: string | null;
  file_path: string | null;
  is_historical: boolean | null;
  paid_before_system_ugx: number | null;
};

type Invoice = {
  id: string;
  number: string | null;
  status: string;
  period_label: string | null;
  category: string | null;
  issue_date: string | null;
  due_date: string | null;
  subtotal_ugx: number;
  vat_ugx: number;
  total_ugx: number;
  amount_paid_ugx: number;
  resident_contract_id: string | null;
};

function servicesList(s: unknown): string[] {
  if (Array.isArray(s)) return s.map(String).filter(Boolean);
  return [];
}

export default function PortalContract({ residentId, residentName }: { residentId: string; residentName: string }) {
  const [downloading, setDownloading] = useState<string | null>(null);

  const contracts = useQuery({
    queryKey: ["portal-contracts", residentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resident_contracts")
        .select("*")
        .eq("resident_id", residentId)
        .order("is_historical", { ascending: true })
        .order("starts_on", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Contract[];
    },
  });

  const invoices = useQuery({
    queryKey: ["portal-invoices", residentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, number, status, period_label, category, issue_date, due_date, subtotal_ugx, vat_ugx, total_ugx, amount_paid_ugx, resident_contract_id")
        .eq("resident_id", residentId)
        .eq("direction", "out")
        .neq("status", "draft")
        .order("issue_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Invoice[];
    },
  });

  const openSignedCopy = async (path: string) => {
    const { data, error } = await supabase.storage.from("resident-contracts").createSignedUrl(path, 120);
    if (error || !data?.signedUrl) return toast.error("Could not open the signed copy.");
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const downloadInvoice = async (inv: Invoice) => {
    setDownloading(inv.id);
    try {
      await downloadFinanceDoc({
        kind: "invoice",
        number: inv.number ?? "INVOICE",
        partyName: residentName,
        date: inv.issue_date ?? new Date().toISOString(),
        dueDate: inv.due_date,
        lines: [{ description: inv.period_label || inv.category || "Services", tax: inv.vat_ugx, amount: inv.subtotal_ugx }],
        subtotal: inv.subtotal_ugx,
        tax: inv.vat_ugx,
        total: inv.total_ugx,
      });
    } catch {
      toast.error("Could not build the PDF.");
    } finally {
      setDownloading(null);
    }
  };

  if (contracts.isLoading || invoices.isLoading)
    return <div className="mono text-xs text-muted-foreground">Loading…</div>;

  const list = contracts.data ?? [];
  const invs = invoices.data ?? [];
  const current = list.filter((c) => !c.is_historical);
  const past = list.filter((c) => c.is_historical);

  const invoicedTotal = invs.reduce((s, i) => s + (i.total_ugx ?? 0), 0);
  const paidTotal =
    invs.reduce((s, i) => s + (i.amount_paid_ugx ?? 0), 0) +
    list.reduce((s, c) => s + (c.paid_before_system_ugx ?? 0), 0);
  const contractTotal = current.reduce((s, c) => s + (c.value_ugx ?? 0), 0);
  const outstanding = Math.max(0, Math.max(contractTotal, invoicedTotal) - paidTotal);

  return (
    <div className="space-y-14">
      {/* Money summary */}
      <div>
        <div className={lbl + " mb-3"}>Your account at a glance</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-8 border-t border-b border-border py-8">
          <div>
            <div className={lbl}>Contract value</div>
            <div className="display text-2xl mt-2">{fmtUGX(contractTotal)}</div>
          </div>
          <div>
            <div className={lbl}>Invoiced</div>
            <div className="display text-2xl mt-2">{fmtUGX(invoicedTotal)}</div>
          </div>
          <div>
            <div className={lbl}>Paid</div>
            <div className="display text-2xl mt-2">{fmtUGX(paidTotal)}</div>
          </div>
          <div>
            <div className={lbl}>Still owed</div>
            <div className={`display text-2xl mt-2 ${outstanding > 0 ? "text-site-red" : ""}`}>{fmtUGX(outstanding)}</div>
          </div>
        </div>
      </div>

      {/* Contracts */}
      <div>
        <div className={lbl + " mb-6"}>Contract · {current.length || "none active"}</div>
        {!list.length ? (
          <p className="text-muted-foreground">No contract on file yet. Ask the office if that looks wrong.</p>
        ) : (
          <div className="space-y-10">
            {current.map((c) => (
              <ContractCard key={c.id} c={c} onOpenFile={openSignedCopy} />
            ))}
            {past.length > 0 && (
              <div>
                <div className={lbl + " mb-4 mt-4"}>Earlier contracts</div>
                <div className="space-y-10">
                  {past.map((c) => (
                    <ContractCard key={c.id} c={c} onOpenFile={openSignedCopy} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Invoices */}
      <div>
        <div className={lbl + " mb-6"}>Invoices · {invs.length}</div>
        {!invs.length ? (
          <p className="text-muted-foreground">No invoices yet.</p>
        ) : (
          <ul className="border-t border-border">
            {invs.map((inv) => {
              const owed = Math.max(0, (inv.total_ugx ?? 0) - (inv.amount_paid_ugx ?? 0));
              const paid = owed === 0 && (inv.total_ugx ?? 0) > 0;
              return (
                <li key={inv.id} className="py-6 border-b border-border">
                  <div className="flex flex-wrap items-baseline justify-between gap-4">
                    <div>
                      <div className="display text-xl">{inv.number ?? "Invoice"}</div>
                      <div className={lbl + " mt-1"}>
                        {inv.period_label || inv.category || "Services"}
                        <span className="opacity-50 mx-2">·</span>
                        issued {fmtDate(inv.issue_date)}
                        {inv.due_date && (
                          <>
                            <span className="opacity-50 mx-2">·</span>
                            due {fmtDate(inv.due_date)}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="display text-xl">{fmtUGX(inv.total_ugx)}</div>
                      <div className={`mono text-[10px] uppercase tracking-[0.3em] mt-1 ${paid ? "text-muted-foreground" : "text-site-red"}`}>
                        {paid ? "Paid in full" : `${fmtUGX(owed)} outstanding`}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => downloadInvoice(inv)}
                    disabled={downloading === inv.id}
                    className="mt-3 mono text-[10px] uppercase tracking-[0.3em] text-site-red hover:underline disabled:opacity-50"
                  >
                    {downloading === inv.id ? "Building PDF…" : "Download invoice PDF →"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground mt-4">
          Payment details are printed on every invoice.
        </p>
      </div>
    </div>
  );
}

function ContractCard({ c, onOpenFile }: { c: Contract; onOpenFile: (path: string) => void }) {
  const services = servicesList(c.services);
  return (
    <article className="border-t border-border pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h3 className="display text-2xl md:text-3xl">{c.title}</h3>
        <div className={lbl}>{STATUS_LABEL[c.status] ?? c.status}</div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-10 mt-6 text-sm">
        <Field k="Type" v={c.contract_type ?? "Not set"} />
        <Field k="Runs" v={`${fmtDate(c.starts_on)} to ${fmtDate(c.ends_on)}`} />
        <Field k="Length" v={c.months ? `${c.months} months` : "Not set"} />
        <Field k="Monthly retainer" v={c.monthly_retainer_ugx ? fmtUGX(c.monthly_retainer_ugx) : "Not set"} />
        <Field k="Total value" v={c.value_ugx ? fmtUGX(c.value_ugx) : "Not set"} />
        <Field k="VAT" v={VAT_LABEL[c.vat_mode ?? "unknown"] ?? "Not set"} />
        <Field k="Payment terms" v={c.payment_terms ?? "Not set"} />
        <Field
          k="Invoicing"
          v={
            c.invoice_day
              ? `Invoiced on day ${c.invoice_day} of each month${c.due_days ? `, due within ${c.due_days} days` : ""}`
              : "Not set"
          }
        />
        <Field k="Notice period" v={c.notice_days ? `${c.notice_days} days` : "Not set"} />
        <Field k="Renewal" v={c.renewal_terms ?? "Not set"} />
        <Field k="Your signatory" v={c.client_signatory ?? "Not set"} />
        <Field k="Site 99 signatory" v={c.site99_signatory ?? "Not set"} />
      </div>

      {services.length > 0 && (
        <div className="mt-6">
          <div className={lbl + " mb-2"}>What is covered</div>
          <ul className="flex flex-wrap gap-2">
            {services.map((s) => (
              <li key={s} className="mono text-[10px] uppercase tracking-[0.2em] border border-border rounded-full px-3 py-1">
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {c.notes && <p className="mt-5 text-sm text-muted-foreground max-w-2xl whitespace-pre-line">{c.notes}</p>}

      {c.file_path && (
        <button
          onClick={() => onOpenFile(c.file_path!)}
          className="mt-5 mono text-[10px] uppercase tracking-[0.3em] text-site-red hover:underline"
        >
          Open the signed copy →
        </button>
      )}
    </article>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className={lbl}>{k}</div>
      <div className="mt-1">{v}</div>
    </div>
  );
}

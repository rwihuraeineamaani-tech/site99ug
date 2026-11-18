import { useEffect, useState } from "react";
import { Download, FileText, Image as ImageIcon, Receipt, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePortalClient } from "@/hooks/usePortalClient";
import PortalPage, { PortalCard, PortalEmpty } from "@/components/portal/PortalPage";
import DocViewer, { saveBlob, type ViewDoc } from "@/components/portal/DocViewer";
import { StatusChip } from "@/components/system";
import { buildFinanceDoc, loadReceipts, receiptDoc, type ReceiptRow } from "@/lib/financeDocs";
import { contractPdfBlob, type ContractForPdf } from "@/lib/contractPdf";
import { monthLabel } from "@/lib/clientMonth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type Contract = ContractForPdf & { id: string; file_path: string | null; is_historical: boolean | null };
type Invoice = {
  id: string; number: string | null; status: string; period_label: string | null; category: string | null;
  issue_date: string | null; due_date: string | null; subtotal_ugx: number; vat_ugx: number; total_ugx: number; amount_paid_ugx: number;
};
type Report = { id: string; month: string; file_path: string | null; file_name: string | null };
type BrandFile = { id: string; label: string | null; category: string | null; file_path: string; mime_type: string | null; created_at: string };
type Row = { key: string; title: string; meta: string; status?: string; icon: typeof FileText; doc: ViewDoc };

const fmt = (d?: string | null) => (d ? new Date(d.length <= 10 ? d + "T12:00:00" : d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "not set");
const ugx = (n: number) => `UGX ${Math.round(n).toLocaleString("en-US")}`;
const safe = (s: string) => s.replace(/[^\w.-]+/g, "_");

async function storageBlob(bucket: string, path: string) {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) throw new Error("We could not open that file. Ask your Site 99 contact.");
  return data;
}

export default function PortalDocuments() {
  const { client, clientId, loading } = usePortalClient();
  const [groups, setGroups] = useState<{ title: string; empty: string; rows: Row[] }[] | null>(null);
  const [open, setOpen] = useState<ViewDoc | null>(null);

  useEffect(() => {
    if (!clientId || !client) return;
    let off = false;
    (async () => {
      const name = client.name;
      const [ct, inv, rp, bf] = await Promise.all([
        supabase.from("resident_contracts").select("*").eq("resident_id", clientId).order("starts_on", { ascending: false }),
        supabase.from("invoices").select("id, number, status, period_label, category, issue_date, due_date, subtotal_ugx, vat_ugx, total_ugx, amount_paid_ugx")
          .eq("resident_id", clientId).eq("direction", "out").neq("status", "draft").order("issue_date", { ascending: false }),
        db.from("client_reports").select("id, month, file_path, file_name").eq("resident_id", clientId).eq("published", true).not("file_path", "is", null).order("month", { ascending: false }),
        db.from("client_files").select("id, label, category, file_path, mime_type, created_at").eq("resident_id", clientId).order("created_at", { ascending: false }),
      ]);
      const contracts = (ct.data ?? []) as unknown as Contract[];
      const invoices = (inv.data ?? []) as unknown as Invoice[];
      const receiptSets = await Promise.all(invoices.filter((i) => (i.amount_paid_ugx ?? 0) > 0).map(async (i) => ({ i, rows: await loadReceipts(i.id).catch(() => [] as ReceiptRow[]) })));
      if (off) return;

      const contractRows: Row[] = contracts.map((c) => ({
        key: c.id, title: c.title, status: c.status, icon: ScrollText,
        meta: `${fmt(c.starts_on)} to ${fmt(c.ends_on)}${c.value_ugx ? ` · ${ugx(c.value_ugx)}` : ""} · ${c.file_path ? "Signed copy" : "Contract terms PDF"}`,
        doc: c.file_path
          ? { title: `${c.title} (signed copy)`, filename: `${safe(c.title)}.${c.file_path.split(".").pop()}`, load: () => storageBlob("resident-contracts", c.file_path!) }
          : { title: `${c.title} (contract terms)`, filename: `Contract_${safe(c.title)}.pdf`, load: () => contractPdfBlob(c, name) },
      }));
      const invoiceRows: Row[] = invoices.map((i) => ({
        key: i.id, title: `Invoice ${i.number ?? ""}`.trim(), status: i.status, icon: FileText,
        meta: `${i.period_label || i.category || "Services"} · issued ${fmt(i.issue_date)} · ${ugx(i.total_ugx ?? 0)}`,
        doc: {
          title: `Invoice ${i.number ?? ""}`, filename: `Invoice_${i.number ?? i.id.slice(0, 6)}_${safe(name)}.pdf`,
          load: async () => (await buildFinanceDoc({
            kind: "invoice", number: i.number ?? "INVOICE", partyName: name, date: i.issue_date ?? new Date().toISOString(), dueDate: i.due_date,
            periodLabel: i.period_label, lines: [{ description: i.period_label || i.category || "Services", tax: i.vat_ugx, amount: i.subtotal_ugx }],
            subtotal: i.subtotal_ugx, tax: i.vat_ugx, total: i.total_ugx, vatExempt: !i.vat_ugx, amountPaid: i.amount_paid_ugx, status: i.status,
          })).output("blob"),
        },
      }));
      const receiptRows: Row[] = receiptSets.flatMap(({ i, rows }) => rows.map((r) => ({
        key: r.entry_id, title: `Receipt ${r.doc_number ?? ""}`.trim(), icon: Receipt,
        meta: `${fmt(r.entry_date)} · ${ugx(r.amount_ugx)} towards ${i.number ?? "invoice"}`,
        doc: { title: `Receipt ${r.doc_number ?? ""}`, filename: `Receipt_${r.doc_number ?? r.entry_id.slice(0, 6)}_${safe(name)}.pdf`,
          load: async () => (await buildFinanceDoc(receiptDoc({ ...i, vat_rate: null }, r, { name }, rows))).output("blob") },
      })));
      const reportRows: Row[] = ((rp.data ?? []) as Report[]).map((r) => ({
        key: r.id, title: `${monthLabel(r.month)} report`, icon: FileText, meta: r.file_name ?? "Report file",
        doc: { title: `${monthLabel(r.month)} report`, filename: r.file_name ?? `Report_${r.month.slice(0, 7)}`, load: () => storageBlob("resident-files", r.file_path!) },
      }));
      const fileRows: Row[] = ((bf.data ?? []) as BrandFile[]).map((f) => {
        const fname = f.file_path.split("/").pop() ?? "file";
        return {
          key: f.id, title: f.label || fname, icon: f.mime_type?.startsWith("image/") ? ImageIcon : FileText,
          meta: `${f.category ?? "File"} · added ${fmt(f.created_at)}`,
          doc: { title: f.label || fname, filename: fname, load: () => storageBlob("resident-files", f.file_path) },
        };
      });
      setGroups([
        { title: "Contracts", empty: "No contracts yet.", rows: contractRows },
        { title: "Invoices", empty: "No invoices sent yet.", rows: invoiceRows },
        { title: "Receipts", empty: "No payments received yet.", rows: receiptRows },
        { title: "Monthly reports", empty: "No report files published yet.", rows: reportRows },
        { title: "Brand files", empty: "No brand files shared yet.", rows: fileRows },
      ]);
    })().catch(() => toast.error("Could not load your documents."));
    return () => { off = true; };
  }, [clientId, client?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  const download = async (d: ViewDoc) => {
    try { saveBlob(await d.load(), d.filename); } catch (e) { toast.error(e instanceof Error ? e.message : "Could not download."); }
  };

  return (
    <PortalPage title="Documents" lede="Every contract, invoice, receipt, report and file between you and Site 99. Tap one to read it." client={client} loading={loading}>
      {!groups ? <p className="text-sm text-ink-faint">Gathering your documents…</p> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map((g) => (
            <PortalCard key={g.title} title={g.title} hint={`${g.rows.length}`}>
              {g.rows.length === 0 ? <PortalEmpty>{g.empty}</PortalEmpty> : (
                <ul className="space-y-2">
                  {g.rows.map((r) => (
                    <li key={r.key} className="flex items-stretch gap-2">
                      <button onClick={() => setOpen(r.doc)} className="press flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-hairline px-3 py-3 text-left hover:bg-paper-raised">
                        <r.icon className="h-5 w-5 shrink-0 text-signal" />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2"><span className="truncate text-sm">{r.title}</span>{r.status && <StatusChip value={r.status} />}</span>
                          <span className="mt-0.5 block text-xs text-ink-faint">{r.meta}</span>
                        </span>
                      </button>
                      <button aria-label={`Download ${r.title}`} onClick={() => download(r.doc)} className="press shrink-0 rounded-xl border border-hairline px-3 text-ink-soft hover:text-ink">
                        <Download className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </PortalCard>
          ))}
        </div>
      )}
      <DocViewer doc={open} onClose={() => setOpen(null)} />
    </PortalPage>
  );
}

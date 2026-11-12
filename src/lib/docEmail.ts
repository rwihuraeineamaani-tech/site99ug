/** Sends an invoice or receipt email to one client address through the app email service. */
import { supabase } from "@/integrations/supabase/client";
import { paymentLines, type DocProfile } from "@/lib/financeDocs";

export const PORTAL_BILLING_URL = "https://site99ug.com/residents/portal?tab=contract";
const ugx = (n: number) => `UGX ${Math.round(n).toLocaleString("en-US")}`;
const day = (iso?: string | null) =>
  iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";

export async function emailInvoice(args: {
  invoiceId: string;
  to: string;
  clientName: string;
  number: string;
  period?: string | null;
  issueDate: string;
  dueDate?: string | null;
  subtotal: number;
  vat: number;
  total: number;
  paid: number;
  profile: DocProfile;
}) {
  const { error } = await supabase.functions.invoke("send-transactional-email", {
    body: {
      templateName: "invoice-issued",
      recipientEmail: args.to,
      idempotencyKey: `invoice-issued-${args.invoiceId}-${args.to}-${Date.now()}`,
      templateData: {
        clientName: args.clientName,
        invoiceNumber: args.number,
        period: args.period ?? "",
        issueDate: day(args.issueDate),
        dueDate: day(args.dueDate ?? args.issueDate),
        subtotal: ugx(args.subtotal),
        vat: args.vat ? ugx(args.vat) : "Not charged",
        total: ugx(args.total),
        paid: args.paid ? ugx(args.paid) : "",
        balance: ugx(Math.max(0, args.total - args.paid)),
        payLines: paymentLines(args.profile),
        terms: args.profile.invoice_terms ?? "",
        portalUrl: PORTAL_BILLING_URL,
        signoff: args.profile.signatory_name ? `${args.profile.signatory_name}, ${args.profile.signatory_title ?? "Finance"}` : "Site 99 Finance",
      },
    },
  });
  if (error) throw error;
  await supabase.rpc("mark_invoice_emailed", { _invoice: args.invoiceId, _to: args.to });
}

export async function emailReceipt(args: {
  entryId: string;
  to: string;
  clientName: string;
  receiptNumber: string;
  invoiceNumber?: string | null;
  amount: number;
  date: string;
  method?: string | null;
  tid?: string | null;
  balance?: number | null;
  profile: DocProfile;
}) {
  const { error } = await supabase.functions.invoke("send-transactional-email", {
    body: {
      templateName: "payment-receipt",
      recipientEmail: args.to,
      idempotencyKey: `payment-receipt-${args.entryId}-${args.to}-${Date.now()}`,
      templateData: {
        clientName: args.clientName,
        receiptNumber: args.receiptNumber,
        invoiceNumber: args.invoiceNumber ?? "",
        amount: ugx(args.amount),
        date: day(args.date),
        method: args.method ?? "",
        tid: args.tid ?? "",
        balance: args.balance != null ? (args.balance > 0 ? ugx(args.balance) : "Paid in full") : "",
        note: args.profile.receipt_note ?? "",
        portalUrl: PORTAL_BILLING_URL,
      },
    },
  });
  if (error) throw error;
}

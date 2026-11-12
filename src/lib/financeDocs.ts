/** Official Site 99 invoice and receipt PDFs: letterhead, TIN, VAT line, payment details, terms and signature. */
import { jsPDF } from "jspdf";
import logoSrc from "@/assets/site99-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { amountInWords } from "@/lib/amountWords";

export type DocProfile = {
  company_name: string;
  tin: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_branch: string | null;
  bank_swift: string | null;
  momo_name: string | null;
  momo_code: string | null;
  momo_network: string | null;
  invoice_terms: string | null;
  receipt_note: string | null;
  signatory_name: string | null;
  signatory_title: string | null;
};

export const DEFAULT_PROFILE: DocProfile = {
  company_name: "Site 99 UG LTD",
  tin: null,
  address: "Kampala, Uganda",
  phone: null,
  email: "office@site99ug.com",
  website: "site99ug.com",
  bank_name: null,
  bank_account_name: null,
  bank_account_number: null,
  bank_branch: null,
  bank_swift: null,
  momo_name: "KEVIN KYOBE (HEAD FINANCE)",
  momo_code: "71599788",
  momo_network: "MTN MoMo",
  invoice_terms: "Payment is due by the date shown. Please quote the invoice number when you pay.",
  receipt_note: "Thank you for your payment.",
  signatory_name: null,
  signatory_title: "Head of Finance",
};

export async function loadDocProfile(): Promise<DocProfile> {
  const { data } = await supabase.from("document_profile").select("*").eq("id", 1).maybeSingle();
  return { ...DEFAULT_PROFILE, ...((data ?? {}) as Partial<DocProfile>) };
}

/** Lines printed under "Pay by" on invoices and in invoice emails. */
export function paymentLines(p: DocProfile): string[] {
  const out: string[] = [];
  if (p.bank_name && p.bank_account_number)
    out.push(`Bank: ${p.bank_name}, ${p.bank_account_name ?? p.company_name}, account ${p.bank_account_number}${p.bank_branch ? `, ${p.bank_branch} branch` : ""}`);
  if (p.momo_code) out.push(`${p.momo_network ?? "Mobile money"}: merchant code ${p.momo_code}${p.momo_name ? ` (${p.momo_name})` : ""}`);
  return out;
}

const RED: [number, number, number] = [200, 30, 36];
const INK: [number, number, number] = [20, 20, 22];
const SOFT: [number, number, number] = [105, 105, 110];
const LINE: [number, number, number] = [222, 220, 216];

export type DocLine = { description: string; tax: number; amount: number };
export type FinanceDoc = {
  kind: "invoice" | "receipt";
  number: string;
  partyName: string;
  partyAddress?: string | null;
  partyEmail?: string | null;
  date: string;
  dueDate?: string | null;
  periodLabel?: string | null;
  contractLabel?: string | null;
  linkedInvoice?: string | null;
  lines: DocLine[];
  subtotal: number;
  tax: number;
  total: number;
  vatRate?: number | null;
  vatExempt?: boolean;
  /** Invoice only: money already received against it. */
  amountPaid?: number;
  /** Receipt only. */
  paymentMethod?: string;
  tid?: string | null;
  balanceAfter?: number | null;
  status?: string | null;
};

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const longDate = (iso?: string | null) => {
  if (!iso) return "Not set";
  const x = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  return x.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
};

let logoCache: { data: string; w: number; h: number } | null = null;
async function logo() {
  if (logoCache) return logoCache;
  const img = new Image();
  img.src = logoSrc;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = img.naturalWidth || 1;
  c.height = img.naturalHeight || 1;
  c.getContext("2d")?.drawImage(img, 0, 0);
  logoCache = { data: c.toDataURL("image/png"), w: c.width, h: c.height };
  return logoCache;
}

export async function buildFinanceDoc(doc: FinanceDoc, profile?: DocProfile) {
  const p = profile ?? (await loadDocProfile());
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 48;
  const isInv = doc.kind === "invoice";
  const right = W - M;

  const ink = () => pdf.setTextColor(...INK);
  const soft = () => pdf.setTextColor(...SOFT);
  const label = (s: string, x: number, y: number, align: "left" | "right" = "left") => {
    pdf.setFont("helvetica", "bold").setFontSize(7.5);
    soft();
    pdf.text(s.toUpperCase(), x, y, { align, charSpace: 0.6 });
    ink();
  };

  // Letterhead
  pdf.setFillColor(...RED).rect(0, 0, W, 6, "F");
  try {
    const l = await logo();
    const h = 42;
    pdf.addImage(l.data, "PNG", M, 30, (l.w / l.h) * h, h);
  } catch {
    pdf.setFont("helvetica", "bold").setFontSize(24);
    ink();
    pdf.text("Site 99", M, 62);
  }
  pdf.setFont("helvetica", "bold").setFontSize(10.5);
  ink();
  pdf.text(p.company_name, right, 40, { align: "right" });
  pdf.setFont("helvetica", "normal").setFontSize(8.5);
  soft();
  const head = [p.address, [p.phone, p.email].filter(Boolean).join("  |  "), p.website, p.tin ? `TIN ${p.tin}` : null].filter(Boolean) as string[];
  head.forEach((s, i) => pdf.text(s, right, 53 + i * 11, { align: "right" }));
  ink();
  const ruleY = Math.max(92, 53 + head.length * 11 + 6);
  pdf.setDrawColor(...LINE).setLineWidth(0.8).line(M, ruleY, right, ruleY);

  // Title row
  let y = ruleY + 40;
  pdf.setFont("helvetica", "bold").setFontSize(26);
  ink();
  pdf.text(isInv ? "Invoice" : "Receipt", M, y);
  pdf.setFontSize(12).setTextColor(...RED);
  pdf.text(doc.number, right, y - 12, { align: "right" });
  const owed = isInv ? Math.max(0, doc.total - (doc.amountPaid ?? 0)) : 0;
  const badge = isInv ? (doc.status === "void" ? "VOID" : owed === 0 && doc.total > 0 ? "PAID IN FULL" : (doc.amountPaid ?? 0) > 0 ? "PART PAID" : "PAYMENT DUE") : "PAID";
  pdf.setFontSize(8);
  const bw = pdf.getTextWidth(badge) + 16;
  const paidLike = badge.startsWith("PAID");
  pdf.setDrawColor(...(paidLike ? ([22, 128, 74] as [number, number, number]) : RED));
  pdf.setTextColor(...(paidLike ? ([22, 128, 74] as [number, number, number]) : RED));
  pdf.roundedRect(right - bw, y - 5, bw, 16, 8, 8, "S");
  pdf.text(badge, right - bw / 2, y + 6, { align: "center", charSpace: 0.5 });
  ink();

  // Parties and details
  y += 34;
  const colR = W / 2 + 30;
  label(isInv ? "Billed to" : "Received from", M, y);
  label(isInv ? "Invoice details" : "Receipt details", colR, y);
  pdf.setFont("helvetica", "bold").setFontSize(11);
  pdf.text(pdf.splitTextToSize(doc.partyName, colR - M - 20)[0], M, y + 16);
  pdf.setFont("helvetica", "normal").setFontSize(9);
  soft();
  let py = y + 30;
  for (const s of [doc.partyAddress || "Kampala, Uganda", doc.partyEmail || ""]) {
    if (!s) continue;
    pdf.splitTextToSize(s, colR - M - 20).slice(0, 2).forEach((t: string) => {
      pdf.text(t, M, py);
      py += 11;
    });
  }
  ink();
  const meta: [string, string][] = isInv
    ? [
        ["Invoice number", doc.number],
        ["Date issued", longDate(doc.date)],
        ["Due date", longDate(doc.dueDate ?? doc.date)],
        ...(doc.periodLabel ? ([["Period", doc.periodLabel]] as [string, string][]) : []),
        ...(doc.contractLabel ? ([["Contract", doc.contractLabel]] as [string, string][]) : []),
      ]
    : [
        ["Receipt number", doc.number],
        ["Date received", longDate(doc.date)],
        ["For invoice", doc.linkedInvoice || "General payment"],
        ["Paid by", doc.paymentMethod || "Not recorded"],
        ...(doc.tid ? ([["Transaction ID", doc.tid]] as [string, string][]) : []),
      ];
  let my = y + 16;
  pdf.setFontSize(9);
  for (const [k, v] of meta) {
    soft();
    pdf.setFont("helvetica", "normal").text(k, colR, my);
    ink();
    pdf.setFont("helvetica", "bold").text(pdf.splitTextToSize(v, right - colR - 90)[0], right, my, { align: "right" });
    my += 14;
  }

  // Line items
  y = Math.max(py, my) + 22;
  const cNo = M + 10, cDesc = M + 34, cTax = right - 150, cAmt = right - 10;
  pdf.setFillColor(...INK).rect(M, y, right - M, 24, "F");
  pdf.setTextColor(255, 255, 255).setFont("helvetica", "bold").setFontSize(8.5);
  pdf.text("#", cNo, y + 16);
  pdf.text("DESCRIPTION", cDesc, y + 16, { charSpace: 0.4 });
  pdf.text("VAT", cTax, y + 16, { align: "right", charSpace: 0.4 });
  pdf.text("AMOUNT (UGX)", cAmt, y + 16, { align: "right", charSpace: 0.4 });
  ink();
  y += 24;
  pdf.setFont("helvetica", "normal").setFontSize(9.5);
  doc.lines.forEach((l, i) => {
    const wrapped = pdf.splitTextToSize(l.description, cTax - cDesc - 60);
    const rowH = Math.max(26, wrapped.length * 12 + 14);
    if (y + rowH > H - 250) {
      pdf.addPage();
      y = 60;
    }
    if (i % 2 === 1) pdf.setFillColor(247, 246, 244).rect(M, y, right - M, rowH, "F");
    soft();
    pdf.text(String(i + 1), cNo, y + 17);
    ink();
    pdf.text(wrapped, cDesc, y + 17);
    pdf.text(l.tax ? fmt(l.tax) : "0", cTax, y + 17, { align: "right" });
    pdf.setFont("helvetica", "bold").text(fmt(l.amount), cAmt, y + 17, { align: "right" });
    pdf.setFont("helvetica", "normal");
    y += rowH;
  });
  pdf.setDrawColor(...LINE).line(M, y, right, y);

  // Totals
  y += 18;
  const tL = right - 230;
  const vatLabel = doc.vatExempt || !doc.tax ? "VAT (exempt / not charged)" : `VAT${doc.vatRate ? ` (${Math.round(doc.vatRate * 100)}%)` : ""}`;
  const rows: [string, number][] = [["Subtotal", doc.subtotal], [vatLabel, doc.tax], ["Total", doc.total]];
  if (isInv && (doc.amountPaid ?? 0) > 0) rows.push(["Paid to date", -(doc.amountPaid ?? 0)]);
  pdf.setFontSize(9.5);
  for (const [k, v] of rows) {
    soft();
    pdf.setFont("helvetica", "normal").text(k, tL, y);
    ink();
    pdf.setFont("helvetica", k === "Total" ? "bold" : "normal").text(v < 0 ? `(${fmt(-v)})` : fmt(v), right, y, { align: "right" });
    y += 16;
  }
  y += 2;
  pdf.setFillColor(...RED).roundedRect(tL - 10, y - 4, right - tL + 10, 30, 4, 4, "F");
  pdf.setTextColor(255, 255, 255).setFont("helvetica", "bold").setFontSize(10);
  pdf.text(isInv ? "BALANCE DUE (UGX)" : "AMOUNT RECEIVED (UGX)", tL, y + 15, { charSpace: 0.4 });
  pdf.setFontSize(13).text(fmt(isInv ? owed : doc.total), right - 8, y + 16, { align: "right" });
  ink();
  y += 44;

  if (!isInv) {
    label("Amount in words", M, y);
    pdf.setFont("helvetica", "italic").setFontSize(9.5);
    pdf.text(pdf.splitTextToSize(amountInWords(doc.total), right - M), M, y + 14);
    y += 34;
    if (doc.balanceAfter != null) {
      pdf.setFont("helvetica", "normal").setFontSize(9);
      soft();
      pdf.text(doc.balanceAfter > 0 ? `Balance still due on ${doc.linkedInvoice}: UGX ${fmt(doc.balanceAfter)}` : `${doc.linkedInvoice ?? "This invoice"} is now paid in full.`, M, y);
      ink();
      y += 20;
    }
  }

  // Payment details (invoice)
  if (isInv) {
    if (y > H - 240) {
      pdf.addPage();
      y = 60;
    }
    label("How to pay", M, y);
    y += 10;
    const boxes: { title: string; lines: string[] }[] = [];
    if (p.bank_name && p.bank_account_number)
      boxes.push({
        title: "Bank transfer",
        lines: [p.bank_name, `Account name: ${p.bank_account_name ?? p.company_name}`, `Account no: ${p.bank_account_number}`, p.bank_branch ? `Branch: ${p.bank_branch}` : "", p.bank_swift ? `SWIFT: ${p.bank_swift}` : ""].filter(Boolean),
      });
    if (p.momo_code)
      boxes.push({
        title: p.momo_network || "Mobile money",
        lines: [`Merchant code: ${p.momo_code}`, p.momo_name ? `Name: ${p.momo_name}` : "", "Send the transaction ID to Finance"].filter(Boolean),
      });
    const bwid = boxes.length > 1 ? (right - M - 12) / 2 : right - M;
    boxes.forEach((b, i) => {
      const x = M + i * (bwid + 12);
      const bh = 22 + b.lines.length * 12;
      pdf.setDrawColor(...LINE).roundedRect(x, y, bwid, bh, 4, 4, "S");
      pdf.setFont("helvetica", "bold").setFontSize(9.5).text(b.title, x + 10, y + 16);
      pdf.setFont("helvetica", "normal").setFontSize(8.5);
      soft();
      b.lines.forEach((s, j) => pdf.text(s, x + 10, y + 30 + j * 12));
      ink();
    });
    y += 22 + Math.max(0, ...boxes.map((b) => b.lines.length)) * 12 + 18;
  }

  // Terms
  const terms = isInv ? p.invoice_terms : p.receipt_note;
  if (terms) {
    label(isInv ? "Terms" : "Note", M, y);
    pdf.setFont("helvetica", "normal").setFontSize(8.5);
    soft();
    const t = pdf.splitTextToSize(terms, right - M - 200);
    pdf.text(t, M, y + 13);
    ink();
  }

  // Signature and stamp
  const sy = Math.max(y + 10, H - 150);
  pdf.setDrawColor(...INK).setLineWidth(0.6).line(right - 180, sy + 30, right, sy + 30);
  pdf.setFont("helvetica", "bold").setFontSize(9).text(p.signatory_name || "For Site 99 UG LTD", right, sy + 43, { align: "right" });
  pdf.setFont("helvetica", "normal").setFontSize(8);
  soft();
  pdf.text(`${p.signatory_title || "Authorised signatory"}, authorised signature`, right, sy + 54, { align: "right" });
  ink();
  if (!isInv || badge === "PAID IN FULL") {
    const green: [number, number, number] = [22, 128, 74];
    pdf.setDrawColor(...green).setTextColor(...green).setLineWidth(1.6);
    pdf.roundedRect(M, sy, 120, 50, 6, 6, "S");
    pdf.setFont("helvetica", "bold").setFontSize(18).text("PAID", M + 60, sy + 25, { align: "center", charSpace: 2 });
    pdf.setFontSize(7.5).text(`${p.company_name.toUpperCase()}  ${longDate(doc.date).toUpperCase()}`, M + 60, sy + 39, { align: "center" });
    ink();
    pdf.setLineWidth(0.6);
  }

  // Footer on every page
  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.setDrawColor(...LINE).line(M, H - 50, right, H - 50);
    pdf.setFont("helvetica", "normal").setFontSize(7.5);
    soft();
    pdf.text([p.company_name, p.tin ? `TIN ${p.tin}` : null, p.email, p.website].filter(Boolean).join("  |  "), M, H - 36);
    pdf.text(`${doc.number}  |  Page ${i} of ${pages}`, right, H - 36, { align: "right" });
    pdf.setFillColor(...RED).rect(0, H - 6, W, 6, "F");
  }
  return pdf;
}

export async function downloadFinanceDoc(doc: FinanceDoc, profile?: DocProfile) {
  const pdf = await buildFinanceDoc(doc, profile);
  const safe = doc.partyName.replace(/[^\w]+/g, "_");
  pdf.save(`${doc.kind === "invoice" ? "Invoice" : "Receipt"}_${doc.number}_${safe}.pdf`);
}

export type ReceiptRow = {
  entry_id: string;
  doc_number: string | null;
  entry_date: string;
  amount_ugx: number;
  tid: string | null;
  reference: string | null;
  account_name: string | null;
  account_kind: string | null;
};

/** Every payment linked to an invoice is its own receipt, numbered by its cashbook line. */
export async function loadReceipts(invoiceId: string): Promise<ReceiptRow[]> {
  const { data, error } = await supabase.rpc("invoice_receipts", { _invoice: invoiceId });
  if (error) throw error;
  return (data ?? []) as ReceiptRow[];
}

type InvoiceLike = {
  number: string | null;
  party_name?: string;
  period_label?: string | null;
  category?: string | null;
  subtotal_ugx: number;
  vat_ugx: number;
  vat_rate?: number | null;
  total_ugx: number;
  amount_paid_ugx: number;
};

/** Receipt for one payment, with VAT split in the same ratio as the invoice. */
export function receiptDoc(
  inv: InvoiceLike,
  r: ReceiptRow,
  party: { name: string; address?: string | null; email?: string | null },
  receipts: ReceiptRow[],
): FinanceDoc {
  const ratio = inv.total_ugx ? r.amount_ugx / inv.total_ugx : 1;
  const idx = Math.max(0, receipts.findIndex((x) => x.entry_id === r.entry_id));
  const upTo = receipts.slice(0, idx + 1);
  const paidSoFar = upTo.reduce((s, x) => s + x.amount_ugx, 0);
  const tax = Math.round(inv.vat_ugx * ratio);
  return {
    kind: "receipt",
    number: r.doc_number ?? `RCT-${r.entry_id.slice(0, 6)}`,
    partyName: party.name,
    partyAddress: party.address,
    partyEmail: party.email,
    date: r.entry_date,
    linkedInvoice: inv.number,
    lines: [{ description: `Payment towards ${inv.number ?? "invoice"}${inv.period_label ? `, ${inv.period_label}` : ""}`, tax, amount: r.amount_ugx - tax }],
    subtotal: r.amount_ugx - tax,
    tax,
    total: r.amount_ugx,
    vatRate: inv.vat_rate,
    paymentMethod: r.account_name ?? undefined,
    tid: r.tid || r.reference,
    balanceAfter: Math.max(0, inv.total_ugx - paidSoFar),
  };
}

/** Branded invoice and receipt PDFs, matching the Site 99 paper templates. */
import { jsPDF } from "jspdf";
import logoSrc from "@/assets/site99-logo.png";

export const PAYMENT_INFO = {
  method: "MTN MOMO",
  details: ["NAME: KEVIN KYOBE (HEAD FINANCE)", "MERCHANT CODE: 71599788"],
};

const RED: [number, number, number] = [200, 30, 36];

export type DocLine = { description: string; tax: number; amount: number };
export type FinanceDoc = {
  kind: "invoice" | "receipt";
  number: string;
  partyName: string;
  partyAddress?: string | null;
  partyEmail?: string | null;
  date: string;
  dueDate?: string | null;
  linkedInvoice?: string | null;
  lines: DocLine[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod?: string;
  paymentDetails?: string[];
};

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const d = (iso?: string | null) => {
  if (!iso) return "—";
  const x = new Date(iso);
  return `${x.getMonth() + 1}/${x.getDate()}/${x.getFullYear()}`;
};

let logoCache: string | null = null;
async function logoData() {
  if (logoCache) return logoCache;
  const img = new Image();
  img.src = logoSrc;
  await img.decode().catch(() => undefined);
  const c = document.createElement("canvas");
  c.width = img.naturalWidth || 1;
  c.height = img.naturalHeight || 1;
  c.getContext("2d")?.drawImage(img, 0, 0);
  logoCache = c.toDataURL("image/png");
  return { data: logoCache, w: c.width, h: c.height } as never;
}

export async function downloadFinanceDoc(doc: FinanceDoc) {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 56;
  const isInv = doc.kind === "invoice";

  // Logo + label
  try {
    const img = new Image();
    img.src = logoSrc;
    await img.decode();
    const h = 34;
    const w = (img.naturalWidth / img.naturalHeight) * h;
    await logoData();
    pdf.addImage(logoCache as string, "PNG", M, 48, w, h);
  } catch {
    pdf.setFont("helvetica", "bold").setFontSize(26).text("Site 99", M, 76);
  }
  pdf.setTextColor(...RED).setFont("helvetica", "bold").setFontSize(11);
  pdf.text(isInv ? "INVOICE" : "RECEIPT", M, 98);
  pdf.setTextColor(0, 0, 0);

  // Party box
  const boxY = 116;
  const boxH = 70;
  pdf.setDrawColor(210).setLineWidth(0.6);
  pdf.rect(M, boxY, W - 2 * M, boxH);
  pdf.line(W / 2 + 20, boxY, W / 2 + 20, boxY + boxH);
  pdf.setFont("helvetica", "bold").setFontSize(12).text(isInv ? "Billed To" : "Received From", M + 8, boxY + 18);
  pdf.setFont("helvetica", "normal").setFontSize(9);
  let py = boxY + 32;
  for (const s of [doc.partyName, doc.partyAddress || "Kampala, Uganda", doc.partyEmail || ""]) {
    if (!s) continue;
    const wrapped = pdf.splitTextToSize(s, W / 2 - M - 20);
    pdf.text(wrapped[0], M + 8, py);
    py += 12;
  }
  const meta: [string, string][] = isInv
    ? [["Invoice Number:", doc.number], ["Date of Issue:", d(doc.date)], ["Due Date:", d(doc.dueDate ?? doc.date)]]
    : [["Receipt Number:", doc.number], ["Date received:", d(doc.date)], ["Invoice ID:", doc.linkedInvoice || "—"]];
  let my = boxY + 18;
  for (const [k, v] of meta) {
    pdf.setFont("helvetica", "bold").text(k, W - M - 8 - pdf.getTextWidth(v) - 4, my, { align: "right" });
    pdf.setFont("helvetica", "normal").text(v, W - M - 8, my, { align: "right" });
    my += 13;
  }

  // Lines table
  const tY = 214;
  const c1 = M, c2 = M + 290, c3 = M + 350;
  pdf.rect(M, tY, W - 2 * M, 22);
  pdf.line(c2 - 6, tY, c2 - 6, tY + 22);
  pdf.line(c3 - 6, tY, c3 - 6, tY + 22);
  pdf.setFont("helvetica", "normal").setFontSize(10);
  pdf.text("Description", c1 + 6, tY + 15);
  pdf.text("Tax", c2, tY + 15);
  pdf.text("Amount (UGX)", c3, tY + 15);
  let ly = tY + 38;
  pdf.setFontSize(9);
  for (const l of doc.lines) {
    const wrapped = pdf.splitTextToSize(l.description, 270);
    pdf.text(wrapped, c1 + 6, ly);
    pdf.text(fmt(l.tax), c2, ly);
    pdf.text(fmt(l.amount), c3, ly);
    ly += wrapped.length * 12 + 8;
  }

  // Totals
  let y = Math.max(ly + 40, 330);
  pdf.setFont("helvetica", "bold").setFontSize(15).text(isInv ? "Totals to be Paid(UGX)" : "Total Paid(UGX)", M, y);
  y += 26;
  pdf.setFontSize(9);
  for (const [k, v] of [["Subtotal:", doc.subtotal], ["Total Tax:", doc.tax], ["Grand Total:", doc.total]] as const) {
    pdf.setFont("helvetica", "bold").text(k, M + 6, y);
    pdf.text(fmt(v), M + 110, y);
    y += 20;
  }

  // Payment information
  y += 20;
  pdf.setFontSize(15).text("Payment Information", M, y);
  y += 24;
  pdf.setFontSize(9).text("Payment Method:", M + 6, y);
  pdf.setFont("helvetica", "normal").text(doc.paymentMethod ?? PAYMENT_INFO.method, M + 6, y + 12);
  y += 34;
  pdf.setFont("helvetica", "bold").text(isInv ? "Payment Details:" : "Payment Details/Transaction ID:", M + 6, y);
  pdf.setFont("helvetica", "normal");
  (doc.paymentDetails ?? PAYMENT_INFO.details).forEach((s, i) => pdf.text(s, M + 6, y + 12 + i * 12));

  // Footer
  pdf.setFontSize(8).setTextColor(140);
  pdf.text("office@site99ug.com | Kampala, Uganda", W / 2, H - 44, { align: "center" });
  pdf.setFontSize(7).text("Generated by Site 99 UG LTD. Thank you!", W / 2, H - 32, { align: "center" });

  const safe = doc.partyName.replace(/[^\w]+/g, "_");
  pdf.save(`${isInv ? "Invoice" : "Receipt"}_${doc.number}_${safe}.pdf`);
}

/** R-YYMM### — built from the paid date and the invoice's own sequence. */
export function receiptNumber(invoiceNumber: string | null, paidOn: string) {
  const x = new Date(paidOn);
  const yymm = `${String(x.getFullYear()).slice(2)}${String(x.getMonth() + 1).padStart(2, "0")}`;
  const seq = (invoiceNumber ?? "").replace(/\D/g, "").slice(-3).padStart(3, "0");
  return `R-${yymm}${seq}`;
}

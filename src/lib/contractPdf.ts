/** Contract terms as a Site 99 PDF, built from the contract record when no signed copy has been uploaded. */
import { jsPDF } from "jspdf";
import { loadDocProfile } from "@/lib/financeDocs";

export type ContractForPdf = {
  title: string; contract_type: string | null; status: string;
  starts_on: string | null; ends_on: string | null; months: number | null;
  monthly_retainer_ugx: number | null; value_ugx: number | null; vat_mode: string | null;
  services: unknown; payment_terms: string | null; invoice_day: number | null; due_days: number | null;
  notice_days: number | null; renewal_terms: string | null; client_signatory: string | null;
  site99_signatory: string | null; notes: string | null;
};

const VAT: Record<string, string> = { inclusive: "VAT included in the figures", exclusive: "VAT added on top of the figures", exempt: "No VAT" };
const ugx = (n: number | null) => (n ? `UGX ${Math.round(n).toLocaleString("en-US")}` : "Not set");
const day = (d: string | null) => (d ? new Date(d + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "Not set");

export async function contractPdfBlob(c: ContractForPdf, clientName: string): Promise<Blob> {
  const p = await loadDocProfile();
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const W = pdf.internal.pageSize.getWidth(); const H = pdf.internal.pageSize.getHeight(); const M = 48;
  pdf.setFillColor(200, 16, 46).rect(0, 0, W, 8, "F");
  pdf.setFont("helvetica", "bold").setFontSize(18).setTextColor(20, 20, 20).text(p.company_name, M, 52);
  pdf.setFont("helvetica", "normal").setFontSize(9).setTextColor(110, 110, 110);
  pdf.text([p.address, p.email, p.website, p.tin ? `TIN ${p.tin}` : null].filter(Boolean).join("  |  "), M, 68);
  pdf.setFont("helvetica", "bold").setFontSize(10).setTextColor(200, 16, 46).text("CONTRACT TERMS", W - M, 52, { align: "right" });
  let y = 110;
  pdf.setTextColor(20, 20, 20).setFontSize(16).text(pdf.splitTextToSize(c.title, W - 2 * M), M, y); y += 24;
  pdf.setFont("helvetica", "normal").setFontSize(10).text(`Between ${p.company_name} and ${clientName}`, M, y); y += 26;
  const rows: [string, string][] = [
    ["Type", c.contract_type ?? "Not set"], ["Runs", `${day(c.starts_on)} to ${day(c.ends_on)}`],
    ["Length", c.months ? `${c.months} months` : "Not set"], ["Monthly retainer", ugx(c.monthly_retainer_ugx)],
    ["Total value", ugx(c.value_ugx)], ["VAT", VAT[c.vat_mode ?? ""] ?? "Not set"],
    ["Payment terms", c.payment_terms ?? "Not set"],
    ["Invoicing", c.invoice_day ? `Day ${c.invoice_day} of each month${c.due_days ? `, due within ${c.due_days} days` : ""}` : "Not set"],
    ["Notice period", c.notice_days ? `${c.notice_days} days` : "Not set"], ["Renewal", c.renewal_terms ?? "Not set"],
  ];
  const services = Array.isArray(c.services) ? c.services.map(String).filter(Boolean) : [];
  if (services.length) rows.push(["What is covered", services.join(", ")]);
  for (const [k, v] of rows) {
    const lines = pdf.splitTextToSize(v, W - M - 190);
    if (y + lines.length * 13 > H - 140) { pdf.addPage(); y = 60; }
    pdf.setDrawColor(225).line(M, y - 11, W - M, y - 11);
    pdf.setFont("helvetica", "bold").setTextColor(110, 110, 110).text(k, M, y);
    pdf.setFont("helvetica", "normal").setTextColor(20, 20, 20).text(lines, M + 150, y);
    y += lines.length * 13 + 10;
  }
  if (c.notes) {
    const lines = pdf.splitTextToSize(c.notes, W - 2 * M);
    if (y + lines.length * 13 > H - 140) { pdf.addPage(); y = 60; }
    y += 8; pdf.setFont("helvetica", "bold").text("Notes", M, y); y += 15;
    pdf.setFont("helvetica", "normal").text(lines, M, y); y += lines.length * 13;
  }
  if (y > H - 150) { pdf.addPage(); y = 60; }
  y = Math.max(y + 40, H - 150);
  pdf.setDrawColor(150);
  pdf.line(M, y, M + 200, y); pdf.line(W - M - 200, y, W - M, y);
  pdf.setFontSize(9).setTextColor(110, 110, 110);
  pdf.text(`For ${clientName}: ${c.client_signatory ?? ""}`, M, y + 14);
  pdf.text(`For ${p.company_name}: ${c.site99_signatory ?? ""}`, W - M - 200, y + 14);
  pdf.setFontSize(7.5).text("Terms as recorded in the Site 99 system. The signed copy, once uploaded, is the binding version.", M, H - 30);
  return pdf.output("blob");
}

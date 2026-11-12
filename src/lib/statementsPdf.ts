import { jsPDF } from "jspdf";
import logoSrc from "@/assets/site99-logo.png";

export type PdfSection = { title: string; rows: [string, number][]; total?: [string, number] };
const ugx = (n: number) => `${n < 0 ? "-" : ""}UGX ${Math.abs(Math.round(n)).toLocaleString()}`;

async function logo(): Promise<string | null> {
  try {
    const img = new Image(); img.src = logoSrc; await img.decode();
    const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext("2d")?.drawImage(img, 0, 0); return c.toDataURL("image/png");
  } catch { return null; }
}

/** A plain, printable finance report: letterhead, sections of label/amount rows, and totals. */
export async function downloadStatementsPdf(title: string, period: string, sections: PdfSection[], file: string) {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const W = pdf.internal.pageSize.getWidth(), H = pdf.internal.pageSize.getHeight(), M = 50;
  const img = await logo();
  if (img) pdf.addImage(img, "PNG", M, 40, 60, 30);
  pdf.setFont("helvetica", "bold").setFontSize(18).text(title, M, 100);
  pdf.setFont("helvetica", "normal").setFontSize(10).setTextColor(110).text(`${period} · Site 99 Uganda · printed ${new Date().toLocaleDateString("en-GB")}`, M, 116);
  pdf.setTextColor(20);
  let y = 145;
  for (const s of sections) {
    if (y > H - 120) { pdf.addPage(); y = 60; }
    pdf.setFont("helvetica", "bold").setFontSize(12).text(s.title, M, y); y += 8;
    pdf.setDrawColor(200).line(M, y, W - M, y); y += 16;
    pdf.setFont("helvetica", "normal").setFontSize(10);
    for (const [l, v] of s.rows) {
      if (y > H - 60) { pdf.addPage(); y = 60; }
      pdf.text(l, M, y); pdf.text(ugx(v), W - M, y, { align: "right" }); y += 15;
    }
    if (s.total) {
      pdf.setFont("helvetica", "bold"); pdf.text(s.total[0], M, y + 2); pdf.text(ugx(s.total[1]), W - M, y + 2, { align: "right" }); y += 17;
    }
    y += 14;
  }
  pdf.save(file);
}

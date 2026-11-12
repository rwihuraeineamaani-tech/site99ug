import { jsPDF } from "jspdf";
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type MonthMetrics = {
  posted: number; posted_on_time: number; shoots: number; ideas: number;
  followers: number | null; reach: number; impressions: number; profile_visits: number; link_clicks: number;
  weeks: { week: string; reach: number; followers: number | null }[];
};

export const monthStart = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1)).toISOString().slice(0, 10);
export const prevMonth = (iso: string) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 10); };
export const monthLabel = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

export async function loadMonthMetrics(residentId: string, month: string): Promise<MonthMetrics> {
  const { data, error } = await db.rpc("client_month_metrics", { _resident: residentId, _month: month });
  if (error) throw new Error(error.message);
  return data as MonthMetrics;
}

/** Percentage change, or null when there is nothing to compare against. */
export function change(now: number | null | undefined, before: number | null | undefined): number | null {
  if (now == null || before == null || before === 0) return null;
  return Math.round(((now - before) / before) * 100);
}

export const METRIC_ROWS: { key: keyof MonthMetrics; label: string }[] = [
  { key: "posted", label: "Videos posted" },
  { key: "posted_on_time", label: "Posted on time" },
  { key: "shoots", label: "Shoot days done" },
  { key: "followers", label: "Followers" },
  { key: "reach", label: "Reach" },
  { key: "impressions", label: "Impressions" },
  { key: "profile_visits", label: "Profile visits" },
  { key: "link_clicks", label: "Link clicks" },
];

const n = (v: unknown) => (typeof v === "number" ? v.toLocaleString("en-GB") : "–");

export function downloadMonthPdf(clientName: string, month: string, m: MonthMetrics, before: MonthMetrics | null, summary?: string | null) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(200, 16, 46); doc.rect(0, 0, W, 70, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(20);
  doc.text("SITE 99", 40, 44);
  doc.setFontSize(11); doc.setFont("helvetica", "normal");
  doc.text(`Monthly results · ${monthLabel(month)}`, W - 40, 44, { align: "right" });
  doc.setTextColor(20, 20, 20); doc.setFontSize(16); doc.setFont("helvetica", "bold");
  doc.text(clientName, 40, 110);
  let y = 135;
  if (summary) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    const lines = doc.splitTextToSize(summary, W - 80); doc.text(lines, 40, y); y += lines.length * 13 + 12;
  }
  doc.setFontSize(10); doc.setFont("helvetica", "bold");
  doc.text("Measure", 40, y); doc.text("This month", 300, y); doc.text("Last month", 400, y); doc.text("Change", 500, y);
  y += 8; doc.setDrawColor(220); doc.line(40, y, W - 40, y); y += 16;
  doc.setFont("helvetica", "normal");
  const max = Math.max(1, ...METRIC_ROWS.map((r) => Number(m[r.key] ?? 0)));
  for (const r of METRIC_ROWS) {
    const v = m[r.key] as number | null; const b = before ? (before[r.key] as number | null) : null; const c = change(v, b);
    doc.text(r.label, 40, y); doc.text(n(v), 300, y); doc.text(n(b), 400, y); doc.text(c == null ? "–" : `${c > 0 ? "+" : ""}${c}%`, 500, y);
    y += 20;
  }
  y += 10; doc.setFont("helvetica", "bold"); doc.text("Weekly reach", 40, y); y += 14;
  const wk = m.weeks ?? []; const wmax = Math.max(1, ...wk.map((w) => w.reach ?? 0));
  wk.forEach((w, i) => {
    const bw = ((w.reach ?? 0) / wmax) * (W - 200);
    doc.setFillColor(200, 16, 46); doc.rect(130, y + i * 22 - 9, Math.max(2, bw), 12, "F");
    doc.setFont("helvetica", "normal"); doc.text(new Date(w.week).toLocaleDateString("en-GB", { day: "numeric", month: "short" }), 40, y + i * 22);
    doc.text(n(w.reach), 135 + bw, y + i * 22);
  });
  if (!wk.length) { doc.setFont("helvetica", "normal"); doc.text("No weekly account numbers recorded this month.", 40, y); }
  void max;
  doc.setFontSize(8); doc.setTextColor(120);
  doc.text("Generated from Site 99 records. Account numbers are entered weekly by your Handler.", 40, doc.internal.pageSize.getHeight() - 30);
  doc.save(`Site99-${clientName.replace(/\s+/g, "-")}-${month.slice(0, 7)}.pdf`);
}

export async function openStorageFile(path: string, download?: string) {
  const { data, error } = await supabase.storage.from("resident-files").createSignedUrl(path, 300, download ? { download } : undefined);
  if (error || !data) throw new Error(error?.message ?? "Could not open file");
  window.open(data.signedUrl, "_blank", "noopener");
}

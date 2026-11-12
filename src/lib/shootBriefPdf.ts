import { jsPDF } from "jspdf";
import logoSrc from "@/assets/site99-logo.png";

export type ShootNeed = { id: string; item: string; qty: number; unit_price_ugx: number; payer: "client" | "site99"; status: "needed" | "ready" | "provided"; note: string | null; visible_to_client: boolean };
export type ShootBrief = {
  id: string; shoot_date: string | null; call_time: string | null; location: string | null; status: string; notes: string | null; client: string | null;
  budget_ugx?: number | null; budget_note?: string | null;
  items: { ref_no: number; title: string; content_type: string | null; notes: string | null; crew_notes?: string | null }[];
  crew: { name: string; role: string }[];
  equipment: { name: string; qty: number }[];
  needs: ShootNeed[];
};

export const ugx = (n: number) => `UGX ${Math.round(n).toLocaleString()}`;
export const NEED_STATUS: Record<ShootNeed["status"], string> = { needed: "Needed", ready: "Ready", provided: "Provided" };
export const briefDate = (d: string | null) => d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "Date to confirm";
export const clientCost = (b: ShootBrief) => b.needs.filter((n) => n.payer === "client" && n.visible_to_client).reduce((t, n) => t + n.qty * n.unit_price_ugx, 0);

async function logo(): Promise<string | null> {
  try {
    const img = new Image(); img.src = logoSrc; await img.decode();
    const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext("2d")?.drawImage(img, 0, 0); return c.toDataURL("image/png");
  } catch { return null; }
}

/** Download the shoot day brief. "client" leaves out crew notes, equipment, budget and hidden items. */
export async function downloadShootBrief(b: ShootBrief, copy: "client" | "team") {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const W = pdf.internal.pageSize.getWidth(), H = pdf.internal.pageSize.getHeight(), M = 50;
  let y = 50;
  const L = await logo();
  if (L) pdf.addImage(L, "PNG", M, y, 60, 30); else pdf.setFont("helvetica", "bold").setFontSize(22).text("Site 99", M, y + 22);
  pdf.setFont("helvetica", "bold").setFontSize(10).setTextColor(200, 30, 36).text(copy === "client" ? "SHOOT DAY BRIEF, CLIENT COPY" : "SHOOT DAY BRIEF, TEAM COPY", W - M, y + 18, { align: "right" });
  pdf.setTextColor(20, 20, 20); y += 60;
  const need = (h: number) => { if (y + h > H - 50) { pdf.addPage(); y = 50; } };
  const head = (t: string) => { need(30); y += 10; pdf.setFont("helvetica", "bold").setFontSize(12).text(t, M, y); y += 6; pdf.setDrawColor(220).line(M, y, W - M, y); y += 14; };
  const line = (t: string, bold = false, size = 10) => { pdf.setFont("helvetica", bold ? "bold" : "normal").setFontSize(size); const rows = pdf.splitTextToSize(t, W - 2 * M) as string[]; need(rows.length * 13); pdf.text(rows, M, y); y += rows.length * 13 + 2; };

  line(b.client ?? "Shoot day", true, 18); y += 4;
  line(briefDate(b.shoot_date));
  line(`Call time: ${b.call_time ?? "to confirm"}    Location: ${b.location ?? "to confirm"}`);
  if (b.notes) { head("Notes"); line(b.notes); }

  head("Videos we are shooting");
  if (!b.items.length) line("Videos to be confirmed.");
  b.items.forEach((i) => { line(`IDEA-${String(i.ref_no).padStart(4, "0")}  ${i.title}${i.content_type ? ` (${i.content_type})` : ""}`, true); if (i.notes) line(i.notes); if (copy === "team" && i.crew_notes) line(`Crew notes: ${i.crew_notes}`); y += 2; });

  head("Site 99 team on the day");
  if (!b.crew.length) line("Crew to be confirmed.");
  b.crew.forEach((c) => line(`${c.name}, ${c.role}`));

  const needs = b.needs.filter((n) => copy === "team" || n.visible_to_client);
  head(copy === "client" ? "What we need from you" : "What we need from the client");
  if (!needs.length) line("Nothing needed from the client.");
  needs.forEach((n) => line(`${n.item}  x${n.qty}   ${n.unit_price_ugx ? ugx(n.qty * n.unit_price_ugx) : ""}   ${n.payer === "client" ? "Client pays or supplies" : "Site 99 covers"}   ${NEED_STATUS[n.status]}${copy === "team" && !n.visible_to_client ? "   (hidden from client)" : ""}${n.note ? `\n${n.note}` : ""}`));
  const cost = needs.filter((n) => n.payer === "client").reduce((t, n) => t + n.qty * n.unit_price_ugx, 0);
  if (cost) { y += 4; line(`Client costs total: ${ugx(cost)}`, true); }

  if (copy === "team") {
    head("Equipment");
    if (!b.equipment.length) line("No equipment booked.");
    b.equipment.forEach((e) => line(`${e.name}  x${e.qty}`));
    head("Budget");
    line(b.budget_ugx ? ugx(b.budget_ugx) : "No budget set");
    if (b.budget_note) line(b.budget_note);
  }

  pdf.setFont("helvetica", "normal").setFontSize(8).setTextColor(130).text("Site 99 · site99ug.com", M, H - 30);
  pdf.save(`shoot-brief-${b.shoot_date ?? "tbc"}-${copy}.pdf`);
}

export async function loadShootBrief(id: string): Promise<ShootBrief> {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data, error } = await supabase.rpc("shoot_day_brief" as never, { _id: id } as never);
  if (error) throw error;
  return data as unknown as ShootBrief;
}

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/system";
import { NEED_STATUS, downloadShootBrief, loadShootBrief, ugx, type ShootNeed } from "@/lib/shootBriefPdf";

const blank = { item: "", qty: "1", price: "", payer: "client" as ShootNeed["payer"], note: "", visible: true };
const field = "field text-sm";

/** Staff: what we need from the client for this shoot, plus client and team brief PDFs. */
export default function ClientNeedsPanel({ dayId }: { dayId: string }) {
  const [rows, setRows] = useState<ShootNeed[]>([]);
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const db = supabase.from("shoot_day_client_needs" as never);

  const load = useCallback(async () => {
    const { data } = await supabase.from("shoot_day_client_needs" as never).select("*").eq("shoot_day_id", dayId).order("created_at");
    setRows((data as unknown as ShootNeed[]) ?? []);
  }, [dayId]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!f.item.trim()) return toast.error("Say what is needed.");
    setBusy(true);
    const { error } = await db.insert({ shoot_day_id: dayId, item: f.item.trim(), qty: Math.max(1, Number(f.qty) || 1), unit_price_ugx: Math.round(Number(f.price) || 0), payer: f.payer, note: f.note.trim() || null, visible_to_client: f.visible } as never);
    setBusy(false);
    if (error) return toast.error(error.message);
    setF(blank); load();
  };
  const patch = async (id: string, v: Partial<ShootNeed>) => {
    const { error } = await supabase.from("shoot_day_client_needs" as never).update(v as never).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };
  const remove = async (id: string) => {
    if (!window.confirm("Remove this item?")) return;
    await supabase.from("shoot_day_client_needs" as never).delete().eq("id", id); load();
  };
  const pdf = async (copy: "client" | "team") => {
    try { await downloadShootBrief(await loadShootBrief(dayId), copy); } catch (e) { toast.error((e as Error).message); }
  };
  const clientTotal = rows.filter((r) => r.payer === "client" && r.visible_to_client).reduce((t, r) => t + r.qty * r.unit_price_ugx, 0);

  return (
    <section className="mt-10">
      <SectionHeading index="00" title="What we need from the client" hint={clientTotal ? `client pays ${ugx(clientTotal)}` : `${rows.length} items`} />
      <div className="mb-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => pdf("client")}><Download className="h-4 w-4" /> Client copy PDF</Button>
        <Button size="sm" variant="outline" onClick={() => pdf("team")}><Download className="h-4 w-4" /> Team copy PDF</Button>
        <span className="self-center text-[11px] text-ink-faint">The client copy leaves out crew notes, gear, budget and hidden items. The client sees this list on their shoot day page.</span>
      </div>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-rule bg-paper-raised px-3 py-2 text-sm">
            <span className="min-w-0 flex-1">{r.item} <span className="text-ink-faint">x{r.qty}</span>{r.note && <span className="block text-xs text-ink-faint">{r.note}</span>}</span>
            {r.unit_price_ugx > 0 && <span className="num text-xs">{ugx(r.qty * r.unit_price_ugx)}</span>}
            <span className="text-[11px] text-ink-faint">{r.payer === "client" ? "Client" : "Site 99"}</span>
            <select className={field} value={r.status} onChange={(e) => patch(r.id, { status: e.target.value as ShootNeed["status"] })}>
              {Object.entries(NEED_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <label className="flex items-center gap-1 text-[11px]"><input type="checkbox" checked={r.visible_to_client} onChange={(e) => patch(r.id, { visible_to_client: e.target.checked })} /> Client sees</label>
            <Button size="icon-sm" variant="ghost" aria-label="Remove" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
          </li>
        ))}
        {rows.length === 0 && <li className="text-sm text-ink-soft">Nothing listed yet. Add products, outfits, access or people the client must bring.</li>}
      </ul>
      <div className="mt-3 grid gap-2 rounded-xl border border-rule bg-paper-sunken p-3 sm:grid-cols-6">
        <input className={`${field} sm:col-span-2`} placeholder="Item, e.g. 3 product samples" value={f.item} onChange={(e) => setF({ ...f, item: e.target.value })} />
        <input className={field} type="number" min={1} placeholder="Qty" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} />
        <input className={field} type="number" min={0} placeholder="Price each (UGX)" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
        <select className={field} value={f.payer} onChange={(e) => setF({ ...f, payer: e.target.value as ShootNeed["payer"] })}><option value="client">Client pays or supplies</option><option value="site99">Site 99 covers</option></select>
        <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={f.visible} onChange={(e) => setF({ ...f, visible: e.target.checked })} /> Client sees</label>
        <input className={`${field} sm:col-span-5`} placeholder="Note (optional)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        <Button size="sm" disabled={busy} onClick={add}><Plus className="h-4 w-4" /> Add</Button>
      </div>
    </section>
  );
}

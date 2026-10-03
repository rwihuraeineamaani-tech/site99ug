import { useState } from "react";
import { toast } from "sonner";
import { History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Money } from "@/components/system";
import { field, solidBtn } from "@/lib/legal";
import { VAT_LABEL, monthsBetween } from "@/components/legal/ContractDetail";

/** Records a contract that already finished, so the client's history is complete. It is saved archived and approved. */
export default function AddPreviousContract({ residentId, onDone }: { residentId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ title: "", contract_type: "", starts_on: "", ends_on: "", monthly: "", vat_mode: "unknown", notes: "" });
  const [file, setFile] = useState<File | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const months = monthsBetween(f.starts_on || null, f.ends_on || null);
  const monthly = Math.round(Number(f.monthly.replace(/[^\d.]/g, "")) || 0);

  const save = async () => {
    if (!f.title.trim() || !f.starts_on || !f.ends_on) return toast.error("Add a title, start date and end date.");
    if (f.ends_on >= today) return toast.error("A previous contract must have ended already. Use Legal → Contracts for current ones.");
    setBusy(true);
    let file_path: string | null = null;
    if (file) {
      const path = `${residentId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const up = await supabase.storage.from("resident-contracts").upload(path, file);
      if (up.error) { setBusy(false); return toast.error(up.error.message); }
      file_path = path;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("resident_contracts") as any).insert({
      resident_id: residentId,
      title: f.title.trim(),
      contract_type: f.contract_type || null,
      starts_on: f.starts_on,
      ends_on: f.ends_on,
      months,
      monthly_retainer_ugx: monthly || null,
      vat_mode: f.vat_mode,
      notes: f.notes || null,
      file_path,
      is_historical: true,
      status: "archived",
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Previous contract added to this client's history.");
    setOpen(false);
    setF({ title: "", contract_type: "", starts_on: "", ends_on: "", monthly: "", vat_mode: "unknown", notes: "" });
    setFile(null);
    onDone();
  };

  const input = (k: keyof typeof f, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="text-xs text-ink-soft">
      {label}
      <input className={field} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...props} />
    </label>
  );

  return (
    <>
      <Button size="sm" variant="outline" className="gap-2" onClick={() => setOpen(true)}>
        <History className="h-4 w-4" /> Add previous contract
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add a previous contract</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-ink-soft">
            For work we did before this system. It goes straight into the client's history as approved and finished, and does not change their status, invoices or KPI bonuses.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {input("title", "Title", { placeholder: "2025 Digital Retainer" })}
            {input("contract_type", "Contract type", { placeholder: "Retainer, campaign" })}
            {input("starts_on", "Started", { type: "date" })}
            {input("ends_on", "Ended", { type: "date", max: today })}
            {input("monthly", "Monthly retainer (UGX)", { inputMode: "numeric" })}
            <label className="text-xs text-ink-soft">
              VAT
              <select className={field} value={f.vat_mode} onChange={(e) => setF({ ...f, vat_mode: e.target.value })}>
                {Object.entries(VAT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <div className="text-xs text-ink-soft sm:col-span-2">
              Contract value: {months ? <><Money amount={monthly} /> x {months} months = <Money amount={monthly * months} /></> : "set the dates"}
            </div>
            {input("notes", "Notes")}
            <label className="text-xs text-ink-soft">
              Signed copy (optional)
              <input type="file" className={field} accept=".pdf,image/*,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <button className={solidBtn} disabled={busy} onClick={save}>{busy ? "Saving…" : "Add to history"}</button>
        </DialogContent>
      </Dialog>
    </>
  );
}

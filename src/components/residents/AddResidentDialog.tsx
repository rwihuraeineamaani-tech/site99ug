import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";

export default function AddResidentDialog() {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [territory, setTerritory] = useState("");
  const [email, setEmail] = useState("");
  const [established, setEstablished] = useState(false);

  const save = async () => {
    const n = name.trim();
    if (!n) return toast.error("Enter the client's name");
    setBusy(true);
    const db = supabase as any;
    const { data: dup } = await db.from("residents").select("id,name").ilike("name", n).limit(1);
    if (dup?.length) {
      setBusy(false);
      toast.error(`${dup[0].name} is already a resident`);
      return nav(`/app/residents/${dup[0].id}`);
    }
    const { data, error } = await db
      .from("residents")
      .insert({
        name: n,
        territory: territory.trim() || "Kampala",
        since: String(new Date().getFullYear()),
        email: email.trim() || null,
        status: established ? "Active" : "Onboarding",
        onboarding_status: established ? "complete" : "in_progress",
        visible: false,
      })
      .select("id")
      .single();
    if (error) { setBusy(false); return toast.error(error.message); }
    const { error: e2 } = await db.rpc("start_resident_onboarding", { _id: data.id, _established: established });
    setBusy(false);
    if (e2) toast.error(`Client added, but onboarding didn't start: ${e2.message}`);
    else toast.success("Client added — onboarding started");
    setOpen(false);
    nav(`/app/residents/${data.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Add resident</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a resident</DialogTitle>
          <DialogDescription>Create the client and start their onboarding checklist straight away — no Sales deal needed.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Client name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Amaani Media" /></div>
          <div><Label>Location</Label><Input value={territory} onChange={(e) => setTerritory(e.target.value)} placeholder="Kampala" /></div>
          <div><Label>Email (optional)</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={established} onChange={(e) => setEstablished(e.target.checked)} />
            Already working with us (skip to the MD's sign-offs)
          </label>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={busy}>{busy ? "Adding…" : "Add and start onboarding"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

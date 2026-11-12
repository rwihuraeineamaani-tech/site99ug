import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
type Rating = { overall: number; crew: number | null; timekeeping: number | null; comment: string | null; created_at: string };

function Stars({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={!onChange} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => onChange?.(n)}>
          <Star className={`h-6 w-6 ${n <= value ? "fill-primary text-primary" : "text-ink-faint"}`} />
        </button>
      ))}
    </div>
  );
}

/** Client rates a finished shoot once; staff (readOnly) see the result. */
export default function ShootRating({ dayId, residentId, status, readOnly = false }: { dayId: string; residentId: string | null; status: string; readOnly?: boolean }) {
  const [r, setR] = useState<Rating | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState({ overall: 0, crew: 0, timekeeping: 0, comment: "" });
  const load = async () => { const { data } = await db.from("shoot_ratings").select("*").eq("shoot_day_id", dayId).maybeSingle(); setR(data); setLoaded(true); };
  useEffect(() => { load(); }, [dayId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!loaded) return null;
  if (r) return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-3"><span className="w-28 text-ink-faint">Overall</span><Stars value={r.overall} /></div>
      {r.crew != null && <div className="flex items-center gap-3"><span className="w-28 text-ink-faint">Crew</span><Stars value={r.crew} /></div>}
      {r.timekeeping != null && <div className="flex items-center gap-3"><span className="w-28 text-ink-faint">Timekeeping</span><Stars value={r.timekeeping} /></div>}
      {r.comment && <p className="text-ink-soft">"{r.comment}"</p>}
    </div>
  );
  if (readOnly) return <p className="text-sm text-ink-faint">The client hasn't rated this shoot yet.</p>;
  if (status !== "done") return <p className="text-sm text-ink-faint">You can rate this shoot once it's finished.</p>;
  const submit = async () => {
    if (!form.overall) return toast.error("Pick an overall rating.");
    const { error } = await db.from("shoot_ratings").insert({ shoot_day_id: dayId, resident_id: residentId, overall: form.overall, crew: form.crew || null, timekeeping: form.timekeeping || null, comment: form.comment || null });
    if (error) return toast.error(error.message);
    toast.success("Thank you. Your team will see this.");
    load();
  };
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-3"><span className="w-28 text-ink-faint">Overall</span><Stars value={form.overall} onChange={(n) => setForm({ ...form, overall: n })} /></div>
      <div className="flex items-center gap-3"><span className="w-28 text-ink-faint">Crew</span><Stars value={form.crew} onChange={(n) => setForm({ ...form, crew: n })} /></div>
      <div className="flex items-center gap-3"><span className="w-28 text-ink-faint">Timekeeping</span><Stars value={form.timekeeping} onChange={(n) => setForm({ ...form, timekeeping: n })} /></div>
      <textarea className="ctl w-full rounded-xl p-3" rows={3} placeholder="Anything we should keep doing, or do better?" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
      <Button size="sm" onClick={submit}>Send rating</Button>
    </div>
  );
}

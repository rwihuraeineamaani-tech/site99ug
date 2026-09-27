import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Rec = { clock_in_at: string | null; clock_out_at: string | null; status: string; late_minutes: number };
type Settings = { enabled: boolean; enforce_cutoff: boolean; cutoff_time: string; grace_min: number; work_days: number[]; exempt_user_ids: string[]; require_clockout: boolean; geofence_enabled: boolean };

export const kampalaDay = () => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
const t = (n: string) => supabase.from(n as never);
const hm = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default function ClockInCard({ userId }: { userId: string | null }) {
  const [s, setS] = useState<Settings | null>(null);
  const [rec, setRec] = useState<Rec | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!userId) return;
    const [a, b] = await Promise.all([
      t("attendance_settings").select("*").maybeSingle(),
      t("attendance_records").select("clock_in_at,clock_out_at,status,late_minutes").eq("user_id", userId).eq("day", kampalaDay()).maybeSingle(),
    ]);
    setS(a.data as unknown as Settings);
    setRec(b.data as unknown as Rec);
  };
  useEffect(() => { load(); }, [userId]);

  if (!s || !s.enabled || !userId || s.exempt_user_ids.includes(userId)) return null;
  const dow = new Date(`${kampalaDay()}T00:00:00Z`).getUTCDay();
  const workday = s.work_days.includes(dow);
  const cutoff = s.cutoff_time.slice(0, 5);

  const getPos = () =>
    new Promise<GeolocationPosition | null>((res) => {
      if (!s.geofence_enabled || !navigator.geolocation) return res(null);
      navigator.geolocation.getCurrentPosition(res, () => res(null), { enableHighAccuracy: true, timeout: 10000 });
    });

  const clockIn = async () => {
    setBusy(true);
    const pos = await getPos();
    const { error } = await supabase.rpc("clock_in" as never, { _note: note || null, _lat: pos?.coords.latitude ?? null, _lng: pos?.coords.longitude ?? null } as never);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Clocked in");
    setNote("");
    load();
  };
  const clockOut = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("clock_out" as never);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Clocked out — see you tomorrow");
    load();
  };

  let status = "Not clocked in yet";
  if (rec?.status === "excused") status = "Excused today";
  else if (rec?.clock_in_at) status = rec.status === "late" ? `In at ${hm(rec.clock_in_at)} · late by ${rec.late_minutes} min` : `In at ${hm(rec.clock_in_at)} · on time`;
  if (rec?.clock_out_at) status += ` · out at ${hm(rec.clock_out_at)}`;

  return (
    <section className="mb-6 flex flex-col gap-3 rounded-2xl border border-rule bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="eyebrow text-[10px] text-ink-soft">Daily clock-in</p>
        <p className="mt-1 font-medium">{status}</p>
        <p className="text-xs text-ink-soft">
          {workday ? (s.enforce_cutoff ? `Clock in by ${cutoff} (${s.grace_min} min grace). It counts a little towards your KPI.` : "Clock in when you start work.") : "Not a working day — clocking in is optional."}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {!rec?.clock_in_at && rec?.status !== "excused" && (
          <>
            <input className="field min-h-9 py-1.5 text-sm" placeholder="Note (optional, e.g. traffic)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
            <button disabled={busy} onClick={clockIn} className="press rounded-full bg-signal px-4 py-2 text-sm font-medium text-signal-foreground focus-ring disabled:opacity-50">Clock in</button>
          </>
        )}
        {rec?.clock_in_at && !rec.clock_out_at && (
          <button disabled={busy} onClick={clockOut} className="press rounded-full border border-rule px-4 py-2 text-sm focus-ring disabled:opacity-50">Clock out</button>
        )}
      </div>
    </section>
  );
}

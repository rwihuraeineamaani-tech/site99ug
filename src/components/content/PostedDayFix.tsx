import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const kampalaDay = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kampala" }).format(new Date(iso));

const nice = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

/** Lets the Handler or leadership put a posted video back on the day it really went live. */
export function PostedDayFix({
  id,
  postedAt,
  onSaved,
}: {
  id: string;
  postedAt: string | null;
  onSaved: (at: string, metricsDue: string) => void;
}) {
  const current = postedAt ? kampalaDay(postedAt) : "";
  const today = kampalaDay(new Date().toISOString());
  const [day, setDay] = useState(current);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!day || day === current) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("set_posted_date", { _id: id, _day: day });
    setBusy(false);
    if (error) return toast.error(error.message);
    const due = new Date(`${day}T12:00:00`);
    due.setDate(due.getDate() + 10);
    toast.success(`Posted day set to ${nice(day)}.`);
    onSaved(String(data), due.toISOString().slice(0, 10));
  };

  return (
    <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-rule bg-paper-sunken p-3">
      <label className="text-sm">
        <span className="eyebrow text-ink-faint">Went live on</span>
        <input
          type="date"
          max={today}
          value={day}
          onChange={(e) => setDay(e.target.value)}
          className="mt-1 block rounded-lg border border-rule bg-paper px-3 py-2 text-sm"
        />
      </label>
      <Button size="sm" variant="outline" disabled={busy || !day || day === current} onClick={save}>
        {busy ? "Saving…" : "Fix posted day"}
      </Button>
      <p className="w-full text-[11px] text-ink-faint">
        {current ? `Showing as posted ${nice(current)}.` : "No posted day yet."} Changing it also moves the day the numbers are due.
      </p>
    </div>
  );
}

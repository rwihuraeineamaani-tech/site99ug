import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AvailabilityBlock, Freq, Strictness } from "@/lib/recurrence";

const field =
  "mt-1.5 w-full rounded-lg border border-rule bg-paper-raised px-3 py-2 text-sm outline-none press focus:border-signal focus:ring-4 focus:ring-signal/10";

const DAYS = [
  { n: 1, label: "Mon" },
  { n: 2, label: "Tue" },
  { n: 3, label: "Wed" },
  { n: 4, label: "Thu" },
  { n: 5, label: "Fri" },
  { n: 6, label: "Sat" },
  { n: 0, label: "Sun" },
];

export default function BlockDialog({
  open,
  onOpenChange,
  onSaved,
  userId,
  residents,
  canBlockClients,
  defaultDate,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  userId: string | null;
  residents: { id: string; name: string }[];
  canBlockClients: boolean;
  defaultDate: string;
  editing?: AvailabilityBlock | null;
}) {
  const [ownerKind, setOwnerKind] = useState<"staff" | "resident">("staff");
  const [residentId, setResidentId] = useState("");
  const [title, setTitle] = useState("");
  const [allDay, setAllDay] = useState(true);
  const [startDate, setStartDate] = useState(defaultDate);
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [freq, setFreq] = useState<Freq>("none");
  const [interval, setInterval] = useState(1);
  const [byweekday, setByweekday] = useState<number[]>([]);
  const [until, setUntil] = useState("");
  const [occurrences, setOccurrences] = useState("");
  const [strictness, setStrictness] = useState<Strictness>("warn");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setOwnerKind(editing.owner_kind);
      setResidentId(editing.resident_id ?? "");
      setTitle(editing.title);
      setAllDay(editing.all_day);
      setStartDate(editing.start_date);
      setEndDate(editing.end_date ?? "");
      setStartTime((editing.start_time ?? "09:00").slice(0, 5));
      setEndTime((editing.end_time ?? "17:00").slice(0, 5));
      setFreq(editing.freq);
      setInterval(editing.interval_n || 1);
      setByweekday(editing.byweekday ?? []);
      setUntil(editing.until ?? "");
      setOccurrences(editing.occurrences ? String(editing.occurrences) : "");
      setStrictness(editing.strictness);
      setNote(editing.note ?? "");
    } else {
      setOwnerKind("staff");
      setResidentId("");
      setTitle("");
      setAllDay(true);
      setStartDate(defaultDate);
      setEndDate("");
      setFreq("none");
      setInterval(1);
      setByweekday([]);
      setUntil("");
      setOccurrences("");
      setStrictness("warn");
      setNote("");
    }
  }, [open, editing, defaultDate]);

  const save = async () => {
    if (!title.trim()) return toast.error("Give the block a name, like “Lectures”.");
    if (ownerKind === "resident" && !residentId) return toast.error("Pick which client is busy.");
    if (!startDate) return toast.error("Pick a start date.");
    setBusy(true);
    const payload = {
      owner_kind: ownerKind,
      owner_user_id: ownerKind === "staff" ? userId : null,
      resident_id: ownerKind === "resident" ? residentId : null,
      title: title.trim(),
      all_day: allDay,
      start_date: startDate,
      end_date: freq === "none" ? endDate || null : null,
      start_time: allDay ? null : startTime,
      end_time: allDay ? null : endTime,
      freq,
      interval_n: Math.max(1, Number(interval) || 1),
      byweekday: freq === "weekly" ? byweekday : [],
      until: freq === "none" ? null : until || null,
      occurrences: freq === "none" || !occurrences ? null : Number(occurrences),
      strictness,
      note: note.trim() || null,
      created_by: userId,
    };
    const res = editing
      ? await supabase.from("availability_blocks").update(payload as never).eq("id", editing.id)
      : await supabase.from("availability_blocks").insert(payload as never);
    setBusy(false);
    if (res.error) return toast.error(res.error.message);
    toast.success(editing ? "Block updated." : "Block saved. Schedulers will see it.");
    onOpenChange(false);
    onSaved();
  };

  const remove = async () => {
    if (!editing) return;
    setBusy(true);
    const { error } = await supabase.from("availability_blocks").delete().eq("id", editing.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Block removed.");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit busy time" : "Mark yourself busy"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {canBlockClients && (
            <div>
              <label className="eyebrow text-ink-faint">Who is busy</label>
              <div className="mt-1.5 flex gap-2">
                {(["staff", "resident"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setOwnerKind(k)}
                    className={`press rounded-full border px-3 py-1.5 text-xs ${
                      ownerKind === k ? "border-signal bg-signal text-paper" : "border-rule text-ink-soft"
                    }`}
                  >
                    {k === "staff" ? "Me" : "A client"}
                  </button>
                ))}
              </div>
              {ownerKind === "resident" && (
                <select className={field} value={residentId} onChange={(e) => setResidentId(e.target.value)}>
                  <option value="">Pick a client…</option>
                  {residents.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div>
            <label className="eyebrow text-ink-faint">What is it</label>
            <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Lectures, day job, travel…" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="eyebrow text-ink-faint">Starts</label>
              <input type="date" className={field} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            {freq === "none" ? (
              <div>
                <label className="eyebrow text-ink-faint">Ends (optional)</label>
                <input type="date" className={field} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            ) : (
              <div>
                <label className="eyebrow text-ink-faint">Repeat until (optional)</label>
                <input type="date" className={field} value={until} onChange={(e) => setUntil(e.target.value)} />
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
            Busy the whole day
          </label>

          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="eyebrow text-ink-faint">From</label>
                <input type="time" className={field} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div>
                <label className="eyebrow text-ink-faint">To</label>
                <input type="time" className={field} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>
          )}

          <div>
            <label className="eyebrow text-ink-faint">Repeats</label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {(["none", "daily", "weekly", "monthly"] as Freq[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFreq(f)}
                  className={`press rounded-full border px-3 py-1.5 text-xs capitalize ${
                    freq === f ? "border-signal bg-signal text-paper" : "border-rule text-ink-soft"
                  }`}
                >
                  {f === "none" ? "Doesn't repeat" : f}
                </button>
              ))}
            </div>
          </div>

          {freq !== "none" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="eyebrow text-ink-faint">Every</label>
                <input
                  type="number"
                  min={1}
                  className={field}
                  value={interval}
                  onChange={(e) => setInterval(Number(e.target.value))}
                />
                <p className="mt-1 text-[11px] text-ink-faint">
                  {interval > 1 ? `every ${interval} ` : "every "}
                  {freq === "daily" ? "days" : freq === "weekly" ? "weeks" : "months"}
                </p>
              </div>
              <div>
                <label className="eyebrow text-ink-faint">Number of times (optional)</label>
                <input
                  type="number"
                  min={1}
                  className={field}
                  value={occurrences}
                  onChange={(e) => setOccurrences(e.target.value)}
                  placeholder="Leave blank for forever"
                />
              </div>
            </div>
          )}

          {freq === "weekly" && (
            <div>
              <label className="eyebrow text-ink-faint">On these days</label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {DAYS.map((d) => {
                  const on = byweekday.includes(d.n);
                  return (
                    <button
                      key={d.n}
                      type="button"
                      onClick={() =>
                        setByweekday((cur) => (on ? cur.filter((x) => x !== d.n) : [...cur, d.n].sort()))
                      }
                      className={`press rounded-full border px-2.5 py-1 text-xs ${
                        on ? "border-signal bg-signal text-paper" : "border-rule text-ink-soft"
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="eyebrow text-ink-faint">How strict</label>
            <div className="mt-1.5 grid gap-2">
              {(
                [
                  { v: "warn" as const, t: "Warn whoever is scheduling", n: "They see a warning but can still book this time." },
                  { v: "hard" as const, t: "Do not schedule me", n: "Booking is refused. Only an MD or founder can force it through." },
                ]
              ).map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setStrictness(o.v)}
                  className={`press rounded-lg border px-3 py-2 text-left ${
                    strictness === o.v ? "border-signal bg-signal/[0.07]" : "border-rule"
                  }`}
                >
                  <div className="text-sm font-medium">{o.t}</div>
                  <div className="text-[11px] text-ink-soft">{o.n}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="eyebrow text-ink-faint">Note (optional)</label>
            <textarea className={field} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <div className="flex gap-2 pt-1">
            <Button onClick={save} disabled={busy}>
              {editing ? "Save changes" : "Save block"}
            </Button>
            {editing && (
              <Button variant="outline" onClick={remove} disabled={busy}>
                Remove
              </Button>
            )}
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

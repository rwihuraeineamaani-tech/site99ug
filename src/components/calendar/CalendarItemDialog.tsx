import { useEffect, useMemo, useState } from "react";
import { Copy, Lock, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CalendarItem, WorkKind, WorkOption } from "@/lib/calendar";
import type { Freq } from "@/lib/recurrence";

const field = "mt-1.5 w-full rounded-lg border border-rule bg-paper-raised px-3 py-2 text-sm outline-none press focus:border-signal focus:ring-4 focus:ring-signal/10";
const DAYS = [{ n: 1, label: "Mon" }, { n: 2, label: "Tue" }, { n: 3, label: "Wed" }, { n: 4, label: "Thu" }, { n: 5, label: "Fri" }, { n: 6, label: "Sat" }, { n: 0, label: "Sun" }];
const REMINDERS = [{ value: "", label: "No reminder" }, { value: "0", label: "At start time" }, { value: "5", label: "5 minutes before" }, { value: "15", label: "15 minutes before" }, { value: "30", label: "30 minutes before" }, { value: "60", label: "1 hour before" }, { value: "1440", label: "1 day before" }];

export default function CalendarItemDialog({ open, onOpenChange, onSaved, defaultDate, editing, duplicate = false }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void; defaultDate: string; editing: CalendarItem | null; duplicate?: boolean }) {
  const [title, setTitle] = useState(""); const [allDay, setAllDay] = useState(false);
  const [startDate, setStartDate] = useState(defaultDate); const [endDate, setEndDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState("09:00"); const [endTime, setEndTime] = useState("10:00");
  const [location, setLocation] = useState(""); const [note, setNote] = useState("");
  const [visibility, setVisibility] = useState<"private" | "team">("private");
  const [strictness, setStrictness] = useState<"warn" | "hard">("warn");
  const [freq, setFreq] = useState<Freq>("none"); const [interval, setInterval] = useState(1);
  const [byweekday, setByweekday] = useState<number[]>([]); const [until, setUntil] = useState(""); const [occurrences, setOccurrences] = useState("");
  const [reminder, setReminder] = useState("15"); const [customReminder, setCustomReminder] = useState("90"); const [work, setWork] = useState(""); const [workOptions, setWorkOptions] = useState<WorkOption[]>([]); const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const item = editing;
    setTitle(item?.title ?? ""); setAllDay(item?.all_day ?? false); setStartDate(item?.start_date ?? defaultDate); setEndDate(item?.end_date ?? defaultDate);
    setStartTime((item?.start_time ?? "09:00").slice(0, 5)); setEndTime((item?.end_time ?? "10:00").slice(0, 5)); setLocation(item?.location ?? ""); setNote(item?.note ?? "");
    setVisibility((item?.visibility as "private" | "team") ?? "private"); setStrictness((item?.strictness as "warn" | "hard") ?? "warn"); setFreq((item?.freq as Freq) ?? "none");
    setInterval(item?.interval_n ?? 1); setByweekday(item?.byweekday ?? []); setUntil(item?.until ?? ""); setOccurrences(item?.occurrences ? String(item.occurrences) : ""); const reminderValue = item?.reminder_minutes == null ? "" : String(item.reminder_minutes); setReminder(REMINDERS.some((r) => r.value === reminderValue) ? reminderValue : "custom"); if (item?.reminder_minutes != null) setCustomReminder(String(item.reminder_minutes)); setWork(item?.work_kind ? `${item.work_kind}|${item.work_id ?? ""}|${item.work_label ?? ""}|${item.work_path ?? ""}` : "");
  }, [open, editing, defaultDate]);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      supabase.from("residents").select("id,name").order("name").limit(100),
      supabase.from("shoot_days").select("id,shoot_date,resident_id").order("shoot_date", { ascending: false }).limit(50),
      supabase.from("content_items").select("id,ref_no,title").order("updated_at", { ascending: false }).limit(50),
      supabase.from("briefs").select("id,title").order("updated_at", { ascending: false }).limit(50),
      supabase.from("invoices").select("id,invoice_no,client_name").order("created_at", { ascending: false }).limit(50),
      supabase.from("strategy_maps").select("id,title,resident_id").order("updated_at", { ascending: false }).limit(50),
    ]).then(([clients, shoots, content, briefs, invoices, maps]) => {
      const opts: WorkOption[] = [];
      (clients.data ?? []).forEach((x) => opts.push({ kind: "client", id: x.id, label: `Client · ${x.name}`, path: `/app/residents/${x.id}` }));
      (shoots.data ?? []).forEach((x) => opts.push({ kind: "shoot", id: x.id, label: `Shoot · ${x.shoot_date ?? "Unscheduled"}`, path: `/app/shoots/${x.id}` }));
      (content.data ?? []).forEach((x) => opts.push({ kind: "content", id: x.id, label: `Content · ${x.title}`, path: `/app/content?ref=${x.ref_no}` }));
      (briefs.data ?? []).forEach((x) => opts.push({ kind: "brief", id: x.id, label: `Brief · ${x.title}`, path: `/app/briefs/${x.id}` }));
      (invoices.data ?? []).forEach((x) => opts.push({ kind: "invoice", id: x.id, label: `Invoice · ${x.invoice_no} · ${x.client_name}`, path: `/app/finance/invoices` }));
      (maps.data ?? []).forEach((x) => opts.push({ kind: "strategy", id: x.id, label: `Strategy · ${x.title}`, path: `/app/strategy/maps?map=${x.id}` }));
      opts.push({ kind: "todo", id: "todo", label: "To-Do · My work", path: "/app/todo" }, { kind: "approval", id: "approvals", label: "Approvals · Waiting on me", path: "/app/approvals" });
      setWorkOptions(opts);
    });
  }, [open]);

  const selected = useMemo(() => workOptions.find((x) => `${x.kind}|${x.id}|${x.label}|${x.path}` === work), [work, workOptions]);
  const save = async () => {
    if (!title.trim()) return toast.error("Give this calendar item a title.");
    if (!allDay && endDate === startDate && endTime <= startTime) return toast.error("End time must be after start time.");
    setBusy(true);
    const reminderMinutes = reminder === "" ? null : reminder === "custom" ? Math.max(0, Number(customReminder) || 0) : Number(reminder);
    const payload = { title: title.trim(), all_day: allDay, start_date: startDate, end_date: freq === "none" ? endDate : startDate, start_time: allDay ? null : startTime, end_time: allDay ? null : endTime, location: location.trim() || null, note: note.trim() || null, visibility, strictness, freq, interval_n: Math.max(1, interval), byweekday: freq === "weekly" ? byweekday : [], until: freq === "none" ? null : until || null, occurrences: freq === "none" || !occurrences ? null : Number(occurrences), reminder_minutes: reminderMinutes, reminder_dismissed_at: null, work_kind: selected?.kind ?? null, work_id: selected?.id ?? null, work_label: selected?.label ?? null, work_path: selected?.path ?? null };
    const result = editing && !duplicate ? await supabase.from("calendar_items").update(payload).eq("id", editing.id) : await supabase.from("calendar_items").insert(payload);
    setBusy(false); if (result.error) return toast.error(result.error.message);
    toast.success(editing && !duplicate ? "Calendar item updated." : "Calendar item added."); onOpenChange(false); onSaved();
  };
  const remove = async () => { if (!editing || duplicate) return; setBusy(true); const { error } = await supabase.from("calendar_items").delete().eq("id", editing.id); setBusy(false); if (error) return toast.error(error.message); toast.success("Calendar item deleted."); onOpenChange(false); onSaved(); };

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{duplicate ? "Duplicate calendar item" : editing ? "Edit calendar item" : "New calendar item"}</DialogTitle></DialogHeader><div className="space-y-5">
    <div><label className="eyebrow text-ink-faint">Title</label><input className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Focus time, client review, appointment…" /></div>
    <div className="grid gap-3 sm:grid-cols-2"><div><label className="eyebrow text-ink-faint">Starts</label><input type="date" className={field} value={startDate} onChange={(e) => { setStartDate(e.target.value); if (endDate < e.target.value) setEndDate(e.target.value); }} /></div><div><label className="eyebrow text-ink-faint">Ends</label><input type="date" className={field} value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} disabled={freq !== "none"} /></div></div>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />All day</label>
    {!allDay && <div className="grid grid-cols-2 gap-3"><div><label className="eyebrow text-ink-faint">Start time</label><input type="time" className={field} value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div><div><label className="eyebrow text-ink-faint">End time</label><input type="time" className={field} value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div></div>}
    <div className="grid gap-3 sm:grid-cols-2"><div><label className="eyebrow text-ink-faint">Location</label><input className={field} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Optional" /></div><div><label className="eyebrow text-ink-faint">Reminder</label><select className={field} value={reminder} onChange={(e) => setReminder(e.target.value)}>{REMINDERS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}<option value="custom">Custom minutes before</option></select>{reminder === "custom" && <input type="number" min="0" className={field} value={customReminder} onChange={(e) => setCustomReminder(e.target.value)} aria-label="Custom reminder minutes" />}</div></div>
    <div><label className="eyebrow text-ink-faint">Visibility</label><div className="mt-1.5 grid grid-cols-2 gap-2">{([{ v: "private", icon: Lock, t: "Private", n: "Team sees only Busy and the time." }, { v: "team", icon: Users, t: "Team", n: "Team can see all event details." }] as const).map((o) => <button key={o.v} type="button" onClick={() => setVisibility(o.v)} className={`rounded-lg border p-3 text-left ${visibility === o.v ? "border-signal bg-signal/[0.07]" : "border-rule"}`}><o.icon className="mb-2 h-4 w-4 text-signal" /><div className="text-sm font-semibold">{o.t}</div><div className="mt-1 text-[11px] text-ink-soft">{o.n}</div></button>)}</div></div>
    <div><label className="eyebrow text-ink-faint">Scheduling</label><div className="mt-1.5 grid grid-cols-2 gap-2"><button type="button" onClick={() => setStrictness("warn")} className={`rounded-lg border p-3 text-left ${strictness === "warn" ? "border-signal bg-signal/[0.07]" : "border-rule"}`}><div className="text-sm font-semibold">Warn only</div><div className="text-[11px] text-ink-soft">Show the clash but allow booking.</div></button><button type="button" onClick={() => setStrictness("hard")} className={`rounded-lg border p-3 text-left ${strictness === "hard" ? "border-signal bg-signal/[0.07]" : "border-rule"}`}><div className="text-sm font-semibold">Do not schedule</div><div className="text-[11px] text-ink-soft">Require a leadership override.</div></button></div></div>
    <div><label className="eyebrow text-ink-faint">Repeats</label><div className="mt-1.5 flex flex-wrap gap-2">{(["none", "daily", "weekly", "monthly"] as Freq[]).map((f) => <button key={f} type="button" onClick={() => setFreq(f)} className={`rounded-full border px-3 py-1.5 text-xs capitalize ${freq === f ? "border-signal bg-signal text-paper" : "border-rule text-ink-soft"}`}>{f === "none" ? "Doesn’t repeat" : f}</button>)}</div></div>
    {freq !== "none" && <><div className="grid gap-3 sm:grid-cols-3"><div><label className="eyebrow text-ink-faint">Every</label><input type="number" min="1" className={field} value={interval} onChange={(e) => setInterval(Number(e.target.value))} /></div><div><label className="eyebrow text-ink-faint">Until</label><input type="date" className={field} value={until} onChange={(e) => setUntil(e.target.value)} /></div><div><label className="eyebrow text-ink-faint">Times</label><input type="number" min="1" className={field} value={occurrences} onChange={(e) => setOccurrences(e.target.value)} placeholder="Optional" /></div></div>{freq === "weekly" && <div className="flex flex-wrap gap-1.5">{DAYS.map((d) => <button key={d.n} type="button" onClick={() => setByweekday((cur) => cur.includes(d.n) ? cur.filter((x) => x !== d.n) : [...cur, d.n])} className={`rounded-full border px-2.5 py-1 text-xs ${byweekday.includes(d.n) ? "border-signal bg-signal text-paper" : "border-rule"}`}>{d.label}</button>)}</div>}</>}
    <div><label className="eyebrow text-ink-faint">Linked work</label><select className={field} value={work} onChange={(e) => setWork(e.target.value)}><option value="">No linked work</option>{workOptions.map((o) => <option key={`${o.kind}-${o.id}`} value={`${o.kind}|${o.id}|${o.label}|${o.path}`}>{o.label}</option>)}</select></div>
    <div><label className="eyebrow text-ink-faint">Notes</label><textarea className={field} rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></div>
    <div className="flex flex-wrap gap-2"><Button onClick={save} disabled={busy}>{editing && !duplicate ? "Save changes" : "Add to calendar"}</Button>{editing && !duplicate && <Button variant="outline" onClick={() => onOpenChange(false)} className="gap-1.5"><Copy className="h-4 w-4" />Close</Button>}{editing && !duplicate && <Button variant="destructive" onClick={remove} disabled={busy} className="ml-auto gap-1.5"><Trash2 className="h-4 w-4" />Delete</Button>}</div>
  </div></DialogContent></Dialog>;
}

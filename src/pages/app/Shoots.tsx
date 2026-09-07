import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Seo from "@/components/Seo";
import AppShell from "@/components/system/AppShell";
import { PageHeader, SectionHeading, StatusChip } from "@/components/system";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMyRoles } from "@/hooks/useMyRoles";
import { refCode } from "@/lib/contentFlow";
import { CalendarDays, Plus, X } from "lucide-react";

type ShootDay = {
  id: string;
  resident_id: string | null;
  status: string;
  project_id: string | null;
  shoot_date: string | null;
  call_time: string | null;
  location: string | null;
  notes: string | null;
};
type DayItem = { id: string; shoot_day_id: string; content_id: string };
type Item = { id: string; ref_no: number; title: string; content_type: string; stage: string; resident_id: string | null; project_id: string | null };
type Gear = { id: string; name: string; category: string; quantity: number; active: boolean };
type Booking = { id: string; shoot_day_id: string; equipment_id: string; qty: number };
type Resident = { id: string; name: string };
type Project = { id: string; title: string; client: string };

const field =
  "mt-1.5 w-full rounded-lg border border-rule bg-paper-raised px-3 py-2 text-sm outline-none press focus:border-signal focus:ring-4 focus:ring-signal/10";

const STATUS_LABEL: Record<string, string> = {
  draft: "Needs a date",
  confirmed: "Confirmed",
  shooting: "On the shoot",
  done: "Wrapped",
  cancelled: "Cancelled",
};

export default function Shoots() {
  const { canEditContent } = useMyRoles();
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<ShootDay[]>([]);
  const [dayItems, setDayItems] = useState<DayItem[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [gear, setGear] = useState<Gear[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [date, setDate] = useState("");
  const [callTime, setCallTime] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  const load = async () => {
    const [{ data: d }, { data: di }, { data: it }, { data: g }, { data: b }, { data: rs }, { data: pj }] = await Promise.all([
      supabase.from("shoot_days").select("*").order("shoot_date", { ascending: true, nullsFirst: true }),
      supabase.from("shoot_day_items").select("*"),
      supabase
        .from("content_items")
        .select("id, ref_no, title, content_type, stage, resident_id, project_id")
        .in("stage", ["Crewed", "Scheduled", "Shooting"]),
      supabase.from("equipment").select("*").order("category").order("name"),
      supabase.from("shoot_day_equipment").select("*"),
      supabase.rpc("resident_options"),
      supabase.from("projects").select("id, title, client").order("display_order"),
    ]);
    setDays((d as ShootDay[]) ?? []);
    setDayItems((di as DayItem[]) ?? []);
    setItems((it as Item[]) ?? []);
    setGear((g as Gear[]) ?? []);
    setBookings((b as Booking[]) ?? []);
    setResidents(((rs as Resident[]) ?? []).map((r) => ({ id: r.id, name: r.name })));
    setProjects((pj as Project[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const open = days.find((d) => d.id === openId) ?? null;

  useEffect(() => {
    if (!open) return;
    setDate(open.shoot_date ?? "");
    setCallTime(open.call_time ?? "");
    setLocation(open.location ?? "");
    setNotes(open.notes ?? "");
  }, [openId]); // eslint-disable-line react-hooks/exhaustive-deps

  /** A shoot day belongs to a resident or a project. */
  const ownerName = (d: ShootDay) => {
    if (d.resident_id) return residents.find((r) => r.id === d.resident_id)?.name ?? "Client";
    const p = projects.find((x) => x.id === d.project_id);
    return p ? `${p.title} (project)` : "Unassigned";
  };
  const itemsOf = (dayId: string) =>
    dayItems.filter((i) => i.shoot_day_id === dayId).map((i) => items.find((x) => x.id === i.content_id)).filter(Boolean) as Item[];

  /** Crewed ideas for this client that aren't on any shoot day yet. */
  const spareFor = (day: ShootDay) =>
    items.filter(
      (i) =>
        i.stage === "Crewed" &&
        (day.resident_id ? i.resident_id === day.resident_id : i.project_id === day.project_id) &&
        !dayItems.some((d) => d.content_id === i.id)
    );

  /** Units of a piece of gear already taken by other confirmed shoots on the same date. */
  const takenElsewhere = (equipmentId: string, day: ShootDay) => {
    if (!day.shoot_date) return 0;
    return bookings
      .filter((b) => b.equipment_id === equipmentId && b.shoot_day_id !== day.id)
      .filter((b) => {
        const other = days.find((d) => d.id === b.shoot_day_id);
        return other && other.shoot_date === day.shoot_date && ["confirmed", "shooting"].includes(other.status);
      })
      .reduce((a, b) => a + b.qty, 0);
  };

  const sorted = useMemo(() => {
    const rank = (s: string) => (s === "draft" ? 0 : s === "confirmed" ? 1 : s === "shooting" ? 2 : 3);
    return [...days].sort((a, b) => rank(a.status) - rank(b.status) || (a.shoot_date ?? "").localeCompare(b.shoot_date ?? ""));
  }, [days]);

  /* ---------------- actions ---------------- */
  const run = async (fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success(ok);
      await load();
    }
  };

  const saveDetails = () =>
    open &&
    run(
      () =>
        supabase
          .from("shoot_days")
          .update({
            shoot_date: date || null,
            call_time: callTime || null,
            location: location || null,
            notes: notes || null,
          })
          .eq("id", open.id),
      "Saved"
    );

  const addItem = (contentId: string) =>
    open && run(() => supabase.from("shoot_day_items").insert({ shoot_day_id: open.id, content_id: contentId }), "Added");

  const removeItem = (contentId: string) =>
    run(() => supabase.from("shoot_day_items").delete().eq("content_id", contentId), "Removed");

  const toggleGear = (g: Gear, on: boolean) => {
    if (!open) return;
    if (on) run(() => supabase.from("shoot_day_equipment").insert({ shoot_day_id: open.id, equipment_id: g.id, qty: 1 }), "Booked");
    else run(() => supabase.from("shoot_day_equipment").delete().eq("shoot_day_id", open.id).eq("equipment_id", g.id), "Released");
  };

  const call = (rpc: "confirm_shoot_day" | "start_shoot_day" | "finish_shoot_day", ok: string) =>
    open && run(() => supabase.rpc(rpc, { _day_id: open.id }) as never, ok);

  const newDay = async (owner: string) => {
    if (!owner) return;
    const payload: { resident_id?: string; project_id?: string } = owner.startsWith("p:")
      ? { project_id: owner.slice(2) }
      : { resident_id: owner.slice(2) };
    await run(() => supabase.from("shoot_days").insert(payload), "Shoot day created");
  };

  return (
    <AppShell>
      <Seo title="Shoot days — Site 99" description="Plan shoot days, the ideas on them and the gear booked out." path="/app/shoots" noindex />
      <PageHeader
        eyebrow="Content & strategy"
        title="Shoot days."
        lede="Every crewed idea lands on its client's shoot day. Management sets the date, the call time and the gear."
      />

      {canEditContent && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="eyebrow text-ink-faint">New shoot day</span>
          <select className="rounded-full border border-rule bg-paper-raised px-3 py-1.5 text-xs press focus-ring" defaultValue="" onChange={(e) => { newDay(e.target.value); e.currentTarget.value = ""; }}>
            <option value="">Pick a client or project…</option>
            <optgroup label="Clients">
              {residents.map((r) => (
                <option key={r.id} value={`r:${r.id}`}>
                  {r.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Projects">
              {projects.map((p) => (
                <option key={p.id} value={`p:${p.id}`}>
                  {p.title} — {p.client}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
      )}

      <div className="mt-10">
        <SectionHeading index="01" title="Planned" hint={`${days.length} day${days.length === 1 ? "" : "s"}`} />
        {loading ? (
          <p className="text-sm text-ink-faint">Loading…</p>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-ink-soft">Nothing yet. As soon as an idea is crewed it shows up here.</p>
        ) : (
          <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule">
            {sorted.map((d) => {
              const list = itemsOf(d.id);
              return (
                <li key={d.id}>
                  <button
                    onClick={() => setOpenId(d.id)}
                    className="w-full text-left px-4 py-4 flex flex-wrap items-center gap-3 hover:bg-paper-sunken focus-ring"
                  >
                    <CalendarDays className="h-4 w-4 text-ink-faint shrink-0" />
                    <span className="font-semibold">{ownerName(d)}</span>
                    <StatusChip value={STATUS_LABEL[d.status] ?? d.status} tone={d.status === "draft" ? "amber" : d.status === "done" ? "neutral" : "active"} />
                    <span className="num text-xs text-ink-soft">{d.shoot_date ?? "no date yet"}</span>
                    {d.call_time && <span className="num text-xs text-ink-faint">{d.call_time}</span>}
                    <span className="ml-auto text-xs text-ink-faint">
                      {list.length} idea{list.length === 1 ? "" : "s"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpenId(null)}>
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle>{ownerName(open)}</DialogTitle>
              </DialogHeader>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-sm">
                  <span className="eyebrow text-ink-faint">Date</span>
                  <input type="date" className={field} value={date} disabled={!canEditContent} onChange={(e) => setDate(e.target.value)} />
                </label>
                <label className="text-sm">
                  <span className="eyebrow text-ink-faint">Call time</span>
                  <input type="time" className={field} value={callTime} disabled={!canEditContent} onChange={(e) => setCallTime(e.target.value)} />
                </label>
                <label className="text-sm">
                  <span className="eyebrow text-ink-faint">Location</span>
                  <input className={field} value={location} disabled={!canEditContent} onChange={(e) => setLocation(e.target.value)} />
                </label>
              </div>
              <label className="block text-sm">
                <span className="eyebrow text-ink-faint">Notes</span>
                <textarea rows={2} className={field} value={notes} disabled={!canEditContent} onChange={(e) => setNotes(e.target.value)} />
              </label>
              {canEditContent && (
                <Button variant="outline" size="sm" className="self-start" disabled={busy} onClick={saveDetails}>
                  Save details
                </Button>
              )}

              {/* ideas on the day */}
              <div className="rounded-xl border border-rule bg-paper-sunken p-4">
                <div className="eyebrow text-ink-faint">Ideas on this day</div>
                <ul className="mt-2 space-y-1.5">
                  {itemsOf(open.id).map((i) => (
                    <li key={i.id} className="flex items-center gap-2 text-sm">
                      <span className="num text-[11px] text-ink-faint w-20 shrink-0">{refCode(i.ref_no)}</span>
                      <span className="truncate">{i.title}</span>
                      <span className="text-xs text-ink-faint">{i.content_type}</span>
                      {canEditContent && open.status === "draft" && (
                        <button className="ml-auto text-ink-faint hover:text-signal focus-ring" onClick={() => removeItem(i.id)} aria-label="Remove">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </li>
                  ))}
                  {itemsOf(open.id).length === 0 && <li className="text-xs text-ink-soft">No ideas on this day yet.</li>}
                </ul>
                {canEditContent && open.status === "draft" && spareFor(open).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {spareFor(open).map((i) => (
                      <button
                        key={i.id}
                        onClick={() => addItem(i.id)}
                        className="rounded-full border border-rule bg-paper-raised px-3 py-1.5 text-xs press focus-ring inline-flex items-center gap-1"
                      >
                        <Plus className="h-3 w-3" /> {i.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* gear */}
              <div className="rounded-xl border border-rule bg-paper-sunken p-4">
                <div className="eyebrow text-ink-faint">Gear for the day</div>
                {gear.filter((g) => g.active).length === 0 ? (
                  <p className="mt-1 text-xs text-ink-soft">No kit list yet — add gear under Management & ops → Equipment.</p>
                ) : (
                  <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                    {gear
                      .filter((g) => g.active)
                      .map((g) => {
                        const booked = bookings.some((b) => b.shoot_day_id === open.id && b.equipment_id === g.id);
                        const taken = takenElsewhere(g.id, open);
                        const clash = !booked && taken >= g.quantity;
                        return (
                          <label
                            key={g.id}
                            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                              clash ? "border-signal/40 bg-signal/5 text-signal" : "border-rule bg-paper-raised"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={booked}
                              disabled={!canEditContent || clash || busy}
                              onChange={(e) => toggleGear(g, e.target.checked)}
                            />
                            <span className="truncate">{g.name}</span>
                            <span className="ml-auto text-[11px] text-ink-faint">
                              {clash ? "booked elsewhere" : `${g.quantity - taken} free`}
                            </span>
                          </label>
                        );
                      })}
                  </div>
                )}
              </div>

              {canEditContent && (
                <div className="flex flex-wrap gap-2">
                  {open.status === "draft" && (
                    <Button disabled={busy || !open.shoot_date} onClick={() => call("confirm_shoot_day", "Shoot day confirmed")}>
                      {open.shoot_date ? "Confirm the day" : "Pick a date first"}
                    </Button>
                  )}
                  {open.status === "confirmed" && (
                    <Button disabled={busy} onClick={() => call("start_shoot_day", "The shoot has started")}>
                      Start the shoot
                    </Button>
                  )}
                  {["confirmed", "shooting"].includes(open.status) && (
                    <Button variant="outline" disabled={busy} onClick={() => call("finish_shoot_day", "Wrapped")}>
                      Wrap the day
                    </Button>
                  )}
                </div>
              )}
              {open.status === "draft" && !open.shoot_date && (
                <p className="text-xs text-ink-soft">Save the date first, then confirm — confirming schedules every idea on the day.</p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

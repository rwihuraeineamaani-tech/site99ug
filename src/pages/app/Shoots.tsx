import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Seo from "@/components/Seo";
import AppShell from "@/components/system/AppShell";
import { PageHeader, SectionHeading, StatusChip } from "@/components/system";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMyRoles } from "@/hooks/useMyRoles";
import { refCode, STAGE_NOTE, type Stage } from "@/lib/contentFlow";
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
  brief_sent_at: string | null;
};
type DayItem = { id: string; shoot_day_id: string; content_id: string };
type Item = {
  id: string;
  ref_no: number;
  title: string;
  content_type: string;
  stage: string;
  resident_id: string | null;
  project_id: string | null;
  posted_links: string[] | null;
};
type Crew = { id: string; content_id: string; role: string; user_id: string | null; note: string | null };
type Member = { user_id: string; display_name: string | null; email: string };
type Gear = { id: string; name: string; category: string; quantity: number; active: boolean };
type Booking = { id: string; shoot_day_id: string; equipment_id: string; qty: number };
type Resident = { id: string; name: string; contact_user_id?: string | null };
type Project = { id: string; title: string; client: string };
type Conflict = {
  block_id: string;
  owner_kind: "staff" | "resident";
  owner_user_id: string | null;
  resident_id: string | null;
  title: string;
  strictness: "warn" | "hard";
};


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
  const { canEditContent, userId, has } = useMyRoles();
  const canOverride = has("admin", "founder", "managing_director");
  const [clash, setClash] = useState<Conflict[] | null>(null);
  const [overrideReason, setOverrideReason] = useState("");

  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<ShootDay[]>([]);
  const [dayItems, setDayItems] = useState<DayItem[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [gear, setGear] = useState<Gear[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [crew, setCrew] = useState<Crew[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"planned" | "wrapped" | "all">("planned");

  const [date, setDate] = useState("");
  const [callTime, setCallTime] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  const load = async () => {
    const [{ data: d }, { data: di }, { data: it }, { data: g }, { data: b }, { data: rs }, { data: pj }, { data: cc }, { data: tm }] =
      await Promise.all([
        supabase.from("shoot_days").select("*").order("shoot_date", { ascending: true, nullsFirst: true }),
        supabase.from("shoot_day_items").select("*"),
        supabase.from("content_items").select("id, ref_no, title, content_type, stage, resident_id, project_id, posted_links"),
        supabase.from("equipment").select("*").order("category").order("name"),
        supabase.from("shoot_day_equipment").select("*"),
        supabase.rpc("resident_options"),
        supabase.from("projects").select("id, title, client").order("display_order"),
        supabase.from("content_crew").select("id, content_id, role, user_id, note"),
        supabase.from("team_members").select("user_id, display_name, email"),
      ]);
    setDays((d as ShootDay[]) ?? []);
    setDayItems((di as DayItem[]) ?? []);
    setItems((it as Item[]) ?? []);
    setGear((g as Gear[]) ?? []);
    setBookings((b as Booking[]) ?? []);
    setResidents(((rs as Resident[]) ?? []).map((r) => ({ id: r.id, name: r.name, contact_user_id: r.contact_user_id ?? null })));
    setProjects((pj as Project[]) ?? []);
    setCrew((cc as Crew[]) ?? []);
    setMembers((tm as Member[]) ?? []);
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

  /** True when I'm crewed on any idea attached to this day. */
  const amCrewOn = (dayId: string) =>
    !!userId && itemsOf(dayId).some((i) => crew.some((c) => c.content_id === i.id && c.user_id === userId));
  const onCrewToday = open ? amCrewOn(open.id) : false;



  const memberName = (uid: string | null) => {
    if (!uid) return null;
    const m = members.find((x) => x.user_id === uid);
    return m?.display_name || m?.email || null;
  };
  /** Everyone crewed on one idea, as "Shooter: Brian" lines. */
  const crewOf = (contentId: string) =>
    crew
      .filter((c) => c.content_id === contentId)
      .map((c) => `${c.role}: ${memberName(c.user_id) ?? c.note ?? "unassigned"}`);
  const gearOf = (dayId: string) =>
    bookings
      .filter((b) => b.shoot_day_id === dayId)
      .map((b) => gear.find((g) => g.id === b.equipment_id)?.name)
      .filter(Boolean) as string[];


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
    const keep = (s: string) =>
      tab === "all" ? true : tab === "wrapped" ? ["done", "cancelled"].includes(s) : !["done", "cancelled"].includes(s);
    return [...days]
      .filter((d) => keep(d.status))
      .sort((a, b) => rank(a.status) - rank(b.status) || (a.shoot_date ?? "").localeCompare(b.shoot_date ?? ""));
  }, [days, tab]);


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

  const writeDetails = () =>
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

  /** Check the client and the crew are actually free before booking the day. */
  const saveDetails = async () => {
    if (!open || !date) return writeDetails();
    const crewIds = Array.from(
      new Set(
        itemsOf(open.id)
          .flatMap((i) => crew.filter((c) => c.content_id === i.id))
          .map((c) => c.user_id)
          .filter(Boolean) as string[]
      )
    );
    const { data } = await supabase.rpc("availability_conflicts", {
      _user_ids: crewIds.length ? crewIds : null,
      _resident_id: open.resident_id,
      _on_date: date,
      _from_time: callTime || null,
      _to_time: null,
    });
    const rows = (data as Conflict[]) ?? [];
    if (rows.length === 0) return writeDetails();
    const hard = rows.filter((r) => r.strictness === "hard");
    if (hard.length === 0) {
      toast.warning(
        `Heads up: ${rows.map((r) => `${whoIsBusy(r)} — ${r.title}`).join("; ")}. Saving anyway.`
      );
      return writeDetails();
    }
    setClash(hard);
  };

  const whoIsBusy = (c: Conflict) =>
    c.owner_kind === "resident"
      ? residents.find((r) => r.id === c.resident_id)?.name ?? "The client"
      : memberName(c.owner_user_id) ?? "A crew member";

  const forceThrough = async () => {
    if (!open || !clash) return;
    if (!overrideReason.trim()) return toast.error("Give a reason for forcing this booking.");
    setBusy(true);
    const { error } = await supabase.from("schedule_overrides").insert(
      clash.map((c) => ({
        shoot_day_id: open.id,
        on_date: date,
        blocked_user_id: c.owner_kind === "staff" ? c.owner_user_id : null,
        blocked_resident_id: c.owner_kind === "resident" ? c.resident_id : null,
        reason: overrideReason.trim(),
        approved_by: userId,
      })) as never
    );
    setBusy(false);
    if (error) return toast.error(error.message);
    setClash(null);
    setOverrideReason("");
    await writeDetails();
  };



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

  /** The brief as plain text — used for the copy button and read by everyone on the day. */
  const briefText = (d: ShootDay) => {
    const lines = [
      `SHOOT DAY — ${ownerName(d)}`,
      `Date: ${d.shoot_date ?? "to be set"}`,
      `Call time: ${d.call_time ?? "to be set"}`,
      `Location: ${d.location ?? "to be set"}`,
    ];
    if (d.notes) lines.push("", `Notes: ${d.notes}`);
    lines.push("", "What we are shooting:");
    itemsOf(d.id).forEach((i) => {
      lines.push(`- ${refCode(i.ref_no)} ${i.title} (${i.content_type})`);
      const c = crewOf(i.id);
      if (c.length) lines.push(`  ${c.join(" · ")}`);
    });
    const g = gearOf(d.id);
    if (g.length) lines.push("", `Gear: ${g.join(", ")}`);
    return lines.join("\n");
  };

  /** Emails the brief to everyone crewed on the day plus the client's contact person. */
  const sendBrief = async (d: ShootDay) => {
    const list = itemsOf(d.id);
    const uids = new Set<string>();
    list.forEach((i) => crew.filter((c) => c.content_id === i.id && c.user_id).forEach((c) => uids.add(c.user_id as string)));
    const contact = residents.find((r) => r.id === d.resident_id)?.contact_user_id;
    if (contact) uids.add(contact);
    const emails = [...uids].map((u) => members.find((m) => m.user_id === u)?.email).filter(Boolean) as string[];
    if (emails.length === 0) {
      toast.error("Nobody to send to yet — crew the ideas on this day first.");
      return;
    }

    setBusy(true);
    const sentAt = new Date().toISOString();
    const templateData = {
      owner: ownerName(d),
      date: d.shoot_date ?? "",
      callTime: d.call_time ?? "",
      location: d.location ?? "",
      notes: d.notes ?? "",
      ideas: list.map((i) => ({
        ref: refCode(i.ref_no),
        title: i.title,
        type: i.content_type,
        crew: crewOf(i.id).join(" · "),
      })),
      gear: gearOf(d.id),
    };

    let failed = 0;
    for (const email of emails) {
      const { error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "shoot-day-brief",
          recipientEmail: email,
          idempotencyKey: `shoot-brief-${d.id}-${sentAt}-${email}`,
          templateData,
        },
      });
      if (error) failed += 1;
    }
    await supabase.from("shoot_days").update({ brief_sent_at: sentAt }).eq("id", d.id);
    setBusy(false);
    await load();
    if (failed === emails.length) toast.error("The brief could not go out — email sending isn't live yet.");
    else toast.success(`Brief sent to ${emails.length - failed} of the team.`);
  };

  const copyBrief = async (d: ShootDay) => {
    await navigator.clipboard.writeText(briefText(d));
    toast.success("Brief copied — paste it anywhere.");
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
        <SectionHeading
          index="01"
          title={tab === "wrapped" ? "Wrapped" : tab === "all" ? "Every shoot day" : "Planned"}
          hint={`${sorted.length} day${sorted.length === 1 ? "" : "s"}`}
        />
        <div className="mb-4 flex flex-wrap gap-2">
          {(["planned", "wrapped", "all"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`press rounded-full border px-3 py-1 text-xs focus-ring ${
                tab === t ? "border-signal bg-signal text-paper" : "border-rule bg-paper-raised text-ink-soft"
              }`}
            >
              {t === "planned" ? "Planned" : t === "wrapped" ? "Wrapped" : "All"}
            </button>
          ))}
        </div>
        {loading ? (
          <p className="text-sm text-ink-faint">Loading…</p>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-ink-soft">
            {tab === "wrapped" ? "No wrapped days yet." : "Nothing yet. As soon as an idea is crewed it shows up here."}
          </p>
        ) : (
          <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule">
            {sorted.map((d) => {
              const list = itemsOf(d.id);
              const wrapped = d.status === "done";
              return (
                <li key={d.id}>
                  <button
                    onClick={() => setOpenId(d.id)}
                    className="w-full text-left px-4 py-4 flex flex-wrap items-center gap-3 hover:bg-paper-sunken focus-ring"
                  >
                    <CalendarDays className="h-4 w-4 text-ink-faint shrink-0" />
                    <span className="font-semibold">{ownerName(d)}</span>
                    <StatusChip value={STATUS_LABEL[d.status] ?? d.status} tone={d.status === "draft" ? "amber" : wrapped ? "neutral" : "active"} />
                    <span className="num text-xs text-ink-soft">
                      {wrapped ? `shot ${d.shoot_date ?? "—"}` : d.shoot_date ?? "no date yet"}
                    </span>
                    {d.call_time && !wrapped && <span className="num text-xs text-ink-faint">{d.call_time}</span>}
                    {d.brief_sent_at && !wrapped && <span className="text-[11px] text-ink-faint">brief sent</span>}
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

              {/* the brief everyone reads */}
              <div className="rounded-xl border border-rule bg-paper-raised p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="eyebrow text-ink-faint">Shoot day brief</span>
                  {open.brief_sent_at && (
                    <span className="text-[11px] text-ink-faint">sent {new Date(open.brief_sent_at).toLocaleString()}</span>
                  )}
                  <div className="ml-auto flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => copyBrief(open)}>
                      Copy
                    </Button>
                    {canEditContent && (
                      <Button size="sm" disabled={busy} onClick={() => sendBrief(open)}>
                        {open.brief_sent_at ? "Send again" : "Send the brief"}
                      </Button>
                    )}
                  </div>
                </div>
                <pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-ink-soft">{briefText(open)}</pre>
              </div>

              {/* where the content went, once the day is wrapped */}
              {open.status === "done" && (
                <div className="rounded-xl border border-rule bg-paper-sunken p-4">
                  <div className="eyebrow text-ink-faint">Where the content is now</div>
                  <ul className="mt-2 space-y-1.5">
                    {itemsOf(open.id).map((i) => (
                      <li key={i.id} className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="num text-[11px] text-ink-faint w-20 shrink-0">{refCode(i.ref_no)}</span>
                        <span className="truncate">{i.title}</span>
                        <StatusChip value={i.stage} tone={i.stage === "Archived" || i.stage === "Posted" ? "neutral" : "active"} />
                        <span className="text-xs text-ink-faint">{STAGE_NOTE[i.stage as Stage] ?? ""}</span>
                        <a className="ml-auto text-xs text-signal underline focus-ring" href={`/app/content?ref=${i.ref_no}`}>
                          Open
                        </a>
                      </li>
                    ))}
                    {itemsOf(open.id).length === 0 && <li className="text-xs text-ink-soft">Nothing was attached to this day.</li>}
                  </ul>
                </div>
              )}


              {(canEditContent || onCrewToday) && (
                <div className="flex flex-wrap gap-2">
                  {canEditContent && open.status === "draft" && (
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

      <Dialog open={!!clash} onOpenChange={(v) => !v && setClash(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>That day is blocked</DialogTitle>
          </DialogHeader>
          <ul className="space-y-2 text-sm">
            {(clash ?? []).map((c) => (
              <li key={c.block_id} className="rounded-lg border border-signal/50 px-3 py-2">
                <span className="font-semibold">{whoIsBusy(c)}</span> is not available on {date} — {c.title}.
              </li>
            ))}
          </ul>
          {canOverride ? (
            <>
              <p className="mt-3 text-xs text-ink-soft">
                You can force this booking through. The reason is kept on the record.
              </p>
              <textarea
                className={field}
                rows={2}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Why this has to happen anyway"
              />
              <div className="mt-3 flex gap-2">
                <Button onClick={forceThrough} disabled={busy}>
                  Force the booking
                </Button>
                <Button variant="ghost" onClick={() => setClash(null)}>
                  Pick another day
                </Button>
              </div>
            </>
          ) : (
            <div className="mt-3 flex gap-2">
              <Button variant="ghost" onClick={() => setClash(null)}>
                Pick another day
              </Button>
              <span className="self-center text-xs text-ink-soft">
                A managing director or founder can override this.
              </span>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

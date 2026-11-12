import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Ban, CheckCircle2, ChevronLeft, ChevronRight, XCircle } from "lucide-react";
import { cutLabel } from "@/lib/postLinks";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PortalCard, PortalEmpty } from "@/components/portal/PortalPage";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { kampalaDay, postWhen } from "@/lib/portalSchedule";
import { windowLabel } from "@/lib/postReview";
import { CAL_STYLE, calStatus, type CalStatus } from "@/lib/clientCalendar";
import PostReviewCard, { type ReviewItem } from "@/components/portal/PostReviewCard";

type Item = ReviewItem & { stage: string; metrics_due_at: string | null; metrics_filled_at: string | null };
type Entry = { id: string; date: string; time?: string; title: string; kind: "shoot" | "post"; to: string; note?: string; status?: CalStatus; stage?: string };
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const addDays = (d: string, n: number) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const KEY: CalStatus[] = ["posted", "not_edited", "awaiting_client", "numbers_due", "rejected", "cancelled", "other"];

/** The client's calendar. `staff` shows the same view read-only for the team, with the System Admin override. */
export default function ClientCalendar({ residentId, staff = false, isAdmin = false }: { residentId: string; staff?: boolean; isAdmin?: boolean }) {
  const today = kampalaDay(new Date());
  const [month, setMonth] = useState(today.slice(0, 7));
  const [entries, setEntries] = useState<Entry[]>([]);
  const [items, setItems] = useState<Record<string, Item>>({});
  const [approves, setApproves] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!residentId) return;
    (async () => {
      const [s, c, r] = await Promise.all([
        supabase.from("shoot_days").select("id, shoot_date, call_time, location").eq("resident_id", residentId),
        supabase.from("content_items").select("*").eq("resident_id", residentId),
        supabase.from("residents").select("client_approves_content").eq("id", residentId).maybeSingle(),
      ]);
      const gate = !!(r.data as { client_approves_content?: boolean } | null)?.client_approves_content;
      setApproves(gate);
      const out: Entry[] = [];
      (s.data ?? []).forEach((d) => d.shoot_date && out.push({ id: `s-${d.id}`, date: d.shoot_date, time: d.call_time?.slice(0, 5), title: "Shoot day", kind: "shoot", to: staff ? `/app/shoots/${d.id}` : `/portal/shoots/${d.id}`, note: d.location ?? undefined }));
      const map: Record<string, Item> = {};
      ((c.data ?? []) as unknown as Item[]).forEach((i) => {
        map[i.id] = i;
        const w = i.posted_at ? new Date(i.posted_at) : postWhen({ planned_at: i.planned_at ?? null, scheduled_post_at: i.scheduled_post_at });
        if (!w) return;
        const status = calStatus(i, gate, today);
        const win = windowLabel(i).split(", ").slice(1).join(", ");
        out.push({ id: `c-${i.id}`, date: kampalaDay(w), time: i.posted_at ? undefined : win, title: i.title, kind: "post", to: "#", status, stage: i.stage, note: status === "other" ? i.stage : status === "cancelled" && i.cancelled_reason ? `Cancelled: ${i.cancelled_reason}` : CAL_STYLE[status].label });
      });
      setItems(map);
      setEntries(out.sort((a, b) => (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? ""))));
    })();
  }, [residentId, tick, staff, today]);

  const todo = useMemo(() => Object.values(items).filter((i) => calStatus(i, approves, today) === "awaiting_client"), [items, approves, today]);
  const days = useMemo(() => {
    const first = `${month}-01`;
    const dow = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
    const start = addDays(first, -dow);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [month]);
  const byDay = useMemo(() => { const m = new Map<string, Entry[]>(); entries.forEach((e) => m.set(e.date, [...(m.get(e.date) ?? []), e])); return m; }, [entries]);
  const upcoming = entries.filter((e) => e.date >= today).slice(0, 20);
  const step = (n: number) => { const [y, m] = month.split("-").map(Number); setMonth(new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7)); };
  const label = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
  const show = (id: string) => { setOpen(id); setTimeout(() => document.getElementById("post-review")?.scrollIntoView({ behavior: "smooth" }), 50); };

  const Icon = ({ s }: { s?: CalStatus }) =>
    s === "posted" ? <CheckCircle2 className="h-3 w-3 shrink-0 text-acc-lime" /> :
    s === "cancelled" ? <Ban className="h-3 w-3 shrink-0 text-state-stop" /> :
    s === "rejected" || s === "changes" ? <XCircle className="h-3 w-3 shrink-0 text-state-stop" /> : null;

  const chip = (e: Entry) => e.kind === "post" ? (
    <button type="button" key={e.id} onClick={() => show(e.id.slice(2))} className={cn("flex w-full items-center gap-1 truncate rounded border px-1.5 py-0.5 text-left text-[10px]", CAL_STYLE[e.status ?? "other"].cls)}>
      <Icon s={e.status} />
      <span className="truncate">{e.title}</span>
      {e.status === "other" && <span className="ml-auto shrink-0 rounded bg-paper px-1 text-[9px] text-ink-faint">{e.stage}</span>}
    </button>
  ) : (
    <Link key={e.id} to={e.to} className="block truncate rounded border border-acc-violet/50 bg-acc-violet-soft px-1.5 py-0.5 text-[10px]">
      {e.time ? `${e.time} ` : ""}{e.title}
    </Link>
  );

  const override = async (id: string) => {
    const note = window.prompt("Approve this video for the client? Add a short reason (optional).");
    if (note === null) return;
    const { error } = await supabase.rpc("admin_override_client_approval" as never, { _id: id, _note: note } as never);
    if (error) return toast.error(error.message);
    toast.success("Approved for the client and moved to Handover.");
    setTick((t) => t + 1);
  };

  return (
    <div className="space-y-6">
      {(approves || staff) && (
        <PortalCard title={staff ? "Waiting on the client" : "Your to-do"} hint={`${todo.length}`}>
          {!approves ? <PortalEmpty>This client does not approve content. The team signs videos off.</PortalEmpty> :
            todo.length === 0 ? <PortalEmpty>{staff ? "Nothing waiting on the client." : "Nothing to approve right now."}</PortalEmpty> : (
            <ul className="space-y-2">{todo.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-acc-blue/60 bg-acc-blue-soft px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">Approve: {i.title}</span>
                {i.edit_file_url && <a href={i.edit_file_url} target="_blank" rel="noreferrer" className="text-xs text-signal">{cutLabel(i.platforms)}</a>}
                <Button size="sm" variant="outline" onClick={() => show(i.id)}>Open</Button>
                {staff && isAdmin && <Button size="sm" onClick={() => override(i.id)}>Approve for client</Button>}
              </li>))}</ul>
          )}
        </PortalCard>
      )}

      <PortalCard title={label}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="icon-sm" onClick={() => step(-1)} aria-label="Previous month"><ChevronLeft /></Button>
          <Button variant="ghost" size="sm" onClick={() => setMonth(today.slice(0, 7))}>Today</Button>
          <Button variant="ghost" size="icon-sm" onClick={() => step(1)} aria-label="Next month"><ChevronRight /></Button>
          <span className="ml-auto flex flex-wrap gap-1.5 text-[10px]">
            <span className="rounded border border-acc-violet/50 bg-acc-violet-soft px-1.5">Shoot</span>
            {KEY.filter((k) => k !== "awaiting_client" || approves).map((k) => <span key={k} className={cn("rounded border px-1.5", CAL_STYLE[k].cls)}>{CAL_STYLE[k].label}</span>)}
          </span>
        </div>
        <div className="hidden sm:block">
          <div className="grid grid-cols-7">{DOW.map((d) => <div key={d} className="py-1 text-center text-[10px] text-ink-faint">{d}</div>)}</div>
          <div className="grid grid-cols-7 border-l border-t border-hairline">
            {days.map((d) => { const list = byDay.get(d) ?? []; return (
              <div key={d} className={cn("min-h-[92px] border-b border-r border-hairline p-1", d.slice(0, 7) !== month && "opacity-40")}>
                <button type="button" onClick={() => setPicked(d)} className={cn("rounded-full px-1.5 text-[11px]", d === today ? "bg-signal text-paper" : "text-ink-faint")}>{Number(d.slice(8))}</button>
                <div className="mt-1 space-y-1">{list.slice(0, 3).map(chip)}{list.length > 3 && <button onClick={() => setPicked(d)} className="text-[10px] text-signal">+{list.length - 3} more</button>}</div>
              </div>); })}
          </div>
        </div>
        {picked && <div className="mt-4 space-y-1"><div className="text-xs text-ink-faint">{picked}</div>{(byDay.get(picked) ?? []).map(chip)}{!(byDay.get(picked)?.length) && <PortalEmpty>Nothing on this day.</PortalEmpty>}</div>}
      </PortalCard>

      {open && items[open] && (
        <div id="post-review">
          <PortalCard title={staff ? "What the client sees" : "Review this post"}>
            <PostReviewCard key={open + tick} item={items[open]} readOnly={staff} canApprove={approves && items[open].stage === "Review"} canCancel={staff} onDone={() => setTick((t) => t + 1)} />
            <div className="mt-2 flex gap-2">
              {staff && isAdmin && approves && items[open].stage === "Review" && <Button size="sm" onClick={() => override(open)}>Approve for client</Button>}
              <Button variant="ghost" size="sm" onClick={() => setOpen(null)}>Close</Button>
            </div>
          </PortalCard>
        </div>
      )}

      <PortalCard title="Coming up" hint={`${upcoming.length}`}>
        {upcoming.length === 0 ? <PortalEmpty>Nothing scheduled yet.</PortalEmpty> : (
          <ul className="space-y-2">{upcoming.map((e) => (
            <li key={e.id}><Link to={e.to} onClick={(ev) => { if (e.kind === "post") { ev.preventDefault(); show(e.id.slice(2)); } }} className={cn("flex items-center gap-3 rounded-xl border px-3 py-2", e.kind === "post" ? CAL_STYLE[e.status ?? "other"].cls : "border-hairline")}>
              <span className="num w-24 shrink-0 text-xs text-ink-faint">{new Date(`${e.date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}{e.time ? ` ${e.time}` : ""}</span>
              <Icon s={e.status} />
              <span className={cn("min-w-0 flex-1 truncate text-sm", e.status === "cancelled" && "line-through decoration-state-stop decoration-2")}>{e.title}</span>
              <span className="text-[11px] text-ink-faint">{e.kind === "shoot" ? e.note ?? "Shoot" : e.note}</span>
            </Link></li>))}</ul>
        )}
      </PortalCard>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePortalClient } from "@/hooks/usePortalClient";
import PortalPage, { PortalCard, PortalEmpty } from "@/components/portal/PortalPage";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { kampalaDay, postWhen } from "@/lib/portalSchedule";
import { windowLabel } from "@/lib/postReview";
import PostReviewCard, { type ReviewItem } from "@/components/portal/PostReviewCard";

type Entry = { id: string; date: string; time?: string; title: string; kind: "shoot" | "post"; to: string; note?: string };
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const addDays = (d: string, n: number) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

export default function PortalCalendar() {
  const { client, clientId, loading } = usePortalClient();
  const today = kampalaDay(new Date());
  const [month, setMonth] = useState(today.slice(0, 7));
  const [entries, setEntries] = useState<Entry[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [items, setItems] = useState<Record<string, ReviewItem>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!clientId) return;
    (async () => {
      const [s, c] = await Promise.all([
        supabase.from("shoot_days").select("id, shoot_date, call_time, location").eq("resident_id", clientId),
        supabase.from("content_items").select("*").eq("resident_id", clientId),
      ]);
      const out: Entry[] = [];
      (s.data ?? []).forEach((d) => out.push({ id: `s-${d.id}`, date: d.shoot_date, time: d.call_time?.slice(0, 5), title: "Shoot day", kind: "shoot", to: "/portal/shoots", note: d.location ?? undefined }));
      const map: Record<string, ReviewItem> = {};
      ((c.data ?? []) as unknown as ReviewItem[]).forEach((i) => {
        map[i.id] = i;
        const w = i.posted_at ? new Date(i.posted_at) : postWhen(i);
        if (!w) return;
        const win = windowLabel(i).split(", ").slice(1).join(", ");
        out.push({ id: `c-${i.id}`, date: kampalaDay(w), time: i.posted_at ? undefined : win, title: i.title, kind: "post", to: "/portal/work", note: i.posted_at ? "Posted" : i.client_review_state === "approved" ? "You approved" : i.client_review_state === "changes" ? "Changes asked" : "Needs your review" });
      });
      setItems(map);
      setEntries(out.sort((a, b) => (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? ""))));
    })();
  }, [clientId, tick]);

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
  const chip = (e: Entry) => e.kind === "post" ? (
    <button type="button" key={e.id} onClick={() => { setOpen(e.id.slice(2)); setTimeout(() => document.getElementById("post-review")?.scrollIntoView({ behavior: "smooth" }), 50); }} className="block w-full truncate rounded border border-signal/50 bg-signal/10 px-1.5 py-0.5 text-left text-[10px]">
      {e.title}
    </button>
  ) : (
    <Link key={e.id} to={e.to} className={cn("block truncate rounded border px-1.5 py-0.5 text-[10px]", e.kind === "shoot" ? "border-acc-violet/50 bg-acc-violet-soft" : "border-signal/50 bg-signal/10")}>
      {e.time ? `${e.time} ` : ""}{e.title}
    </Link>
  );

  return (
    <PortalPage title="Your calendar" lede="Your shoots and posts. Tap a post to watch the cut, edit the caption, check collabs and tags, and approve it." client={client} loading={loading}>
      <PortalCard title={label}>
        <div className="mb-3 flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" onClick={() => step(-1)} aria-label="Previous month"><ChevronLeft /></Button>
          <Button variant="ghost" size="sm" onClick={() => setMonth(today.slice(0, 7))}>Today</Button>
          <Button variant="ghost" size="icon-sm" onClick={() => step(1)} aria-label="Next month"><ChevronRight /></Button>
          <span className="ml-auto flex gap-3 text-[11px] text-ink-faint"><span>● Shoot</span><span className="text-signal">● Posting</span></span>
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
        <div id="post-review" className="mt-6">
          <PortalCard title="Review this post" hint="Close">
            <PostReviewCard key={open} item={items[open]} onDone={() => setTick((t) => t + 1)} />
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setOpen(null)}>Close</Button>
          </PortalCard>
        </div>
      )}
      <div className="mt-6">
        <PortalCard title="Coming up" hint={`${upcoming.length}`}>
          {upcoming.length === 0 ? <PortalEmpty>Nothing scheduled yet.</PortalEmpty> : (
            <ul className="space-y-2">{upcoming.map((e) => (
              <li key={e.id}><Link to={e.to} onClick={(ev) => { if (e.kind === "post") { ev.preventDefault(); setOpen(e.id.slice(2)); setTimeout(() => document.getElementById("post-review")?.scrollIntoView({ behavior: "smooth" }), 50); } }} className="flex items-center gap-3 rounded-xl border border-hairline px-3 py-2">
                <span className="num w-24 shrink-0 text-xs text-ink-faint">{new Date(`${e.date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}{e.time ? ` ${e.time}` : ""}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{e.title}</span>
                <span className="text-[11px] text-ink-faint">{e.kind === "shoot" ? e.note ?? "Shoot" : e.note}</span>
              </Link></li>))}</ul>
          )}
        </PortalCard>
      </div>
    </PortalPage>
  );
}

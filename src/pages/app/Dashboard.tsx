import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Seo from "@/components/Seo";
import AppShell from "@/components/system/AppShell";
import { StatusChip } from "@/components/system";
import { DeckHeader, DeckPanel, DeckList, DeckStrip, DeckColumn, DeckCard } from "@/components/deck";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CalendarEntry, KIND_LABEL, addDays, loadCalendar, weekStart } from "@/lib/calendarFeed";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

import { useMyAssignments } from "@/hooks/useMyAssignments";
import { useMyRoles, ROLE_LABELS, type StaffRole } from "@/hooks/useMyRoles";
import { refCode } from "@/lib/contentFlow";
import { weekLabel } from "@/lib/weeks";
import { whenLabel, isOverdue, todayISO } from "@/lib/deck";
import { buildKpi, kpiWindows, loadKpiRaw, type KpiRaw, type KpiScope } from "@/lib/kpi";

type FlowRow = {
  id: string;
  ref_no: number;
  title: string;
  stage: string;
  resident_id: string | null;
  shoot_at: string | null;
  planned_at: string | null;
  metrics_due_at: string | null;
};

type PendingWeek = {
  account_id: string;
  resident_name: string;
  platform: string;
  handle: string;
  week_start: string;
};

type ResidentLink = { id: string; name: string; contact_user_id: string | null; handler_user_id: string | null };

const FOUNDER_ROLES = ["admin", "founder", "managing_director", "creative_director"] as const;

const LIVE = ["Idea", "Approved", "Crewed", "Scheduled", "Shooting", "Editing", "Review", "Handover"];

export default function Dashboard() {
  const { roles, canSeeFinance, departments, canScan, isLeadership, displayName, email, userId, has } = useMyRoles();
  const { isContact: amContact, isHandler: amHandler } = useMyAssignments();
  const isFounder = has(...FOUNDER_ROLES);

  const [myShares, setMyShares] = useState<{ resident_name: string; kind: string; computed_ugx: number }[]>([]);
  const [clients, setClients] = useState<number | null>(null);
  const [flow, setFlow] = useState<FlowRow[]>([]);
  const [resLinks, setResLinks] = useState<ResidentLink[]>([]);
  const [myCrew, setMyCrew] = useState<{ content_id: string; role: string }[]>([]);
  const [pendingWeeks, setPendingWeeks] = useState<PendingWeek[]>([]);
  const [shootPrompts, setShootPrompts] = useState<{ id: string; client: string; why: string; date: string | null }[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { count } = await supabase.from("clients").select("id", { count: "exact", head: true });
      if (!cancelled) setClients(count ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const [{ data: rows }, { data: rs }, { data: cw }, { data: weeks }, { data: shares }] = await Promise.all([
        supabase
          .from("content_items")
          .select("id, ref_no, title, stage, resident_id, shoot_at, planned_at, metrics_due_at")
          .not("stage", "in", '("Archived","Rejected")'),
        supabase.rpc("resident_options"),
        supabase.from("content_crew").select("content_id, role").eq("user_id", userId),
        supabase.rpc("my_pending_account_weeks"),
        supabase.rpc("my_retainer_shares"),
      ]);
      if (cancelled) return;
      setFlow((rows as unknown as FlowRow[]) ?? []);
      setResLinks((rs as unknown as ResidentLink[]) ?? []);
      setMyCrew((cw as { content_id: string; role: string }[]) ?? []);
      setPendingWeeks((weeks as unknown as PendingWeek[]) ?? []);
      setMyShares((shares as unknown as { resident_name: string; kind: string; computed_ugx: number }[]) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || !departments.content) return;
    let cancelled = false;
    (async () => {
      const today = todayISO();
      const [{ data: dd }, { data: rs }] = await Promise.all([
        supabase.from("shoot_days").select("id, resident_id, status, shoot_date").in("status", ["draft", "confirmed", "shooting"]),
        supabase.rpc("resident_options"),
      ]);
      if (cancelled) return;
      const names = new Map(((rs as unknown as ResidentLink[]) ?? []).map((r) => [r.id, r.name]));
      const rows = ((dd as unknown as { id: string; resident_id: string; status: string; shoot_date: string | null }[]) ?? [])
        .filter((d) => d.status === "draft" || (d.shoot_date ?? "") <= today)
        .map((d) => ({
          id: d.id,
          date: d.shoot_date,
          client: names.get(d.resident_id) ?? "Client",
          why: d.status === "draft" ? "Needs a date and gear" : d.status === "shooting" ? "On the shoot" : "Shoot day is today",
        }));
      setShootPrompts(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, departments.content]);

  const [moving, setMoving] = useState<string | null>(null);
  const moveStage = async (id: string, next: string) => {
    setMoving(id);
    const { error } = await supabase.from("content_items").update({ stage: next } as never).eq("id", id);
    setMoving(null);
    if (error) return toast.error(error.message);
    toast.success(`Moved to ${next}.`);
    setFlow((cur) => cur.map((r) => (r.id === id ? { ...r, stage: next } : r)));
  };

  const quickStep = (i: FlowRow): { label: string; next: string } | null => {
    if (i.stage === "Idea" && isFounder) return { label: "Approve", next: "Approved" };
    if (i.stage === "Shooting") return { label: "Shoot done", next: "Editing" };
    return null;
  };

  /** Everything that is genuinely this person's move, most urgent first. */
  const waiting = useMemo(() => {
    if (!userId) return [] as { item: FlowRow; why: string; weight: number; due: string | null }[];
    const today = todayISO();
    const resById = new Map(resLinks.map((r) => [r.id, r]));
    const editorOf = new Set(myCrew.filter((c) => /edit/i.test(c.role)).map((c) => c.content_id));

    const out: { item: FlowRow; why: string; weight: number; due: string | null }[] = [];
    flow.forEach((i) => {
      const r = i.resident_id ? resById.get(i.resident_id) : undefined;
      const contact = r?.contact_user_id === userId || amContact(i.resident_id);
      const handler = r?.handler_user_id === userId || amHandler(i.resident_id);
      const push = (why: string, weight: number, due: string | null = i.planned_at) =>
        out.push({ item: i, why, weight, due });

      switch (i.stage) {
        case "Idea":
          if (isFounder) push("Approve or reject", 3);
          break;
        case "Approved":
          if (contact || isFounder) push("Fill the production team", 3);
          break;
        case "Crewed":
          if (contact || isFounder) push("Set the shoot date", 2);
          break;
        case "Scheduled":
          if ((contact || isFounder) && i.shoot_at && i.shoot_at.slice(0, 10) <= today) push("Shoot day", 0, i.shoot_at);
          break;
        case "Shooting":
          if (contact || isFounder) push("Send to post production", 1);
          break;
        case "Editing":
          if (editorOf.has(i.id)) push("Edit and deliver", 1);
          break;
        case "Review":
          if (isFounder) push("Sign off the cut", 1);
          break;
        case "Handover":
          if (handler || isFounder) push("Post it", 1);
          break;
        case "Posted":
          if ((handler || isFounder) && i.metrics_due_at && i.metrics_due_at.slice(0, 10) <= today)
            push("Add the numbers", 2, i.metrics_due_at);
          break;
      }
    });
    return out.sort((a, b) => a.weight - b.weight || (a.due ?? "9").localeCompare(b.due ?? "9"));
  }, [flow, resLinks, myCrew, userId, isFounder, amContact, amHandler]);

  const live = flow.filter((f) => LIVE.includes(f.stage));
  const mine = new Set(myCrew.map((c) => c.content_id));
  const onMyPlate = live.filter((f) => mine.has(f.id));

  /** Dated things happening now — shoots, posts due, numbers due. */
  const today = useMemo(() => {
    const t = todayISO();
    const rows: { id: string; when: string; title: string; note: string; to: string; late: boolean }[] = [];
    shootPrompts.forEach((s) =>
      rows.push({ id: `s-${s.id}`, when: whenLabel(s.date), title: s.client, note: s.why, to: "/app/shoots", late: isOverdue(s.date) })
    );
    flow
      .filter((f) => f.stage === "Handover" && f.planned_at && f.planned_at.slice(0, 10) <= t)
      .forEach((f) =>
        rows.push({
          id: `p-${f.id}`,
          when: whenLabel(f.planned_at),
          title: f.title,
          note: "Due to be posted",
          to: `/app/content?ref=${f.ref_no}`,
          late: isOverdue(f.planned_at),
        })
      );
    return rows.slice(0, 8);
  }, [shootPrompts, flow]);

  const titles = roles.filter((r): r is StaffRole => r in ROLE_LABELS).map((r) => ROLE_LABELS[r]);
  const shareTotal = myShares.reduce((s, r) => s + Number(r.computed_ugx ?? 0), 0);

  /* ---- KPI performance: last 30 days against the 30 before ---- */
  const windows = useMemo(() => kpiWindows(), []);
  const [kpiRaw, setKpiRaw] = useState<KpiRaw | null>(null);
  const [scope, setScope] = useState<KpiScope>("mine");

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    loadKpiRaw(userId, windows).then((raw) => {
      if (!cancelled) setKpiRaw(raw);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, windows]);

  const kpi = useMemo(
    () =>
      kpiRaw
        ? buildKpi({
            userId,
            scope: isLeadership ? scope : "mine",
            content: kpiRaw.content,
            crew: kpiRaw.crew,
            metrics: kpiRaw.metrics,
            myAccountIds: kpiRaw.myAccountIds,
            pendingWeeks: pendingWeeks.length,
            windows,
          })
        : null,
    [kpiRaw, userId, scope, isLeadership, pendingWeeks.length, windows]
  );


  const [weekOffset, setWeekOffset] = useState(0);
  const [weekEntries, setWeekEntries] = useState<CalendarEntry[]>([]);
  const weekFrom = useMemo(() => addDays(weekStart(todayISO()), weekOffset * 7), [weekOffset]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekFrom, i)), [weekFrom]);

  useEffect(() => {
    let cancelled = false;
    loadCalendar(weekFrom, addDays(weekFrom, 6)).then((d) => {
      if (!cancelled) setWeekEntries(d.entries);
    });
    return () => {
      cancelled = true;
    };
  }, [weekFrom]);

  const thisWeek = useMemo(
    () => weekEntries.filter((e) => e.kind !== "busy" && e.date >= todayISO()).slice(0, 10),
    [weekEntries]
  );

  const tagline = waiting.length

    ? `${waiting.length} thing${waiting.length === 1 ? "" : "s"} need${waiting.length === 1 ? "s" : ""} you before anything else today.`
    : "Nothing is blocked on you right now. Here is where everything stands.";

  return (
    <AppShell>
      <Seo title="Command deck — Site 99" description="Site 99 operating system." path="/app" noindex />

      <DeckHeader
        name={displayName || email || "there"}
        titles={titles}
        tagline={tagline}
        actions={
          <Link
            to="/app/calendar"
            className="press rounded-full border border-rule px-3.5 py-2 eyebrow text-[10px] text-ink-soft hover:text-signal hover:border-signal/50 focus-ring"
          >
            Open calendar →
          </Link>
        }
      />

      <DeckStrip
        figures={[
          { label: "Waiting on you", value: waiting.length, tone: waiting.length ? "signal" : "quiet" },
          { label: "On your plate", value: onMyPlate.length, to: "/app/content" },
          { label: "In the pipeline", value: live.length, to: "/app/content" },
          canSeeFinance || myShares.length
            ? { label: "Your month so far", value: `UGX ${shareTotal.toLocaleString()}` }
            : { label: "Clients", value: clients ?? "—", to: "/app/residents" },
        ]}
      />

      <div className="mt-4 grid gap-3 lg:grid-cols-4 md:grid-cols-2">
        <DeckColumn
          title="Waiting on you"
          count={waiting.length}
          to="/app/content"
          empty="Nothing is sitting with you."
          delay={0}
        >
          {waiting.slice(0, 10).map(({ item, why }) => (
            <DeckCard
              key={`${item.id}-${why}`}
              to={`/app/content?ref=${item.ref_no}`}
              eyebrow={`${refCode(item.ref_no)} · ${item.stage}`}
              title={item.title}
              note={why}
              tone="signal"
              action={
                quickStep(item)
                  ? {
                      label: quickStep(item)!.label,
                      busy: moving === item.id,
                      onClick: () => moveStage(item.id, quickStep(item)!.next),
                    }
                  : undefined
              }
            />
          ))}
        </DeckColumn>

        <DeckColumn title="Today & overdue" count={today.length} to="/app/shoots" empty="Nothing on the clock." delay={60}>
          {today.map((r) => (
            <DeckCard key={r.id} to={r.to} eyebrow={r.when} title={r.title} note={r.note} tone={r.late ? "late" : "default"} />
          ))}
        </DeckColumn>

        <DeckColumn title="This week" count={thisWeek.length} to="/app/calendar" toLabel="Calendar" empty="A clear week." delay={120}>
          {thisWeek.map((e) => (
            <DeckCard
              key={e.id}
              to={e.to}
              eyebrow={`${KIND_LABEL[e.kind]} · ${e.date.slice(8, 10)}/${e.date.slice(5, 7)}`}
              title={e.title}
              note={e.note}
            />
          ))}
        </DeckColumn>

        <DeckColumn title="Your departments" count={modules.length} delay={180}>
          {modules.map((m) => (
            <DeckCard
              key={m.to}
              to={m.to}
              title={m.label}
              note={m.note}
              right={
                typeof m.count === "number" && m.count > 0 ? (
                  <span className="num text-sm text-signal tabular-nums">{m.count}</span>
                ) : undefined
              }
            />
          ))}
        </DeckColumn>
      </div>

      <section className="rise mt-8">
        <div className="rule-b pb-3 mb-3 flex items-center gap-3">
          <h2 className="display text-lg">Your week</h2>
          <span className="eyebrow text-[10px] text-ink-faint">{weekFrom} →</span>
          <div className="ml-auto flex items-center rounded-full border border-rule overflow-hidden">
            <button onClick={() => setWeekOffset((n) => n - 1)} className="px-2 py-1.5 hover:text-signal focus-ring" aria-label="Previous week">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => setWeekOffset(0)} className="px-3 py-1.5 eyebrow text-[10px] focus-ring">
              This week
            </button>
            <button onClick={() => setWeekOffset((n) => n + 1)} className="px-2 py-1.5 hover:text-signal focus-ring" aria-label="Next week">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <Link to="/app/calendar" className="eyebrow text-[10px] text-signal focus-ring whitespace-nowrap">
            Full calendar →
          </Link>
        </div>
        <div className="grid gap-2 md:grid-cols-7">
          {weekDays.map((d) => {
            const list = weekEntries.filter((e) => e.date === d);
            const isToday = d === todayISO();
            return (
              <div key={d} className={`surface rounded-xl p-2 ${isToday ? "border-signal/50" : ""}`}>
                <div className="flex items-baseline justify-between px-1 pb-2">
                  <span className="eyebrow text-[9px] text-ink-faint">{DAY_LABELS[new Date(`${d}T00:00:00Z`).getUTCDay()]}</span>
                  <span className={`num text-sm tabular-nums ${isToday ? "text-signal font-semibold" : ""}`}>
                    {Number(d.slice(8, 10))}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {list.length === 0 && <p className="px-1 py-3 text-[11px] text-ink-faint">Clear</p>}
                  {list.slice(0, 4).map((e) =>
                    e.to ? (
                      <Link
                        key={e.id}
                        to={e.to}
                        className="block rounded border border-rule px-2 py-1.5 text-[11px] hover:border-signal/50 focus-ring"
                      >
                        <div className="truncate">{e.title}</div>
                        <div className="text-[10px] text-ink-faint truncate">{KIND_LABEL[e.kind]}</div>
                      </Link>
                    ) : (
                      <div
                        key={e.id}
                        className="rounded border border-dashed border-ink-faint/60 px-2 py-1.5 text-[11px] text-ink-soft"
                      >
                        <div className="truncate">{e.title}</div>
                        <div className="text-[10px] text-ink-faint truncate">{e.note}</div>
                      </div>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {pendingWeeks.length > 0 && (
        <DeckPanel
          index="01"
          title={`Weekly numbers — ${weekLabel(pendingWeeks[0].week_start)}`}
          hint={`${pendingWeeks.length} account${pendingWeeks.length === 1 ? "" : "s"} to fill`}
          delay={200}
        >
          <DeckList>
            {pendingWeeks.map((p) => (
              <li key={p.account_id} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                <span className="text-sm font-semibold">{p.resident_name}</span>
                <StatusChip value={p.platform} tone="violet" />
                <span className="text-xs text-ink-faint truncate">{p.handle}</span>
                <Link to="/app/residents" className="ml-auto eyebrow text-signal focus-ring whitespace-nowrap">
                  Add the week →
                </Link>
              </li>
            ))}
          </DeckList>
        </DeckPanel>
      )}

      {myShares.length > 0 && (
        <DeckPanel index="02" title="Your retainer share" hint="This month, your line only" delay={240}>
          <DeckList>
            {myShares.map((s) => (
              <li key={`${s.resident_name}-${s.kind}`} className="px-4 py-3 flex items-center gap-3">
                <span className="text-sm font-semibold">{s.resident_name}</span>
                <span className="eyebrow text-ink-faint">{s.kind}</span>
                <span className="num ml-auto text-sm">UGX {(s.computed_ugx ?? 0).toLocaleString()}</span>
              </li>
            ))}
          </DeckList>
        </DeckPanel>
      )}

    </AppShell>
  );
}

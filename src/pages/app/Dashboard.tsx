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
import { buildWaiting, type FlowRow, type ResidentLink } from "@/lib/inbox";
import { buildGreeting } from "@/lib/greeting";
import { buildKpi, kpiWindows, loadKpiRaw, type KpiRaw, type KpiScope } from "@/lib/kpi";

type PendingWeek = {
  account_id: string;
  resident_name: string;
  platform: string;
  handle: string;
  week_start: string;
};

const FOUNDER_ROLES = ["admin", "founder", "managing_director", "creative_director"] as const;

const LIVE = ["Idea", "Approved", "Crewed", "Scheduled", "Shooting", "Editing", "Review", "Handover"];

export default function Dashboard() {
  const { roles, canSeeFinance, departments, isLeadership, displayName, email, userId, has } = useMyRoles();
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

  const waiting = useMemo(
    () => buildWaiting({ userId, flow, resLinks, myCrew, isFounder, amContact, amHandler }),
    [flow, resLinks, myCrew, userId, isFounder, amContact, amHandler]
  );

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
            shoots: kpiRaw.shoots,
            shootItems: kpiRaw.shootItems,
            myAccountIds: kpiRaw.myAccountIds,
            myResidentIds: kpiRaw.myResidentIds,
            targets: kpiRaw.targets,
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

  const kampalaNow = useMemo(() => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Kampala",
      hour: "2-digit",
      hour12: false,
      weekday: "short",
      day: "numeric",
      month: "numeric",
    }).formatToParts(new Date());
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const weekdayIdx = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
    return {
      hour: Number(get("hour")) || 0,
      weekday: weekdayIdx < 0 ? new Date().getDay() : weekdayIdx,
      dayOfMonth: Number(get("day")) || 1,
      month: (Number(get("month")) || 1) - 1,
    };
  }, []);

  const shootsToday = useMemo(
    () => weekEntries.filter((e) => e.kind === "shoot" && e.date === todayISO()).length,
    [weekEntries]
  );

  const { headline, note: tagline } = buildGreeting({
    name: displayName || email || "there",
    hour: kampalaNow.hour,
    weekday: kampalaNow.weekday,
    dayOfMonth: kampalaNow.dayOfMonth,
    month: kampalaNow.month,
    roleLabel: titles[0],
    waiting: waiting.length,
    onMyPlate: onMyPlate.length,
    shootsToday,
    eventsThisWeek: thisWeek.length,
  });

  return (
    <AppShell>
      <Seo title="Command deck — Site 99" description="Site 99 operating system." path="/app" noindex />

      <DeckHeader
        name={displayName || email || "there"}
        titles={titles}
        tagline={tagline}
        headline={headline}
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

        <DeckColumn
          title={scope === "studio" && isLeadership ? "Studio performance" : "Your KPI performance"}
          delay={180}
          empty="Nothing to measure yet."
        >
          {isLeadership && (
            <div className="flex items-center rounded-full border border-rule overflow-hidden text-[10px] mb-1">
              {(["mine", "studio"] as KpiScope[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  className={`flex-1 px-3 py-1.5 eyebrow focus-ring ${
                    scope === s ? "bg-signal text-paper" : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {s === "mine" ? "Mine" : "Studio"}
                </button>
              ))}
            </div>
          )}

          {!kpi ? (
            <p className="px-2 py-6 text-center text-xs text-ink-faint">Working out your numbers…</p>
          ) : kpi.empty && scope === "mine" ? (
            <p className="px-2 py-6 text-center text-xs text-ink-faint">
              Nothing posted or logged in the last 30 days yet — your figures show up here as soon as work lands.
            </p>
          ) : (
            <>
              {kpi.figures.map((f) => (
                <DeckCard
                  key={f.key}
                  to={f.to}
                  eyebrow={f.label}
                  title={f.value}
                  note={
                    f.target
                      ? `${f.note} · target ${f.target.toLocaleString()}`
                      : f.note
                  }
                  below={
                    f.progress === null ? undefined : (
                      <div className="mt-2 h-1 w-full rounded-full bg-paper-sunken overflow-hidden">
                        <div
                          className={`h-full rounded-full ${f.progress >= 1 ? "bg-acc-lime" : "bg-signal"}`}
                          style={{ width: `${Math.round(f.progress * 100)}%` }}
                        />
                      </div>
                    )
                  }
                  right={
                    f.delta === null ? undefined : (
                      <span
                        className={`num text-[11px] tabular-nums whitespace-nowrap ${
                          f.delta > 0 ? "text-acc-lime" : f.delta < 0 ? "text-signal" : "text-ink-faint"
                        }`}
                      >
                        {f.delta > 0 ? "▲" : f.delta < 0 ? "▼" : "="} {Math.abs(f.delta).toLocaleString()}
                        {f.deltaUnit}
                      </span>
                    )
                  }
                />
              ))}
              {kpi.best && kpi.worst && kpi.best !== kpi.worst && (
                <p className="px-2 pt-1 text-[11px] text-ink-soft">
                  Strongest: <span className="text-ink">{kpi.best}</span> · push on{" "}
                  <span className="text-signal">{kpi.worst}</span>
                </p>
              )}
            </>
          )}
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

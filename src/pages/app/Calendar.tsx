import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Seo from "@/components/Seo";
import AppShell from "@/components/system/AppShell";
import { Button } from "@/components/ui/button";
import BlockDialog from "@/components/calendar/BlockDialog";
import { useMyRoles } from "@/hooks/useMyRoles";
import {
  CalendarEntry,
  EntryKind,
  KIND_LABEL,
  addDays,
  loadCalendar,
  monthGridRange,
  weekStart,
} from "@/lib/calendarFeed";
import { AvailabilityBlock, describeRepeat, timeLabel } from "@/lib/recurrence";
import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const KINDS: EntryKind[] = ["shoot", "post", "numbers", "event", "busy"];

const KIND_STYLE: Record<EntryKind, string> = {
  shoot: "border-signal/50 text-ink",
  post: "border-rule text-ink",
  numbers: "border-rule text-ink-soft",
  event: "border-rule text-ink",
  busy: "border-dashed border-ink-faint/60 text-ink-soft",
};

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function todayISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kampala" }).format(new Date());
}

export default function CalendarPage() {
  const { userId, isLeadership, displayName, email } = useMyRoles();
  const today = todayISO();

  const [view, setView] = useState<"month" | "week">("month");
  const [anchor, setAnchor] = useState(today);
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([]);
  const [residents, setResidents] = useState<{ id: string; name: string }[]>([]);
  const [people, setPeople] = useState<{ user_id: string; display_name: string | null; email: string }[]>([]);
  const [kinds, setKinds] = useState<EntryKind[]>(KINDS);
  const [person, setPerson] = useState("all");
  const [client, setClient] = useState("all");
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<AvailabilityBlock | null>(null);
  const [pickedDate, setPickedDate] = useState(today);
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => {
    if (view === "week") {
      const from = weekStart(anchor);
      return { from, to: addDays(from, 6) };
    }
    return monthGridRange(anchor);
  }, [view, anchor]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await loadCalendar(range.from, range.to);
    setEntries(data.entries);
    setBlocks(data.blocks);
    setResidents(data.residents);
    setPeople(data.people);
    setLoading(false);
  }, [range.from, range.to]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const shown = useMemo(
    () =>
      entries.filter((e) => {
        if (!kinds.includes(e.kind)) return false;
        if (client !== "all" && e.residentId !== client) return false;
        if (person !== "all") {
          if (person === "me") return e.userId === userId || e.kind !== "busy";
          return e.userId === person;
        }
        return true;
      }),
    [entries, kinds, client, person, userId]
  );

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    shown.forEach((e) => map.set(e.date, [...(map.get(e.date) ?? []), e]));
    return map;
  }, [shown]);

  const days = useMemo(() => {
    const out: string[] = [];
    for (let d = range.from; d <= range.to; d = addDays(d, 1)) out.push(d);
    return out;
  }, [range]);

  const monthLabel = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${anchor.slice(0, 7)}-01T00:00:00Z`)
  );

  const step = (dir: 1 | -1) =>
    setAnchor((cur) => {
      if (view === "week") return addDays(cur, dir * 7);
      const [y, m] = cur.slice(0, 7).split("-").map(Number);
      const next = new Date(Date.UTC(y, m - 1 + dir, 1));
      return next.toISOString().slice(0, 10);
    });

  const myBlocks = blocks.filter((b) => b.owner_user_id === userId);
  const clientBlocks = blocks.filter((b) => b.owner_kind === "resident");

  const openNew = (date: string) => {
    setEditing(null);
    setPickedDate(date);
    setDialog(true);
  };

  return (
    <AppShell>
      <Seo title="Calendar — Site 99" description="Studio schedule and availability." path="/app/calendar" noindex />

      <header className="rule-b pb-4 mb-5 flex flex-wrap items-end gap-3">
        <div>
          <div className="eyebrow text-signal mb-1">Schedule</div>
          <h1 className="display text-2xl md:text-3xl">{view === "week" ? `Week of ${weekStart(anchor)}` : monthLabel}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Shoots, posts, deadlines and events — plus who is not available.
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-full border border-rule overflow-hidden">
            <button onClick={() => step(-1)} className="px-2 py-1.5 hover:text-signal focus-ring" aria-label="Previous">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => setAnchor(today)} className="px-3 py-1.5 eyebrow text-[10px] focus-ring">
              Today
            </button>
            <button onClick={() => step(1)} className="px-2 py-1.5 hover:text-signal focus-ring" aria-label="Next">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="flex rounded-full border border-rule overflow-hidden">
            {(["month", "week"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn("px-3 py-1.5 eyebrow text-[10px] capitalize focus-ring", view === v && "bg-signal text-paper")}
              >
                {v}
              </button>
            ))}
          </div>
          <Button onClick={() => openNew(today)} className="gap-1.5">
            <CalendarPlus className="h-4 w-4" />
            I'm busy
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {KINDS.map((k) => {
          const on = kinds.includes(k);
          return (
            <button
              key={k}
              onClick={() => setKinds((cur) => (on ? cur.filter((x) => x !== k) : [...cur, k]))}
              className={cn(
                "press rounded-full border px-3 py-1 text-xs",
                on ? "border-signal bg-signal/10 text-ink" : "border-rule text-ink-faint"
              )}
            >
              {KIND_LABEL[k]}
            </button>
          );
        })}
        <select
          value={person}
          onChange={(e) => setPerson(e.target.value)}
          className="rounded-full border border-rule bg-paper-raised px-3 py-1 text-xs"
        >
          <option value="all">Everyone</option>
          <option value="me">Just me</option>
          {people.map((p) => (
            <option key={p.user_id} value={p.user_id}>
              {p.display_name || p.email}
            </option>
          ))}
        </select>
        <select
          value={client}
          onChange={(e) => setClient(e.target.value)}
          className="rounded-full border border-rule bg-paper-raised px-3 py-1 text-xs"
        >
          <option value="all">All clients</option>
          {residents.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        {loading && <span className="eyebrow text-[10px] text-ink-faint">Loading…</span>}
      </div>

      {view === "month" ? (
        <div className="surface rounded-xl overflow-hidden">
          <div className="grid grid-cols-7 rule-b">
            {DOW.map((d) => (
              <div key={d} className="px-2 py-2 eyebrow text-[9px] text-ink-faint text-center">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const list = byDay.get(d) ?? [];
              const outside = d.slice(0, 7) !== anchor.slice(0, 7);
              return (
                <button
                  key={d}
                  onClick={() => openNew(d)}
                  className={cn(
                    "text-left min-h-[104px] border-b border-r border-rule p-1.5 align-top hover:bg-paper-sunken focus-ring",
                    outside && "opacity-45"
                  )}
                >
                  <div className="flex items-center gap-1">
                    <span
                      className={cn(
                        "num text-[11px] tabular-nums",
                        d === today ? "rounded-full bg-signal px-1.5 py-0.5 text-paper font-semibold" : "text-ink-faint"
                      )}
                    >
                      {Number(d.slice(8, 10))}
                    </span>
                  </div>
                  <div className="mt-1 space-y-1">
                    {list.slice(0, 3).map((e) => (
                      <span
                        key={e.id}
                        className={cn("block truncate rounded border px-1.5 py-0.5 text-[10px]", KIND_STYLE[e.kind])}
                        title={`${KIND_LABEL[e.kind]}: ${e.title} — ${e.note}`}
                      >
                        {e.title}
                      </span>
                    ))}
                    {list.length > 3 && (
                      <span className="block text-[10px] text-ink-faint">+{list.length - 3} more</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid gap-2 md:grid-cols-7">
          {days.map((d) => {
            const list = byDay.get(d) ?? [];
            return (
              <section key={d} className={cn("surface rounded-xl p-2", d === today && "border-signal/50")}>
                <div className="flex items-baseline justify-between px-1 pb-2">
                  <span className="eyebrow text-[9px] text-ink-faint">{DOW[(new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7]}</span>
                  <span className={cn("num text-sm tabular-nums", d === today && "text-signal font-semibold")}>
                    {Number(d.slice(8, 10))}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {list.length === 0 && <p className="px-1 py-3 text-[11px] text-ink-faint">Clear</p>}
                  {list.map((e) =>
                    e.to ? (
                      <Link
                        key={e.id}
                        to={e.to}
                        className={cn("block rounded border px-2 py-1.5 text-[11px] focus-ring", KIND_STYLE[e.kind])}
                      >
                        <div className="truncate">{e.title}</div>
                        <div className="text-[10px] text-ink-faint truncate">{e.note}</div>
                      </Link>
                    ) : (
                      <div key={e.id} className={cn("rounded border px-2 py-1.5 text-[11px]", KIND_STYLE[e.kind])}>
                        <div className="truncate">{e.title}</div>
                        <div className="text-[10px] text-ink-faint truncate">{e.note}</div>
                      </div>
                    )
                  )}
                </div>
                <button
                  onClick={() => openNew(d)}
                  className="mt-2 w-full rounded border border-dashed border-rule py-1 text-[10px] text-ink-faint hover:text-signal focus-ring"
                >
                  + busy
                </button>
              </section>
            );
          })}
        </div>
      )}

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="eyebrow text-[10px] rule-b pb-2 mb-3">My busy times</h2>
          <ul className="surface rounded-xl divide-y divide-rule">
            {myBlocks.length === 0 && <li className="px-4 py-5 text-sm text-ink-soft">Nothing blocked out yet.</li>}
            {myBlocks.map((b) => (
              <li key={b.id} className="px-4 py-3 flex items-center gap-3">
                <div className="min-w-0">
                  <div className="text-sm truncate">{b.title}</div>
                  <div className="text-[11px] text-ink-soft truncate">
                    {describeRepeat(b)} · {timeLabel(b)}
                  </div>
                </div>
                <span
                  className={cn(
                    "ml-auto rounded-full border px-2 py-0.5 text-[10px] whitespace-nowrap",
                    b.strictness === "hard" ? "border-signal text-signal" : "border-rule text-ink-soft"
                  )}
                >
                  {b.strictness === "hard" ? "Do not schedule" : "Warn only"}
                </span>
                <button
                  onClick={() => {
                    setEditing(b);
                    setDialog(true);
                  }}
                  className="eyebrow text-[10px] text-signal focus-ring"
                >
                  Edit
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="eyebrow text-[10px] rule-b pb-2 mb-3">Client busy times</h2>
          <ul className="surface rounded-xl divide-y divide-rule">
            {clientBlocks.length === 0 && <li className="px-4 py-5 text-sm text-ink-soft">No client has blocked time.</li>}
            {clientBlocks.map((b) => (
              <li key={b.id} className="px-4 py-3 flex items-center gap-3">
                <div className="min-w-0">
                  <div className="text-sm truncate">
                    {residents.find((r) => r.id === b.resident_id)?.name ?? "Client"} — {b.title}
                  </div>
                  <div className="text-[11px] text-ink-soft truncate">
                    {describeRepeat(b)} · {timeLabel(b)}
                  </div>
                </div>
                <span
                  className={cn(
                    "ml-auto rounded-full border px-2 py-0.5 text-[10px] whitespace-nowrap",
                    b.strictness === "hard" ? "border-signal text-signal" : "border-rule text-ink-soft"
                  )}
                >
                  {b.strictness === "hard" ? "Do not schedule" : "Warn only"}
                </span>
                {isLeadership && (
                  <button
                    onClick={() => {
                      setEditing(b);
                      setDialog(true);
                    }}
                    className="eyebrow text-[10px] text-signal focus-ring"
                  >
                    Edit
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <BlockDialog
        open={dialog}
        onOpenChange={setDialog}
        onSaved={refresh}
        userId={userId}
        residents={residents}
        canBlockClients={isLeadership}
        defaultDate={pickedDate}
        editing={editing}
      />

      <p className="mt-6 text-[11px] text-ink-faint">
        Signed in as {displayName || email}. Busy times you mark are visible to the team when they schedule you.
      </p>
    </AppShell>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Seo from "@/components/Seo";
import AppShell from "@/components/system/AppShell";
import { PageHeader, StatusChip } from "@/components/system";
import { Button } from "@/components/ui/button";
import { refCode } from "@/lib/contentFlow";
import {
  OUTCOME_LABEL,
  OUTCOME_TONE,
  budgetState,
  dayLabel,
  dayTotals,
  loadClientMoney,
  loadDayFunds,
  loadDayMoney,
  potBalance,
  ugx,
  type FundLine,
  type Outcome,
  type SpendLine,
} from "@/lib/clientMoney";
import { ArrowLeft, Printer } from "lucide-react";

type Day = {
  id: string;
  resident_id: string | null;
  project_id: string | null;
  status: string;
  shoot_date: string | null;
  call_time: string | null;
  location: string | null;
  notes: string | null;
  budget_ugx: number;
  budget_note: string | null;
};

type Piece = { ref_no: number; title: string; outcome: Outcome; outcome_note: string | null; footage_where: string | null };

const STATUS_LABEL: Record<string, string> = {
  draft: "Needs a date",
  confirmed: "Confirmed",
  shooting: "On the shoot",
  done: "Wrapped",
  cancelled: "Cancelled",
};

/** A one-page account of a shoot day: what was planned, what was shot, what it cost. */
export default function ShootDayReport() {
  const { dayId = "" } = useParams();
  const [loading, setLoading] = useState(true);
  const [day, setDay] = useState<Day | null>(null);
  const [ownerName, setOwnerName] = useState("Shoot day");
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [crewNames, setCrewNames] = useState<string[]>([]);
  const [gearNames, setGearNames] = useState<string[]>([]);
  const [spend, setSpend] = useState<SpendLine[]>([]);
  const [funds, setFunds] = useState<FundLine[]>([]);
  const [potLeft, setPotLeft] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const { data: d } = await supabase.from("shoot_days").select("*").eq("id", dayId).maybeSingle();
      if (!d) return setLoading(false);
      const dd = d as unknown as Day;
      setDay(dd);

      const [{ data: rows }, { data: books }, sp, fu] = await Promise.all([
        supabase.from("shoot_day_items").select("*").eq("shoot_day_id", dayId),
        supabase.from("shoot_day_equipment").select("equipment_id").eq("shoot_day_id", dayId),
        loadDayMoney(dayId),
        loadDayFunds(dayId),
      ]);
      setSpend(sp);
      setFunds(fu);

      const ids = (rows ?? []).map((r) => (r as { content_id: string }).content_id);
      const [{ data: content }, { data: crew }, { data: gear }] = await Promise.all([
        ids.length
          ? supabase.from("content_items").select("id, ref_no, title").in("id", ids)
          : Promise.resolve({ data: [] as never[] }),
        ids.length
          ? supabase.from("content_crew").select("content_id, role, user_id, note").in("content_id", ids)
          : Promise.resolve({ data: [] as never[] }),
        (books ?? []).length
          ? supabase
              .from("equipment")
              .select("id, name")
              .in("id", (books ?? []).map((b) => (b as { equipment_id: string }).equipment_id))
          : Promise.resolve({ data: [] as never[] }),
      ]);

      const byId = new Map((content ?? []).map((c) => [(c as { id: string }).id, c as { ref_no: number; title: string }]));
      setPieces(
        (rows ?? []).map((r) => {
          const row = r as { content_id: string; outcome: string | null; outcome_note: string | null; footage_where: string | null };
          const c = byId.get(row.content_id);
          return {
            ref_no: c?.ref_no ?? 0,
            title: c?.title ?? "Untitled",
            outcome: (row.outcome ?? "planned") as Outcome,
            outcome_note: row.outcome_note,
            footage_where: row.footage_where,
          };
        })
      );
      setGearNames((gear ?? []).map((g) => (g as { name: string }).name));

      const crewRows = (crew ?? []) as { role: string; user_id: string | null; note: string | null }[];
      const uids = [...new Set(crewRows.map((c) => c.user_id).filter(Boolean))] as string[];
      const { data: members } = uids.length
        ? await supabase.from("team_members").select("user_id, display_name, email").in("user_id", uids)
        : { data: [] as never[] };
      const nameOf = (uid: string | null) => {
        const m = (members ?? []).find((x) => (x as { user_id: string }).user_id === uid) as
          | { display_name: string | null; email: string }
          | undefined;
        return m?.display_name || m?.email || null;
      };
      setCrewNames(crewRows.map((c) => `${c.role}: ${nameOf(c.user_id) ?? c.note ?? "unassigned"}`));

      if (dd.resident_id) {
        const [{ data: res }, money] = await Promise.all([
          supabase.from("residents").select("name").eq("id", dd.resident_id).maybeSingle(),
          loadClientMoney(dd.resident_id),
        ]);
        setOwnerName((res as { name: string } | null)?.name ?? "Client");
        setPotLeft(potBalance(money.funds, money.spend).balance);
      } else if (dd.project_id) {
        const { data: p } = await supabase.from("projects").select("title").eq("id", dd.project_id).maybeSingle();
        setOwnerName(`${(p as { title: string } | null)?.title ?? "Project"} (project)`);
      }
      setLoading(false);
    })();
  }, [dayId]);

  const totals = useMemo(() => dayTotals(spend), [spend]);
  const budget = useMemo(() => budgetState(day?.budget_ugx ?? 0, totals.total), [day?.budget_ugx, totals.total]);
  const paidIn = useMemo(
    () => funds.reduce((a, f) => a + (f.direction === "top_up" ? f.amount_ugx : -f.amount_ugx), 0),
    [funds]
  );
  const counts = useMemo(() => {
    const c = { shot: 0, partly: 0, missed: 0, planned: 0 } as Record<Outcome, number>;
    pieces.forEach((p) => (c[p.outcome] += 1));
    return c;
  }, [pieces]);

  if (loading) {
    return (
      <AppShell>
        <p className="text-sm text-ink-soft">Putting the report together…</p>
      </AppShell>
    );
  }
  if (!day) {
    return (
      <AppShell>
        <p className="text-sm text-ink-soft">That shoot day is not there.</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Seo
        title={`Shoot day report · ${ownerName} · Site 99`}
        description="What was planned, what was shot and what the day cost."
        path={`/app/shoots/${dayId}/report`}
        noindex
      />

      <div className="no-print">
        <PageHeader
          eyebrow="Shoot day report"
          title={ownerName}
          lede={`${dayLabel(day.shoot_date)} · ${STATUS_LABEL[day.status] ?? day.status}`}
          actions={
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to={`/app/shoots/${dayId}`}>
                  <ArrowLeft className="h-4 w-4" /> Back to the day
                </Link>
              </Button>
              <Button size="sm" onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> Print / save as PDF
              </Button>
            </>
          }
        />
      </div>

      <div id="strategy-print" className="rounded-xl border border-rule bg-paper-raised p-6 print:border-0 print:p-0">
        <header className="rule-b pb-4">
          <p className="eyebrow text-ink-faint">Site 99 · Shoot day report</p>
          <h1 className="mt-1 text-2xl font-semibold">{ownerName}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {dayLabel(day.shoot_date)}
            {day.call_time ? ` · call ${day.call_time.slice(0, 5)}` : ""}
            {day.location ? ` · ${day.location}` : ""} · {STATUS_LABEL[day.status] ?? day.status}
          </p>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-4 text-sm">
          <div>
            <div className="eyebrow text-ink-faint">Pieces planned</div>
            <div className="num mt-1 text-xl">{pieces.length}</div>
          </div>
          <div>
            <div className="eyebrow text-ink-faint">Shot</div>
            <div className="num mt-1 text-xl">{counts.shot}</div>
          </div>
          <div>
            <div className="eyebrow text-ink-faint">Partly / not shot</div>
            <div className="num mt-1 text-xl">{counts.partly + counts.missed}</div>
          </div>
          <div>
            <div className="eyebrow text-ink-faint">Total spent</div>
            <div className="num mt-1 text-xl">{ugx(totals.total)}</div>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="eyebrow text-ink-faint">What we shot</h2>
          <ul className="mt-2 divide-y divide-rule text-sm">
            {pieces.length === 0 && <li className="py-2 text-ink-soft">Nothing was attached to this day.</li>}
            {pieces.map((p, i) => (
              <li key={`${p.ref_no}-${i}`} className="flex flex-wrap items-center gap-2 py-2">
                <span className="num w-20 shrink-0 text-[11px] text-ink-faint">{refCode(p.ref_no)}</span>
                <span className="truncate">{p.title}</span>
                <StatusChip className="ml-auto" value={OUTCOME_LABEL[p.outcome]} tone={OUTCOME_TONE[p.outcome]} />
                {(p.outcome_note || p.footage_where) && (
                  <p className="w-full pl-20 text-xs text-ink-faint">
                    {[p.outcome_note, p.footage_where].filter(Boolean).join(" · ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8 grid gap-6 sm:grid-cols-2">
          <div>
            <h2 className="eyebrow text-ink-faint">Who was on it</h2>
            <ul className="mt-2 space-y-1 text-sm text-ink-soft">
              {crewNames.length ? crewNames.map((c) => <li key={c}>{c}</li>) : <li>No crew recorded.</li>}
            </ul>
          </div>
          <div>
            <h2 className="eyebrow text-ink-faint">Gear booked</h2>
            <p className="mt-2 text-sm text-ink-soft">{gearNames.join(", ") || "Nothing booked."}</p>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="eyebrow text-ink-faint">Budget against actual</h2>
          <table className="mt-2 w-full text-sm">
            <tbody className="divide-y divide-rule">
              <tr>
                <td className="py-2">Set aside for the day</td>
                <td className="num py-2 text-right">{day.budget_ugx ? ugx(day.budget_ugx) : "—"}</td>
              </tr>
              <tr>
                <td className="py-2">Paid by the studio</td>
                <td className="num py-2 text-right">{ugx(totals.studio)}</td>
              </tr>
              <tr>
                <td className="py-2">Paid from the client pot</td>
                <td className="num py-2 text-right">{ugx(totals.client)}</td>
              </tr>
              <tr>
                <td className="py-2 font-semibold">Total spent</td>
                <td className="num py-2 text-right font-semibold">{ugx(totals.total)}</td>
              </tr>
              {day.budget_ugx > 0 && (
                <tr>
                  <td className="py-2">{budget.over ? "Over budget by" : "Left over"}</td>
                  <td className={`num py-2 text-right ${budget.over ? "text-signal" : ""}`}>{ugx(Math.abs(budget.left))}</td>
                </tr>
              )}
            </tbody>
          </table>
          {day.budget_note && <p className="mt-2 text-xs text-ink-faint">{day.budget_note}</p>}
        </section>

        <section className="mt-8">
          <h2 className="eyebrow text-ink-faint">Every expense</h2>
          <ul className="mt-2 divide-y divide-rule text-sm">
            {spend.length === 0 && <li className="py-2 text-ink-soft">Nothing was spent on this day.</li>}
            {spend.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="w-28 shrink-0 text-xs text-ink-faint">{dayLabel(s.spent_on)}</span>
                <span>{s.category}</span>
                <span className="text-xs text-ink-faint">{s.payer === "studio" ? "studio" : "client pot"}</span>
                {s.note && <span className="text-xs text-ink-faint truncate">{s.note}</span>}
                <span className="num ml-auto w-32 text-right">{ugx(s.amount_ugx)}</span>
              </li>
            ))}
          </ul>
        </section>

        {day.resident_id && (
          <section className="mt-8">
            <h2 className="eyebrow text-ink-faint">Client payments</h2>
            <ul className="mt-2 divide-y divide-rule text-sm">
              {funds.length === 0 && <li className="py-2 text-ink-soft">Nothing was paid in against this day.</li>}
              {funds.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="w-28 shrink-0 text-xs text-ink-faint">{dayLabel(f.received_on)}</span>
                  <span>{f.direction === "top_up" ? "Paid in" : "Refunded"}</span>
                  <span className="text-xs text-ink-faint">{f.method ?? "—"}</span>
                  {f.reference && <span className="num text-xs text-ink-faint">{f.reference}</span>}
                  <span className="num ml-auto w-32 text-right">{ugx(f.amount_ugx)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink-faint">
              Paid in for this day: {ugx(paidIn)}
              {potLeft !== null ? ` · pot balance now ${ugx(potLeft)}` : ""}
            </p>
          </section>
        )}

        {day.notes && (
          <section className="mt-8">
            <h2 className="eyebrow text-ink-faint">Notes from the day</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-ink-soft">{day.notes}</p>
          </section>
        )}
      </div>
    </AppShell>
  );
}

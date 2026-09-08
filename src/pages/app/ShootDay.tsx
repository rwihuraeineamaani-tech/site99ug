import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Seo from "@/components/Seo";
import AppShell from "@/components/system/AppShell";
import { PageHeader, SectionHeading, StatusChip } from "@/components/system";
import { Button } from "@/components/ui/button";
import { useMyRoles } from "@/hooks/useMyRoles";
import { refCode } from "@/lib/contentFlow";
import {
  OUTCOME_LABEL,
  OUTCOME_TONE,
  PAY_METHODS,
  SPEND_CATEGORIES,
  addFunds,
  addSpend,
  budgetState,
  dayLabel,
  dayTotals,
  loadClientMoney,
  loadDayFunds,
  loadDayMoney,
  potBalance,
  removeSpend,
  setOutcome,
  todayKampala,
  ugx,
  type FundLine,
  type Outcome,
  type SpendLine,
} from "@/lib/clientMoney";
import { ArrowLeft, Camera, Clock, FileText, MapPin, Plus, Trash2, Users, Wallet } from "lucide-react";

const field =
  "mt-1.5 w-full rounded-lg border border-rule bg-paper-raised px-3 py-2 text-sm outline-none press focus:border-signal focus:ring-4 focus:ring-signal/10";

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

type Piece = {
  rowId: string;
  contentId: string;
  ref_no: number;
  title: string;
  content_type: string;
  outcome: Outcome;
  outcome_note: string | null;
  footage_where: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Needs a date",
  confirmed: "Confirmed",
  shooting: "On the shoot",
  done: "Wrapped",
  cancelled: "Cancelled",
};

export default function ShootDayRun() {
  const { dayId = "" } = useParams();
  const nav = useNavigate();
  const { userId, canEditContent, isLeadership, canSeeFinance } = useMyRoles();

  const [loading, setLoading] = useState(true);
  const [day, setDay] = useState<Day | null>(null);
  const [ownerName, setOwnerName] = useState("Shoot day");
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [crewNames, setCrewNames] = useState<string[]>([]);
  const [gearNames, setGearNames] = useState<string[]>([]);
  const [spend, setSpend] = useState<SpendLine[]>([]);
  const [dayFunds, setDayFunds] = useState<FundLine[]>([]);
  const [pot, setPot] = useState<{ balance: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [amCrew, setAmCrew] = useState(false);

  const [spendOpen, setSpendOpen] = useState(false);
  const [sd, setSd] = useState({
    payer: "studio" as "studio" | "client",
    amount: "",
    category: "transport",
    note: "",
    spent_on: todayKampala(),
  });

  const [budgetOpen, setBudgetOpen] = useState(false);
  const [bd, setBd] = useState({ amount: "", note: "" });

  const [payOpen, setPayOpen] = useState(false);
  const [pd, setPd] = useState({
    amount: "",
    method: "mobile money" as string,
    reference: "",
    note: "",
    received_on: todayKampala(),
  });

  const load = async () => {
    const { data: d } = await supabase.from("shoot_days").select("*").eq("id", dayId).maybeSingle();
    if (!d) {
      setLoading(false);
      return;
    }
    const dd = d as unknown as Day;
    setDay(dd);
    setBd({ amount: dd.budget_ugx ? String(dd.budget_ugx) : "", note: dd.budget_note ?? "" });

    const [{ data: rows }, { data: books }, { data: sp }, funds] = await Promise.all([
      supabase.from("shoot_day_items").select("*").eq("shoot_day_id", dayId),
      supabase.from("shoot_day_equipment").select("equipment_id, qty").eq("shoot_day_id", dayId),
      loadDayMoney(dayId).then((x) => ({ data: x })),
      loadDayFunds(dayId),
    ]);
    setSpend(sp as SpendLine[]);
    setDayFunds(funds);


    const contentIds = (rows ?? []).map((r) => (r as { content_id: string }).content_id);
    const [{ data: content }, { data: crew }, { data: gear }] = await Promise.all([
      contentIds.length
        ? supabase.from("content_items").select("id, ref_no, title, content_type").in("id", contentIds)
        : Promise.resolve({ data: [] as never[] }),
      contentIds.length
        ? supabase.from("content_crew").select("content_id, role, user_id, note").in("content_id", contentIds)
        : Promise.resolve({ data: [] as never[] }),
      (books ?? []).length
        ? supabase
            .from("equipment")
            .select("id, name")
            .in("id", (books ?? []).map((b) => (b as { equipment_id: string }).equipment_id))
        : Promise.resolve({ data: [] as never[] }),
    ]);

    const byId = new Map((content ?? []).map((c) => [(c as { id: string }).id, c as { id: string; ref_no: number; title: string; content_type: string }]));
    setPieces(
      (rows ?? []).map((r) => {
        const row = r as { id: string; content_id: string; outcome: string | null; outcome_note: string | null; footage_where: string | null };
        const c = byId.get(row.content_id);
        return {
          rowId: row.id,
          contentId: row.content_id,
          ref_no: c?.ref_no ?? 0,
          title: c?.title ?? "Untitled",
          content_type: c?.content_type ?? "",
          outcome: (row.outcome ?? "planned") as Outcome,
          outcome_note: row.outcome_note,
          footage_where: row.footage_where,
        };
      })
    );
    setGearNames((gear ?? []).map((g) => (g as { name: string }).name));

    const crewRows = (crew ?? []) as { role: string; user_id: string | null; note: string | null }[];
    setAmCrew(!!userId && crewRows.some((c) => c.user_id === userId));
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
      setPot({ balance: potBalance(money.funds, money.spend).balance });
    } else if (dd.project_id) {
      const { data: p } = await supabase.from("projects").select("title").eq("id", dd.project_id).maybeSingle();
      setOwnerName(`${(p as { title: string } | null)?.title ?? "Project"} (project)`);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [dayId]); // eslint-disable-line react-hooks/exhaustive-deps

  const canRun = canEditContent || amCrew;
  const canLogSpend = canRun || canSeeFinance || isLeadership;
  const totals = useMemo(() => dayTotals(spend), [spend]);
  const unmarked = pieces.filter((p) => p.outcome === "planned").length;

  const mark = async (p: Piece, outcome: Outcome) => {
    setPieces((prev) => prev.map((x) => (x.rowId === p.rowId ? { ...x, outcome } : x)));
    try {
      await setOutcome(p.rowId, outcome, p.outcome_note, p.footage_where, userId ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save that.");
      void load();
    }
  };

  const saveDetail = async (p: Piece) => {
    try {
      await setOutcome(p.rowId, p.outcome, p.outcome_note, p.footage_where, userId ?? null);
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save that.");
    }
  };

  const call = async (fn: "start_shoot_day" | "finish_shoot_day", ok: string) => {
    setBusy(true);
    const { error } = await supabase.rpc(fn, { _day_id: dayId });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(ok);
    void load();
  };

  const logSpend = async () => {
    const amount = Number(sd.amount);
    if (!amount || amount <= 0) return toast.error("Put in an amount first.");
    setBusy(true);
    try {
      await addSpend({
        shootDayId: dayId,
        residentId: day?.resident_id ?? null,
        payer: sd.payer,
        amount,
        category: sd.category,
        note: sd.note || null,
        spentOn: sd.spent_on,
      });
      toast.success("Spend logged");
      setSpendOpen(false);
      setSd({ ...sd, amount: "", note: "" });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save that.");
    }
    setBusy(false);
  };

  const drop = async (id: string) => {
    try {
      await removeSpend(id);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove that.");
    }
  };

  if (loading) {
    return (
      <AppShell>
        <p className="text-sm text-ink-soft">Loading the day…</p>
      </AppShell>
    );
  }
  if (!day) {
    return (
      <AppShell>
        <p className="text-sm text-ink-soft">That shoot day is not there.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => nav("/app/shoots")}>
          Back to shoot days
        </Button>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Seo title={`Shoot day · ${ownerName} · Site 99`} description="Run the shoot day: what was shot, what was spent, and wrap." path={`/app/shoots/${dayId}`} />

      <PageHeader
        eyebrow="Shoot day"
        title={ownerName}
        lede={`${dayLabel(day.shoot_date)}${day.call_time ? ` · call ${day.call_time.slice(0, 5)}` : ""}${
          day.location ? ` · ${day.location}` : ""
        }`}
        actions={
          <>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/app/shoots">
                <ArrowLeft className="h-4 w-4" /> All shoot days
              </Link>
            </Button>
            <StatusChip value={STATUS_LABEL[day.status] ?? day.status} />
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-rule bg-paper-raised p-4 text-sm">
          <div className="eyebrow text-ink-faint">Call time</div>
          <div className="mt-1 inline-flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-ink-faint" /> {day.call_time ? day.call_time.slice(0, 5) : "not set"}
          </div>
        </div>
        <div className="rounded-xl border border-rule bg-paper-raised p-4 text-sm">
          <div className="eyebrow text-ink-faint">Location</div>
          <div className="mt-1 inline-flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-ink-faint" /> {day.location || "not set"}
          </div>
        </div>
        <div className="rounded-xl border border-rule bg-paper-raised p-4 text-sm">
          <div className="eyebrow text-ink-faint">Crew</div>
          <div className="mt-1 inline-flex items-center gap-1.5">
            <Users className="h-4 w-4 text-ink-faint" /> {crewNames.length || "no"} on the call sheet
          </div>
        </div>
        <div className="rounded-xl border border-rule bg-paper-raised p-4 text-sm">
          <div className="eyebrow text-ink-faint">Gear</div>
          <div className="mt-1 inline-flex items-center gap-1.5">
            <Camera className="h-4 w-4 text-ink-faint" /> {gearNames.length || "no"} item{gearNames.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      {(crewNames.length > 0 || gearNames.length > 0 || day.notes) && (
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-rule bg-paper-sunken p-4 text-sm">
            <div className="eyebrow text-ink-faint">Who is on it</div>
            <ul className="mt-2 space-y-1 text-ink-soft">
              {crewNames.map((c) => (
                <li key={c}>{c}</li>
              ))}
              {crewNames.length === 0 && <li>No crew yet.</li>}
            </ul>
          </div>
          <div className="rounded-xl border border-rule bg-paper-sunken p-4 text-sm">
            <div className="eyebrow text-ink-faint">Gear booked</div>
            <p className="mt-2 text-ink-soft">{gearNames.join(", ") || "Nothing booked."}</p>
          </div>
          <div className="rounded-xl border border-rule bg-paper-sunken p-4 text-sm">
            <div className="eyebrow text-ink-faint">Notes</div>
            <p className="mt-2 whitespace-pre-wrap text-ink-soft">{day.notes || "No notes."}</p>
          </div>
        </div>
      )}

      {/* what was shot */}
      <section className="mt-10">
        <SectionHeading index="01" title="What we shot" hint={unmarked ? `${unmarked} still to mark` : "all marked"} />
        {pieces.length === 0 ? (
          <p className="text-sm text-ink-soft">No ideas are attached to this day yet.</p>
        ) : (
          <ul className="space-y-3">
            {pieces.map((p) => (
              <li key={p.rowId} className="rounded-xl border border-rule bg-paper-raised p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="num text-[11px] text-ink-faint w-20 shrink-0">{refCode(p.ref_no)}</span>
                  <span className="truncate text-sm">{p.title}</span>
                  <span className="text-xs text-ink-faint">{p.content_type}</span>
                  <StatusChip className="ml-auto" value={OUTCOME_LABEL[p.outcome]} tone={OUTCOME_TONE[p.outcome]} />
                </div>
                {canRun && (
                  <>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(["shot", "partly", "missed"] as Outcome[]).map((o) => (
                        <button
                          key={o}
                          onClick={() => mark(p, o)}
                          className={`rounded-full border px-3 py-1.5 text-xs press focus-ring ${
                            p.outcome === o ? "border-signal bg-signal/10 text-signal" : "border-rule bg-paper-sunken"
                          }`}
                        >
                          {OUTCOME_LABEL[o]}
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="text-sm">
                        <span className="eyebrow text-ink-faint">Note</span>
                        <input
                          className={field}
                          value={p.outcome_note ?? ""}
                          onChange={(e) =>
                            setPieces((prev) => prev.map((x) => (x.rowId === p.rowId ? { ...x, outcome_note: e.target.value } : x)))
                          }
                          onBlur={() => saveDetail(p)}
                          placeholder="Why it went that way"
                        />
                      </label>
                      <label className="text-sm">
                        <span className="eyebrow text-ink-faint">Where the footage is</span>
                        <input
                          className={field}
                          value={p.footage_where ?? ""}
                          onChange={(e) =>
                            setPieces((prev) => prev.map((x) => (x.rowId === p.rowId ? { ...x, footage_where: e.target.value } : x)))
                          }
                          onBlur={() => saveDetail(p)}
                          placeholder="Card 2, drive, folder…"
                        />
                      </label>
                    </div>
                  </>
                )}
                {!canRun && (p.outcome_note || p.footage_where) && (
                  <p className="mt-2 text-xs text-ink-soft">
                    {[p.outcome_note, p.footage_where].filter(Boolean).join(" · ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* money on the day */}
      <section className="mt-10">
        <SectionHeading
          index="02"
          title="Spent on the day"
          hint={pot ? `${ugx(pot.balance)} left in the client pot` : "studio spend"}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-rule bg-paper-raised p-4">
            <div className="eyebrow text-ink-faint">Total spent</div>
            <div className="num mt-1 text-2xl">{ugx(totals.total)}</div>
          </div>
          <div className="rounded-xl border border-rule bg-paper-sunken p-4">
            <div className="eyebrow text-ink-faint">Paid by the studio</div>
            <div className="num mt-1 text-xl">{ugx(totals.studio)}</div>
          </div>
          <div className="rounded-xl border border-rule bg-paper-sunken p-4">
            <div className="eyebrow text-ink-faint">Paid from the client pot</div>
            <div className="num mt-1 text-xl">{ugx(totals.client)}</div>
          </div>
        </div>

        {canLogSpend && (
          <div className="mt-3">
            {spendOpen ? (
              <div className="rounded-xl border border-rule bg-paper-raised p-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="text-sm">
                    <span className="eyebrow text-ink-faint">Who paid</span>
                    <select className={field} value={sd.payer} onChange={(e) => setSd({ ...sd, payer: e.target.value as "studio" | "client" })}>
                      <option value="studio">The studio</option>
                      <option value="client">The client pot</option>
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className="eyebrow text-ink-faint">Amount (UGX)</span>
                    <input
                      className={field}
                      inputMode="numeric"
                      value={sd.amount}
                      onChange={(e) => setSd({ ...sd, amount: e.target.value.replace(/[^0-9]/g, "") })}
                    />
                  </label>
                  <label className="text-sm">
                    <span className="eyebrow text-ink-faint">What for</span>
                    <select className={field} value={sd.category} onChange={(e) => setSd({ ...sd, category: e.target.value })}>
                      {SPEND_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className="eyebrow text-ink-faint">Date</span>
                    <input type="date" className={field} value={sd.spent_on} onChange={(e) => setSd({ ...sd, spent_on: e.target.value })} />
                  </label>
                  <label className="text-sm sm:col-span-2">
                    <span className="eyebrow text-ink-faint">Note</span>
                    <input className={field} value={sd.note} onChange={(e) => setSd({ ...sd, note: e.target.value })} />
                  </label>
                </div>
                {sd.payer === "client" && pot && Number(sd.amount) > pot.balance && (
                  <p className="text-xs text-signal">That is more than what is left in the client pot.</p>
                )}
                <div className="flex gap-2">
                  <Button size="sm" disabled={busy} onClick={logSpend}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSpendOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setSpendOpen(true)}>
                <Plus className="h-4 w-4" /> Log a spend
              </Button>
            )}
          </div>
        )}

        <ul className="mt-4 divide-y divide-rule rounded-xl border border-rule bg-paper-sunken px-4">
          {spend.length === 0 && <li className="py-3 text-xs text-ink-soft">Nothing spent on this day yet.</li>}
          {spend.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <StatusChip value={s.payer === "studio" ? "studio" : "client pot"} tone={s.payer === "studio" ? "blue" : "teal"} />
              <span>{s.category}</span>
              {s.note && <span className="text-xs text-ink-faint truncate">{s.note}</span>}
              <span className="ml-auto text-xs text-ink-faint">{dayLabel(s.spent_on)}</span>
              <span className="num w-32 text-right">{ugx(s.amount_ugx)}</span>
              {(isLeadership || canSeeFinance || s.spent_by === userId) && (
                <button onClick={() => drop(s.id)} aria-label="Remove" className="text-ink-faint hover:text-signal focus-ring">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {canRun && ["confirmed", "shooting"].includes(day.status) && (
        <div className="mt-10 flex flex-wrap items-center gap-3">
          {day.status === "confirmed" && (
            <Button disabled={busy} onClick={() => call("start_shoot_day", "The shoot has started")}>
              Start the shoot
            </Button>
          )}
          <Button variant="outline" disabled={busy || unmarked > 0} onClick={() => call("finish_shoot_day", "Wrapped")}>
            Wrap the day
          </Button>
          {unmarked > 0 && <span className="text-xs text-ink-soft">Mark every piece shot, partly shot or not shot before wrapping.</span>}
        </div>
      )}

      {day.resident_id && (
        <p className="mt-8 text-xs text-ink-faint">
          <Link className="text-signal underline focus-ring" to={`/app/residents/${day.resident_id}`}>
            Open the client hub
          </Link>{" "}
          for their money pot, content and brand.
        </p>
      )}
    </AppShell>
  );
}

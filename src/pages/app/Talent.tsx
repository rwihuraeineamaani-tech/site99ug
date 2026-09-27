import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import Seo from "@/components/Seo";
import AppShell from "@/components/system/AppShell";
import { Metric, PageHeader, SectionHeading, StatusChip, formatUGX } from "@/components/system";
import { supabase } from "@/integrations/supabase/client";
import { useMyRoles } from "@/hooks/useMyRoles";
import { suggestPassword, PASSWORD_HINT } from "@/lib/password";
import { PLATFORMS, accuracy, estimateImpact, estimateReturn, learnRates, type Platform } from "@/lib/forecast";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type Talent = { id: string; name: string; kind: string; category: string | null; phone: string | null; email: string | null; handles: { platform: string; handle: string; followers: number }[]; followers_total: number; day_rate_ugx: number; notes: string | null; active: boolean };
type TLogin = { id: string; talent_id: string; user_id: string | null; email: string };
type Booking = { id: string; talent_id: string; resident_id: string | null; campaign_id: string | null; shoot_day_id: string | null; booked_on: string; fee_ugx: number; status: string; brief: string | null };
type TContract = { id: string; talent_id: string; title: string; usage_terms: string | null; territory: string | null; starts_on: string | null; ends_on: string | null; status: string };
type Campaign = { id: string; name: string; resident_id: string | null; objective: string | null; budget_ugx: number; starts_on: string | null; ends_on: string | null; platforms: string[]; status: string };
type CT = { id: string; campaign_id: string; talent_id: string; fee_ugx: number; posts: number };
type Result = { id: string; campaign_id: string; talent_id: string | null; platform: string | null; reach: number; impressions: number; engagements: number; clicks: number; conversions: number; revenue_ugx: number; recorded_on: string };
type Forecast = { id: string; campaign_id: string | null; name: string; inputs: Record<string, unknown>; outputs: { reach?: number; engagements?: number; cost?: number }; created_at: string };
type Res = { id: string; name: string };
type Shoot = { id: string; resident_id: string; shoot_date: string };

const TITLES: Record<string, { title: string; lede: string }> = {
  overview: { title: "Talent & Campaigns.", lede: "Who's booked, what's owed, which releases are ending and how campaigns are doing." },
  roster: { title: "Roster.", lede: "Our signed roster and the freelancers we book — with their reach, rates and portal access." },
  bookings: { title: "Bookings.", lede: "Book talent for a client, a campaign or a shoot day. Confirming a booking raises the bill for their fee." },
  contracts: { title: "Contracts & releases.", lede: "Agreements and usage rights — where the content can be used and until when." },
  campaigns: { title: "Campaigns.", lede: "Plan campaigns, attach talent and record what really happened." },
  forecasts: { title: "Forecasts.", lede: "Estimate reach, cost and return before you commit. Every number shows how it was worked out." },
};

const btn = "ctl ctl-solid eyebrow px-3 py-2 focus-ring";
const field = "field text-sm mt-1";
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");
const daysTo = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
const num = (v: string) => Math.max(0, Number(v.replace(/[^\d.]/g, "")) || 0);

export default function TalentPage() {
  const { tab = "overview" } = useParams();
  const { has, isLeadership } = useMyRoles();
  const canManage = isLeadership || has("talent_director");
  const [talent, setTalent] = useState<Talent[]>([]);
  const [logins, setLogins] = useState<TLogin[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [contracts, setContracts] = useState<TContract[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [ct, setCt] = useState<CT[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [residents, setResidents] = useState<Res[]>([]);
  const [shoots, setShoots] = useState<Shoot[]>([]);

  const load = async () => {
    const [t, l, b, c, cp, x, r, f, rs, sd] = await Promise.all([
      db.from("talent").select("*").order("name"),
      db.from("talent_users").select("id, talent_id, user_id, email"),
      db.from("talent_bookings").select("*").order("booked_on", { ascending: false }),
      db.from("talent_contracts").select("*").order("ends_on"),
      db.from("campaigns").select("*").order("created_at", { ascending: false }),
      db.from("campaign_talent").select("*"),
      db.from("campaign_results").select("*").order("recorded_on", { ascending: false }),
      db.from("campaign_forecasts").select("*").order("created_at", { ascending: false }),
      db.from("residents").select("id, name").is("archived_at", null).order("name"),
      db.from("shoot_days").select("id, resident_id, shoot_date").gte("shoot_date", new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)).order("shoot_date"),
    ]);
    setTalent(t.data ?? []); setLogins(l.data ?? []); setBookings(b.data ?? []); setContracts(c.data ?? []);
    setCampaigns(cp.data ?? []); setCt(x.data ?? []); setResults(r.data ?? []); setForecasts(f.data ?? []);
    setResidents(rs.data ?? []); setShoots(sd.data ?? []);
  };
  useEffect(() => { load(); }, []);

  const tName = (id: string | null) => talent.find((t) => t.id === id)?.name ?? "—";
  const rName = (id: string | null) => residents.find((r) => r.id === id)?.name ?? "";
  const cName = (id: string | null) => campaigns.find((c) => c.id === id)?.name ?? "";
  const save = async (p: PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    const { error } = await p;
    if (error) { toast.error(error.message); return false; }
    toast.success(ok); load(); return true;
  };

  const head = TITLES[tab] ?? TITLES.overview;
  return (
    <AppShell eyebrow="Talent & Campaigns">
      <Seo title="Talent & Campaigns — Site 99" description="Talent roster, bookings, campaigns and forecasts." path="/app/talent" noindex />
      <PageHeader eyebrow="Talent & Campaigns" title={head.title} lede={head.lede} />
      {!canManage && <p className="mb-6 text-xs text-ink-faint">You can view this section. Changes are made by the Talent Director and leadership.</p>}
      {tab === "overview" && <Overview {...{ talent, bookings, contracts, campaigns, results, tName, cName }} />}
      {tab === "roster" && <Roster {...{ talent, logins, bookings, canManage, save, load }} />}
      {tab === "bookings" && <Bookings {...{ talent, bookings, campaigns, residents, shoots, canManage, save, tName, rName, cName }} />}
      {tab === "contracts" && <Contracts {...{ talent, contracts, canManage, save, tName }} />}
      {tab === "campaigns" && <Campaigns {...{ talent, campaigns, ct, results, forecasts, residents, canManage, save, tName, rName }} />}
      {tab === "forecasts" && <Forecasts {...{ talent, campaigns, ct, results, forecasts, canManage, save, cName }} />}
    </AppShell>
  );
}

type Save = (p: PromiseLike<{ error: { message: string } | null }>, ok: string) => Promise<boolean>;

function Overview({ talent, bookings, contracts, campaigns, results, tName, cName }: { talent: Talent[]; bookings: Booking[]; contracts: TContract[]; campaigns: Campaign[]; results: Result[]; tName: (id: string | null) => string; cName: (id: string | null) => string }) {
  const week = bookings.filter((b) => b.status !== "cancelled" && daysTo(b.booked_on) >= 0 && daysTo(b.booked_on) <= 7);
  const owed = bookings.filter((b) => b.status === "confirmed" || b.status === "done").reduce((a, b) => a + b.fee_ugx, 0);
  const ending = contracts.filter((c) => c.status === "signed" && c.ends_on && daysTo(c.ends_on) <= 45);
  const live = campaigns.filter((c) => c.status === "live");
  return (
    <>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-12">
        <Metric label="Talent on file" value={String(talent.filter((t) => t.active).length)} />
        <Metric label="Booked this week" value={String(week.length)} />
        <Metric label="Owed to talent" value={formatUGX(owed)} />
        <Metric label="Live campaigns" value={String(live.length)} />
      </div>
      <div className="grid gap-10 lg:grid-cols-2">
        <section>
          <SectionHeading index="01" title="This week" hint="next 7 days" />
          <ul className="surface rounded-2xl divide-y divide-rule">
            {week.map((b) => <li key={b.id} className="px-5 py-3 text-sm flex gap-3"><span className="font-medium">{tName(b.talent_id)}</span><span className="text-ink-soft">{day(b.booked_on)}</span><StatusChip value={b.status} /></li>)}
            {!week.length && <li className="px-5 py-3 text-sm text-ink-soft">Nobody booked this week.</li>}
          </ul>
        </section>
        <section>
          <SectionHeading index="02" title="Releases ending" hint="within 45 days" />
          <ul className="surface rounded-2xl divide-y divide-rule">
            {ending.map((c) => <li key={c.id} className="px-5 py-3 text-sm flex gap-3 flex-wrap"><span className="font-medium">{tName(c.talent_id)}</span><span className="text-ink-soft">{c.title}</span><StatusChip value={daysTo(c.ends_on!) < 0 ? "ended" : `${daysTo(c.ends_on!)} days left`} tone={daysTo(c.ends_on!) <= 14 ? "stop" : "amber"} /></li>)}
            {!ending.length && <li className="px-5 py-3 text-sm text-ink-soft">No usage rights ending soon.</li>}
          </ul>
        </section>
        <section className="lg:col-span-2">
          <SectionHeading index="03" title="Live campaigns" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {live.map((c) => {
              const rs = results.filter((r) => r.campaign_id === c.id);
              return <Link to="/app/talent/campaigns" key={c.id} className="surface rounded-2xl p-4 press"><div className="display text-base">{cName(c.id)}</div><div className="mt-2 text-[11px] text-ink-soft">reach {rs.reduce((a, r) => a + r.reach, 0).toLocaleString()} · engagements {rs.reduce((a, r) => a + r.engagements, 0).toLocaleString()} · budget {formatUGX(c.budget_ugx)}</div></Link>;
            })}
            {!live.length && <p className="text-sm text-ink-soft">No live campaigns.</p>}
          </div>
        </section>
      </div>
    </>
  );
}

function Roster({ talent, logins, bookings, canManage, save, load }: { talent: Talent[]; logins: TLogin[]; bookings: Booking[]; canManage: boolean; save: Save; load: () => void }) {
  const [kind, setKind] = useState<"all" | "roster" | "freelance">("all");
  const blank = { name: "", kind: "freelance", category: "", phone: "", email: "", day_rate_ugx: "", ig: "", igf: "", tt: "", ttf: "", notes: "" };
  const [f, setF] = useState(blank);
  const [adding, setAdding] = useState(false);
  const [portal, setPortal] = useState<{ talent: Talent; email: string; password: string; userId?: string } | null>(null);
  const list = talent.filter((t) => kind === "all" || t.kind === kind);

  const add = async () => {
    if (!f.name.trim()) return toast.error("Add a name");
    const handles = [
      f.ig && { platform: "instagram", handle: f.ig, followers: num(f.igf) },
      f.tt && { platform: "tiktok", handle: f.tt, followers: num(f.ttf) },
    ].filter(Boolean) as Talent["handles"];
    const ok = await save(db.from("talent").insert({ name: f.name.trim(), kind: f.kind, category: f.category || null, phone: f.phone || null, email: f.email || null, day_rate_ugx: num(f.day_rate_ugx), handles, followers_total: handles.reduce((a, h) => a + h.followers, 0), notes: f.notes || null }), "Added to the roster");
    if (ok) { setF(blank); setAdding(false); }
  };
  const submitPortal = async () => {
    if (!portal) return;
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: portal.userId
        ? { action: "talent_login_reset", talent_id: portal.talent.id, user_id: portal.userId, password: portal.password }
        : { action: "talent_login_create", talent_id: portal.talent.id, email: portal.email, password: portal.password },
    });
    const msg = (data as { error?: string } | null)?.error ?? error?.message;
    if (msg) return toast.error(msg);
    toast.success(portal.userId ? "Password reset. Share it with them directly." : `${portal.talent.name} can now sign in to their talent portal.`);
    setPortal(null); load();
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {(["all", "roster", "freelance"] as const).map((k) => <button key={k} onClick={() => setKind(k)} className={`rounded-full px-4 py-1.5 text-xs ${kind === k ? "bg-paper-raised text-ink" : "text-ink-soft"}`}>{k === "roster" ? "signed roster" : k}</button>)}
        {canManage && <button className={`${btn} ml-auto`} onClick={() => setAdding(!adding)}>add talent</button>}
      </div>
      {adding && (
        <div className="surface rounded-2xl p-5 mb-8 grid gap-3 md:grid-cols-4">
          <label className="text-xs text-ink-faint">Name<input className={field} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <label className="text-xs text-ink-faint">Type<select className={field} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="freelance">freelance</option><option value="roster">signed roster</option></select></label>
          <label className="text-xs text-ink-faint">Category<input className={field} placeholder="model, host, creator…" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></label>
          <label className="text-xs text-ink-faint">Day rate (UGX)<input className={field} inputMode="numeric" value={f.day_rate_ugx} onChange={(e) => setF({ ...f, day_rate_ugx: e.target.value })} /></label>
          <label className="text-xs text-ink-faint">Phone<input className={field} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
          <label className="text-xs text-ink-faint">Email<input className={field} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
          <label className="text-xs text-ink-faint">Instagram handle<input className={field} value={f.ig} onChange={(e) => setF({ ...f, ig: e.target.value })} /></label>
          <label className="text-xs text-ink-faint">Instagram followers<input className={field} inputMode="numeric" value={f.igf} onChange={(e) => setF({ ...f, igf: e.target.value })} /></label>
          <label className="text-xs text-ink-faint">TikTok handle<input className={field} value={f.tt} onChange={(e) => setF({ ...f, tt: e.target.value })} /></label>
          <label className="text-xs text-ink-faint">TikTok followers<input className={field} inputMode="numeric" value={f.ttf} onChange={(e) => setF({ ...f, ttf: e.target.value })} /></label>
          <label className="text-xs text-ink-faint md:col-span-2">Notes<input className={field} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
          <button className={btn} onClick={add}>save</button>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((t) => {
          const mine = logins.filter((l) => l.talent_id === t.id);
          const done = bookings.filter((b) => b.talent_id === t.id && b.status !== "cancelled").length;
          return (
            <div key={t.id} className="surface rounded-2xl p-4">
              <div className="flex items-center gap-2">
                <span className="display text-base truncate flex-1">{t.name}</span>
                <StatusChip value={t.kind === "roster" ? "roster" : "freelance"} tone={t.kind === "roster" ? "teal" : "pending"} />
              </div>
              <div className="mt-1 text-[11px] text-ink-faint">{t.category ?? "—"} · {formatUGX(t.day_rate_ugx)} a day · {done} bookings</div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-ink-soft">
                {t.handles.map((h) => <span key={h.platform} className="rounded-full border border-hairline px-2 py-0.5">{h.platform} @{h.handle.replace(/^@/, "")} · {h.followers.toLocaleString()}</span>)}
                {!t.handles.length && <span>no social handles yet</span>}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <StatusChip value={mine.length ? "portal ready" : "no portal login"} tone={mine.length ? "teal" : "amber"} />
                {canManage && (mine.length
                  ? mine.map((m) => <button key={m.id} className="underline underline-offset-4 text-ink-faint hover:text-ink" onClick={() => setPortal({ talent: t, email: m.email, password: "", userId: m.user_id ?? undefined })}>reset {m.email}</button>)
                  : <button className="underline underline-offset-4 text-ink-faint hover:text-ink" onClick={() => setPortal({ talent: t, email: t.email ?? "", password: "" })}>give portal access</button>)}
              </div>
              {portal?.talent.id === t.id && (
                <div className="mt-3 grid gap-2">
                  {!portal.userId && <input className="field text-sm" type="email" placeholder="email" value={portal.email} onChange={(e) => setPortal({ ...portal, email: e.target.value })} />}
                  <input className="field text-sm" placeholder={portal.userId ? "new password" : "temporary password"} value={portal.password} onChange={(e) => setPortal({ ...portal, password: e.target.value })} />
                  <div className="flex flex-wrap gap-2">
                    <button className={btn} onClick={() => setPortal({ ...portal, password: suggestPassword() })}>suggest</button>
                    {portal.password && <button className={btn} onClick={() => { navigator.clipboard.writeText(portal.password); toast.success("Copied"); }}>copy</button>}
                    <button className={btn} onClick={submitPortal}>{portal.userId ? "reset" : "create login"}</button>
                    <button className="text-xs text-ink-faint" onClick={() => setPortal(null)}>cancel</button>
                  </div>
                  <p className="text-[11px] text-ink-faint">{PASSWORD_HINT}</p>
                </div>
              )}
            </div>
          );
        })}
        {!list.length && <p className="text-sm text-ink-soft">No talent here yet.</p>}
      </div>
    </>
  );
}

function Bookings({ talent, bookings, campaigns, residents, shoots, canManage, save, tName, rName, cName }: { talent: Talent[]; bookings: Booking[]; campaigns: Campaign[]; residents: Res[]; shoots: Shoot[]; canManage: boolean; save: Save; tName: (id: string | null) => string; rName: (id: string | null) => string; cName: (id: string | null) => string }) {
  const blank = { talent_id: "", resident_id: "", campaign_id: "", shoot_day_id: "", booked_on: new Date().toISOString().slice(0, 10), fee_ugx: "", brief: "" };
  const [f, setF] = useState(blank);
  const add = async () => {
    if (!f.talent_id) return toast.error("Pick the talent");
    const ok = await save(db.from("talent_bookings").insert({ talent_id: f.talent_id, resident_id: f.resident_id || null, campaign_id: f.campaign_id || null, shoot_day_id: f.shoot_day_id || null, booked_on: f.booked_on, fee_ugx: num(f.fee_ugx), brief: f.brief || null }), "Booking requested");
    if (ok) setF(blank);
  };
  const setStatus = (id: string, status: string) => save(db.from("talent_bookings").update({ status }).eq("id", id), status === "confirmed" ? "Confirmed — the fee bill is now on the payment board" : "Updated");
  return (
    <>
      {canManage && (
        <div className="surface rounded-2xl p-5 mb-8 grid gap-3 md:grid-cols-4">
          <label className="text-xs text-ink-faint">Talent<select className={field} value={f.talent_id} onChange={(e) => { const t = talent.find((x) => x.id === e.target.value); setF({ ...f, talent_id: e.target.value, fee_ugx: f.fee_ugx || String(t?.day_rate_ugx ?? "") }); }}><option value="">Select…</option>{talent.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <label className="text-xs text-ink-faint">Date<input className={field} type="date" value={f.booked_on} onChange={(e) => setF({ ...f, booked_on: e.target.value })} /></label>
          <label className="text-xs text-ink-faint">Fee (UGX)<input className={field} inputMode="numeric" value={f.fee_ugx} onChange={(e) => setF({ ...f, fee_ugx: e.target.value })} /></label>
          <label className="text-xs text-ink-faint">Client<select className={field} value={f.resident_id} onChange={(e) => setF({ ...f, resident_id: e.target.value, shoot_day_id: "" })}><option value="">—</option>{residents.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
          <label className="text-xs text-ink-faint">Campaign<select className={field} value={f.campaign_id} onChange={(e) => setF({ ...f, campaign_id: e.target.value })}><option value="">—</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className="text-xs text-ink-faint">Shoot day<select className={field} value={f.shoot_day_id} onChange={(e) => setF({ ...f, shoot_day_id: e.target.value })}><option value="">—</option>{shoots.filter((s) => !f.resident_id || s.resident_id === f.resident_id).map((s) => <option key={s.id} value={s.id}>{day(s.shoot_date)} · {rName(s.resident_id)}</option>)}</select></label>
          <label className="text-xs text-ink-faint md:col-span-1">Brief<input className={field} value={f.brief} onChange={(e) => setF({ ...f, brief: e.target.value })} /></label>
          <button className={btn} onClick={add}>book</button>
        </div>
      )}
      <ul className="surface rounded-2xl divide-y divide-rule">
        {bookings.map((b) => (
          <li key={b.id} className="px-5 py-4 flex flex-wrap items-center gap-3 text-sm">
            <span className="font-medium">{tName(b.talent_id)}</span>
            <span className="text-ink-soft">{day(b.booked_on)}</span>
            <span className="text-[11px] text-ink-faint">{[rName(b.resident_id), cName(b.campaign_id), b.shoot_day_id ? "shoot day" : ""].filter(Boolean).join(" · ")}</span>
            <StatusChip value={b.status} tone={b.status === "paid" ? "teal" : b.status === "cancelled" ? "stop" : b.status === "requested" ? "pending" : "amber"} />
            <span className="num ml-auto">{formatUGX(b.fee_ugx)}</span>
            {canManage && b.status === "requested" && <button className={btn} onClick={() => setStatus(b.id, "confirmed")}>confirm</button>}
            {canManage && b.status === "confirmed" && <button className={btn} onClick={() => setStatus(b.id, "done")}>mark done</button>}
            {canManage && (b.status === "requested" || b.status === "confirmed") && <button className="text-xs text-ink-faint underline" onClick={() => setStatus(b.id, "cancelled")}>cancel</button>}
          </li>
        ))}
        {!bookings.length && <li className="px-5 py-4 text-sm text-ink-soft">No bookings yet.</li>}
      </ul>
      <p className="mt-3 text-[11px] text-ink-faint">Confirming a booking puts an approved bill for the fee on the Finance payment board. Once Finance pays it, the booking shows as paid.</p>
    </>
  );
}

function Contracts({ talent, contracts, canManage, save, tName }: { talent: Talent[]; contracts: TContract[]; canManage: boolean; save: Save; tName: (id: string | null) => string }) {
  const blank = { talent_id: "", title: "", usage_terms: "", territory: "Uganda", starts_on: "", ends_on: "" };
  const [f, setF] = useState(blank);
  const add = async () => {
    if (!f.talent_id || !f.title) return toast.error("Pick the talent and add a title");
    if (await save(db.from("talent_contracts").insert({ ...f, starts_on: f.starts_on || null, ends_on: f.ends_on || null }), "Contract added")) setF(blank);
  };
  return (
    <>
      {canManage && (
        <div className="surface rounded-2xl p-5 mb-8 grid gap-3 md:grid-cols-4">
          <label className="text-xs text-ink-faint">Talent<select className={field} value={f.talent_id} onChange={(e) => setF({ ...f, talent_id: e.target.value })}><option value="">Select…</option>{talent.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <label className="text-xs text-ink-faint">Title<input className={field} placeholder="Image release — Brand X" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
          <label className="text-xs text-ink-faint">Starts<input className={field} type="date" value={f.starts_on} onChange={(e) => setF({ ...f, starts_on: e.target.value })} /></label>
          <label className="text-xs text-ink-faint">Usage ends<input className={field} type="date" value={f.ends_on} onChange={(e) => setF({ ...f, ends_on: e.target.value })} /></label>
          <label className="text-xs text-ink-faint md:col-span-2">Where it can be used<input className={field} placeholder="social, billboards, TV…" value={f.usage_terms} onChange={(e) => setF({ ...f, usage_terms: e.target.value })} /></label>
          <label className="text-xs text-ink-faint">Territory<input className={field} value={f.territory} onChange={(e) => setF({ ...f, territory: e.target.value })} /></label>
          <button className={btn} onClick={add}>add contract</button>
        </div>
      )}
      <ul className="surface rounded-2xl divide-y divide-rule">
        {contracts.map((c) => {
          const d = c.ends_on ? daysTo(c.ends_on) : null;
          return (
            <li key={c.id} className="px-5 py-4 flex flex-wrap items-center gap-3 text-sm">
              <span className="font-medium">{tName(c.talent_id)}</span>
              <span className="text-ink-soft">{c.title}</span>
              <span className="text-[11px] text-ink-faint">{c.usage_terms ?? ""}{c.territory ? ` · ${c.territory}` : ""}</span>
              <StatusChip value={c.status} tone={c.status === "signed" ? "teal" : "pending"} />
              {d !== null && c.status === "signed" && d <= 45 && <StatusChip value={d < 0 ? "usage ended" : `${d} days left`} tone={d <= 14 ? "stop" : "amber"} />}
              <span className="ml-auto text-[11px] text-ink-faint">{day(c.starts_on)} → {day(c.ends_on)}</span>
              {canManage && c.status === "draft" && <button className={btn} onClick={() => save(db.from("talent_contracts").update({ status: "signed" }).eq("id", c.id), "Marked signed")}>mark signed</button>}
            </li>
          );
        })}
        {!contracts.length && <li className="px-5 py-4 text-sm text-ink-soft">No talent contracts yet.</li>}
      </ul>
    </>
  );
}

function Campaigns({ talent, campaigns, ct, results, forecasts, residents, canManage, save, tName, rName }: { talent: Talent[]; campaigns: Campaign[]; ct: CT[]; results: Result[]; forecasts: Forecast[]; residents: Res[]; canManage: boolean; save: Save; tName: (id: string | null) => string; rName: (id: string | null) => string }) {
  const blank = { name: "", resident_id: "", objective: "", budget_ugx: "", starts_on: "", ends_on: "", platforms: [] as string[] };
  const [f, setF] = useState(blank);
  const [open, setOpen] = useState<string | null>(null);
  const [slot, setSlot] = useState({ talent_id: "", fee_ugx: "", posts: "1" });
  const [res, setRes] = useState({ talent_id: "", platform: "instagram", reach: "", impressions: "", engagements: "", clicks: "", conversions: "", revenue_ugx: "" });
  const add = async () => {
    if (!f.name) return toast.error("Name the campaign");
    if (await save(db.from("campaigns").insert({ ...f, resident_id: f.resident_id || null, budget_ugx: num(f.budget_ugx), starts_on: f.starts_on || null, ends_on: f.ends_on || null }), "Campaign created")) setF(blank);
  };
  return (
    <>
      {canManage && (
        <div className="surface rounded-2xl p-5 mb-8 grid gap-3 md:grid-cols-4">
          <label className="text-xs text-ink-faint">Name<input className={field} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <label className="text-xs text-ink-faint">Client<select className={field} value={f.resident_id} onChange={(e) => setF({ ...f, resident_id: e.target.value })}><option value="">—</option>{residents.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
          <label className="text-xs text-ink-faint">Budget (UGX)<input className={field} inputMode="numeric" value={f.budget_ugx} onChange={(e) => setF({ ...f, budget_ugx: e.target.value })} /></label>
          <label className="text-xs text-ink-faint">Objective<input className={field} placeholder="awareness, sales…" value={f.objective} onChange={(e) => setF({ ...f, objective: e.target.value })} /></label>
          <label className="text-xs text-ink-faint">Starts<input className={field} type="date" value={f.starts_on} onChange={(e) => setF({ ...f, starts_on: e.target.value })} /></label>
          <label className="text-xs text-ink-faint">Ends<input className={field} type="date" value={f.ends_on} onChange={(e) => setF({ ...f, ends_on: e.target.value })} /></label>
          <div className="text-xs text-ink-faint">Platforms<div className="mt-2 flex flex-wrap gap-1">{PLATFORMS.map((p) => <button key={p} type="button" onClick={() => setF({ ...f, platforms: f.platforms.includes(p) ? f.platforms.filter((x) => x !== p) : [...f.platforms, p] })} className={`rounded-full border border-hairline px-2 py-0.5 ${f.platforms.includes(p) ? "bg-signal/15 text-signal" : ""}`}>{p}</button>)}</div></div>
          <button className={btn} onClick={add}>create campaign</button>
        </div>
      )}
      <div className="grid gap-4">
        {campaigns.map((c) => {
          const people = ct.filter((x) => x.campaign_id === c.id);
          const rs = results.filter((r) => r.campaign_id === c.id);
          const tot = (k: keyof Result) => rs.reduce((a, r) => a + (Number(r[k]) || 0), 0);
          const fc = forecasts.find((x) => x.campaign_id === c.id);
          return (
            <section key={c.id} className="surface rounded-2xl p-5">
              <div className="flex flex-wrap items-center gap-3">
                <button className="display text-lg text-left" onClick={() => setOpen(open === c.id ? null : c.id)}>{c.name}</button>
                <StatusChip value={c.status} tone={c.status === "live" ? "teal" : c.status === "done" ? "pending" : "amber"} />
                <span className="text-[11px] text-ink-faint">{rName(c.resident_id)} · {day(c.starts_on)} → {day(c.ends_on)} · {c.platforms.join(", ")}</span>
                <span className="ml-auto num text-sm">{formatUGX(c.budget_ugx)}</span>
                {canManage && <select className="field text-xs w-auto" value={c.status} onChange={(e) => save(db.from("campaigns").update({ status: e.target.value }).eq("id", c.id), "Updated")}>{["planning", "live", "done", "cancelled"].map((s) => <option key={s}>{s}</option>)}</select>}
              </div>
              <div className="mt-3 grid grid-cols-2 md:grid-cols-6 gap-2 text-[11px] text-ink-soft">
                <span>reach {tot("reach").toLocaleString()}{fc?.outputs.reach ? ` (forecast ${fc.outputs.reach.toLocaleString()})` : ""}</span>
                <span>engagements {tot("engagements").toLocaleString()}</span>
                <span>clicks {tot("clicks").toLocaleString()}</span>
                <span>sales {tot("conversions").toLocaleString()}</span>
                <span>revenue {formatUGX(tot("revenue_ugx"))}</span>
                <span>{people.length} talent</span>
              </div>
              {open === c.id && (
                <div className="mt-5 grid gap-6 lg:grid-cols-2">
                  <div>
                    <div className="eyebrow text-ink-faint mb-2">Talent on this campaign</div>
                    <ul className="text-sm space-y-1">{people.map((p) => <li key={p.id}>{tName(p.talent_id)} · {p.posts} posts · {formatUGX(p.fee_ugx)}</li>)}{!people.length && <li className="text-ink-soft">None yet.</li>}</ul>
                    {canManage && (
                      <div className="mt-3 flex flex-wrap gap-2 items-end">
                        <select className="field text-sm w-40" value={slot.talent_id} onChange={(e) => setSlot({ ...slot, talent_id: e.target.value })}><option value="">talent…</option>{talent.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                        <input className="field text-sm w-28" placeholder="fee" value={slot.fee_ugx} onChange={(e) => setSlot({ ...slot, fee_ugx: e.target.value })} />
                        <input className="field text-sm w-20" placeholder="posts" value={slot.posts} onChange={(e) => setSlot({ ...slot, posts: e.target.value })} />
                        <button className={btn} onClick={async () => { if (!slot.talent_id) return; if (await save(db.from("campaign_talent").insert({ campaign_id: c.id, talent_id: slot.talent_id, fee_ugx: num(slot.fee_ugx), posts: Math.max(1, num(slot.posts)) }), "Added")) setSlot({ talent_id: "", fee_ugx: "", posts: "1" }); }}>add</button>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="eyebrow text-ink-faint mb-2">Record results</div>
                    {canManage ? (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <select className="field text-sm" value={res.platform} onChange={(e) => setRes({ ...res, platform: e.target.value })}>{PLATFORMS.map((p) => <option key={p}>{p}</option>)}</select>
                        <select className="field text-sm" value={res.talent_id} onChange={(e) => setRes({ ...res, talent_id: e.target.value })}><option value="">whole campaign</option>{people.map((p) => <option key={p.id} value={p.talent_id}>{tName(p.talent_id)}</option>)}</select>
                        {(["reach", "impressions", "engagements", "clicks", "conversions", "revenue_ugx"] as const).map((k) => <input key={k} className="field text-sm" placeholder={k === "revenue_ugx" ? "revenue UGX" : k === "conversions" ? "sales" : k} value={res[k]} onChange={(e) => setRes({ ...res, [k]: e.target.value })} />)}
                        <button className={btn} onClick={async () => { if (await save(db.from("campaign_results").insert({ campaign_id: c.id, talent_id: res.talent_id || null, platform: res.platform, reach: num(res.reach), impressions: num(res.impressions), engagements: num(res.engagements), clicks: num(res.clicks), conversions: num(res.conversions), revenue_ugx: num(res.revenue_ugx) }), "Results saved")) setRes({ ...res, reach: "", impressions: "", engagements: "", clicks: "", conversions: "", revenue_ugx: "" }); }}>save results</button>
                      </div>
                    ) : <p className="text-sm text-ink-soft">Results are recorded by the Talent Director.</p>}
                  </div>
                </div>
              )}
            </section>
          );
        })}
        {!campaigns.length && <p className="text-sm text-ink-soft">No campaigns yet.</p>}
      </div>
    </>
  );
}

function Forecasts({ talent, campaigns, ct, results, forecasts, canManage, save, cName }: { talent: Talent[]; campaigns: Campaign[]; ct: CT[]; results: Result[]; forecasts: Forecast[]; canManage: boolean; save: Save; cName: (id: string | null) => string }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [plats, setPlats] = useState<Platform[]>(["instagram"]);
  const [posts, setPosts] = useState("2");
  const [boost, setBoost] = useState("0");
  const [campaignId, setCampaignId] = useState("");
  const [ret, setRet] = useState({ clickRate: "1", conversionRate: "3", orderValue: "50000" });

  const followersByCampaign = useMemo(() => {
    const m: Record<string, number> = {};
    ct.forEach((x) => (m[x.campaign_id] = (m[x.campaign_id] ?? 0) + (talent.find((t) => t.id === x.talent_id)?.followers_total ?? 0)));
    return m;
  }, [ct, talent]);
  const learned = learnRates(results, followersByCampaign);
  const chosen = talent.filter((t) => picked.includes(t.id));
  const impact = estimateImpact({ talent: chosen.map((t) => ({ name: t.name, followers: t.followers_total, fee: t.day_rate_ugx })), platforms: plats, posts: num(posts), extraBudget: num(boost), learned });
  const scen = estimateReturn({ budget: impact.cost, reach: impact.reach, clickRate: num(ret.clickRate) / 100, conversionRate: num(ret.conversionRate) / 100, orderValue: num(ret.orderValue) });

  const compare = talent.filter((t) => t.active).map((t) => {
    const o = estimateImpact({ talent: [{ name: t.name, followers: t.followers_total, fee: t.day_rate_ugx }], platforms: plats, posts: 1, extraBudget: 0, learned });
    const past = results.filter((r) => r.talent_id === t.id);
    return { t, o, pastReach: past.reduce((a, r) => a + r.reach, 0) };
  }).sort((a, b) => (a.o.cpm || Infinity) - (b.o.cpm || Infinity));

  const saveForecast = () => save(db.from("campaign_forecasts").insert({
    campaign_id: campaignId || null,
    name: campaignId ? cName(campaignId) : `Forecast ${new Date().toLocaleDateString()}`,
    inputs: { talent: picked, platforms: plats, posts: num(posts), boost: num(boost), ...ret },
    outputs: { reach: impact.reach, engagements: impact.engagements, cost: impact.cost, cpm: impact.cpm, cpe: impact.cpe },
  }), "Forecast saved");

  return (
    <div className="grid gap-12">
      <section>
        <SectionHeading index="01" title="Campaign impact estimator" hint={`using ${impact.source}`} />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="surface rounded-2xl p-5 grid gap-4">
            <div className="text-xs text-ink-faint">Talent<div className="mt-2 flex flex-wrap gap-1">{talent.map((t) => <button key={t.id} onClick={() => setPicked(picked.includes(t.id) ? picked.filter((x) => x !== t.id) : [...picked, t.id])} className={`rounded-full border border-hairline px-2 py-0.5 ${picked.includes(t.id) ? "bg-signal/15 text-signal" : ""}`}>{t.name}</button>)}{!talent.length && <span>Add talent to the roster first.</span>}</div></div>
            <div className="text-xs text-ink-faint">Platforms<div className="mt-2 flex flex-wrap gap-1">{PLATFORMS.map((p) => <button key={p} onClick={() => setPlats(plats.includes(p) ? plats.filter((x) => x !== p) : [...plats, p])} className={`rounded-full border border-hairline px-2 py-0.5 ${plats.includes(p) ? "bg-signal/15 text-signal" : ""}`}>{p}</button>)}</div></div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-ink-faint">Posts each<input className={field} inputMode="numeric" value={posts} onChange={(e) => setPosts(e.target.value)} /></label>
              <label className="text-xs text-ink-faint">Paid boost (UGX)<input className={field} inputMode="numeric" value={boost} onChange={(e) => setBoost(e.target.value)} /></label>
            </div>
          </div>
          <div className="surface rounded-2xl p-5">
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Expected reach" value={impact.reach.toLocaleString()} />
              <Metric label="Engagements" value={impact.engagements.toLocaleString()} />
              <Metric label="Cost per 1,000 views" value={formatUGX(impact.cpm)} />
              <Metric label="Cost per engagement" value={formatUGX(impact.cpe)} />
            </div>
            <div className="mt-4 eyebrow text-ink-faint">How this was worked out</div>
            <ul className="mt-2 space-y-1 text-[12px] text-ink-soft">{impact.working.map((w) => <li key={w}>· {w}</li>)}</ul>
            {canManage && (
              <div className="mt-4 flex flex-wrap gap-2 items-center">
                <select className="field text-sm w-48" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}><option value="">not linked to a campaign</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                <button className={btn} onClick={saveForecast}>save forecast</button>
              </div>
            )}
          </div>
        </div>
      </section>

      <section>
        <SectionHeading index="02" title="Return estimator" hint={`budget ${formatUGX(impact.cost)} · reach ${impact.reach.toLocaleString()}`} />
        <div className="surface rounded-2xl p-5">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-xs text-ink-faint">Click rate (% of reach)<input className={field} value={ret.clickRate} onChange={(e) => setRet({ ...ret, clickRate: e.target.value })} /></label>
            <label className="text-xs text-ink-faint">Conversion rate (% of clicks)<input className={field} value={ret.conversionRate} onChange={(e) => setRet({ ...ret, conversionRate: e.target.value })} /></label>
            <label className="text-xs text-ink-faint">Average order value (UGX)<input className={field} value={ret.orderValue} onChange={(e) => setRet({ ...ret, orderValue: e.target.value })} /></label>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {scen.map((s) => (
              <div key={s.label} className="rounded-xl border border-hairline p-4">
                <div className="eyebrow text-ink-faint">{s.label}</div>
                <div className="mt-2 text-sm">{s.clicks.toLocaleString()} clicks · {s.sales.toLocaleString()} sales</div>
                <div className="display text-xl mt-1">{formatUGX(s.revenue)}</div>
                <div className={`text-xs ${s.roi < 0 ? "text-signal" : "text-ink-soft"}`}>return {(s.roi * 100).toFixed(0)}%</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-ink-faint">Low and high scale the click and conversion rates by 0.6× and 1.4×. Return = (revenue − cost) ÷ cost.</p>
        </div>
      </section>

      <section>
        <SectionHeading index="03" title="Talent comparison" hint="one post each, cheapest reach first" />
        <ul className="surface rounded-2xl divide-y divide-rule">
          {compare.map(({ t, o, pastReach }) => (
            <li key={t.id} className="px-5 py-3 grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
              <span className="font-medium">{t.name}</span>
              <span className="text-ink-soft">{t.followers_total.toLocaleString()} followers</span>
              <span className="text-ink-soft">≈ {o.reach.toLocaleString()} reach</span>
              <span className="num">{formatUGX(o.cpm)} / 1,000</span>
              <span className="text-[11px] text-ink-faint">{pastReach ? `past reach ${pastReach.toLocaleString()}` : "no past results"}</span>
            </li>
          ))}
          {!compare.length && <li className="px-5 py-3 text-sm text-ink-soft">No talent to compare yet.</li>}
        </ul>
      </section>

      <section>
        <SectionHeading index="04" title="Forecast vs actual" hint="how close our estimates were" />
        <ul className="surface rounded-2xl divide-y divide-rule">
          {forecasts.filter((f) => f.campaign_id).map((f) => {
            const actual = results.filter((r) => r.campaign_id === f.campaign_id).reduce((a, r) => a + r.reach, 0);
            const acc = accuracy(f.outputs.reach ?? 0, actual);
            return (
              <li key={f.id} className="px-5 py-3 flex flex-wrap gap-3 text-sm">
                <span className="font-medium">{f.name}</span>
                <span className="text-ink-soft">forecast {(f.outputs.reach ?? 0).toLocaleString()} · actual {actual.toLocaleString()}</span>
                <StatusChip value={actual ? `${acc >= 0 ? "+" : ""}${(acc * 100).toFixed(0)}%` : "waiting for results"} tone={!actual ? "pending" : Math.abs(acc) <= 0.2 ? "teal" : "amber"} />
              </li>
            );
          })}
          {!forecasts.some((f) => f.campaign_id) && <li className="px-5 py-3 text-sm text-ink-soft">Save a forecast linked to a campaign, then record results to see how accurate it was.</li>}
        </ul>
        <p className="mt-3 text-[11px] text-ink-faint">Once two or more campaigns have results, the estimator switches from standard defaults to our own reach and engagement rates.</p>
      </section>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Seo from "@/components/Seo";
import AppShell from "@/components/system/AppShell";
import { Metric, PageHeader, SectionHeading, StatusChip } from "@/components/system";
import { supabase } from "@/integrations/supabase/client";
import RelationsPanel, { type RelationsView } from "@/components/residents/RelationsPanel";
import PortalAccessPanel from "@/components/residents/PortalAccessPanel";

type Member = { user_id: string; display_name: string | null; email: string };
type Res = { id: string; name: string; status: string | null; handler_user_id: string | null; archived_at: string | null };
type Contract = { id: string; resident_id: string; title: string; status: string; ends_on: string | null; value_ugx: number | null };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
const day = (d: string) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const daysTo = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);

const TITLES: Record<string, { title: string; lede: string }> = {
  overview: { title: "Client Relations.", lede: "How every client is doing — who needs a call, who is up for renewal and what they're telling us." },
  onboarding: { title: "Onboarding.", lede: "Welcome new clients: give them their portal login first, then track their onboarding steps." },
  log: { title: "Contact log.", lede: "Every call, meeting and message with a client, in one place." },
  followups: { title: "Follow-ups.", lede: "Promises we've made to clients, with who owns them and when they're due." },
  renewals: { title: "Renewals.", lede: "Contracts ending in the next 60 days. A renewal earns the handler a 5% bonus." },
  feedback: { title: "Feedback.", lede: "Satisfaction scores, praise and complaints from our clients." },
};

export default function RelationsPage() {
  const { tab = "overview" } = useParams();
  const [members, setMembers] = useState<Member[]>([]);
  const [residents, setResidents] = useState<Res[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [health, setHealth] = useState<{ overdue: Record<string, number>; complaints: Record<string, number>; lastContact: Record<string, string>; rating: Record<string, number[]> }>({ overdue: {}, complaints: {}, lastContact: {}, rating: {} });

  useEffect(() => {
    (async () => {
      const t = new Date().toISOString().slice(0, 10);
      const [m, r, c, f, i, fb] = await Promise.all([
        supabase.from("team_members").select("user_id, display_name, email"),
        db.from("residents").select("id, name, status, handler_user_id, archived_at").order("name"),
        supabase.from("resident_contracts").select("id, resident_id, title, status, ends_on, value_ugx"),
        db.from("client_followups").select("resident_id, due_date, done_at").is("done_at", null).lt("due_date", t),
        db.from("client_interactions").select("resident_id, happened_at").order("happened_at", { ascending: false }),
        db.from("client_feedback").select("resident_id, rating, kind"),
      ]);
      setMembers((m.data as Member[]) ?? []);
      setResidents(((r.data as Res[]) ?? []).filter((x) => !x.archived_at));
      setContracts((c.data as Contract[]) ?? []);
      const overdue: Record<string, number> = {};
      ((f.data as { resident_id: string }[]) ?? []).forEach((x) => (overdue[x.resident_id] = (overdue[x.resident_id] ?? 0) + 1));
      const lastContact: Record<string, string> = {};
      ((i.data as { resident_id: string; happened_at: string }[]) ?? []).forEach((x) => (lastContact[x.resident_id] ??= x.happened_at));
      const complaints: Record<string, number> = {};
      const rating: Record<string, number[]> = {};
      ((fb.data as { resident_id: string; rating: number; kind: string }[]) ?? []).forEach((x) => {
        (rating[x.resident_id] ??= []).push(x.rating);
        if (x.kind === "complaint") complaints[x.resident_id] = (complaints[x.resident_id] ?? 0) + 1;
      });
      setHealth({ overdue, complaints, lastContact, rating });
    })();
  }, []);

  const nameOf = (uid: string | null) => members.find((x) => x.user_id === uid)?.display_name ?? "no handler";
  const clientName = (rid: string) => residents.find((r) => r.id === rid)?.name ?? "—";

  const renewals = useMemo(
    () =>
      contracts
        .filter((c) => c.ends_on && (c.status === "active" || c.status === "renewal_due") && daysTo(c.ends_on) <= 60)
        .sort((a, b) => (a.ends_on! < b.ends_on! ? -1 : 1)),
    [contracts]
  );

  const active = residents.filter((r) => r.status === "Active");
  const board = active
    .map((r) => {
      const last = health.lastContact[r.id];
      const quiet = !last || daysTo(last) < -21;
      const avg = health.rating[r.id]?.length ? health.rating[r.id].reduce((a, b) => a + b, 0) / health.rating[r.id].length : null;
      const risk = (health.overdue[r.id] ?? 0) + (health.complaints[r.id] ?? 0) + (quiet ? 1 : 0) + (avg !== null && avg < 3 ? 1 : 0);
      return { r, last, quiet, avg, risk };
    })
    .sort((a, b) => b.risk - a.risk);

  const head = TITLES[tab] ?? TITLES.overview;

  return (
    <AppShell eyebrow="Client Relations">
      <Seo title="Client Relations — Site 99" description="Client health, contact, follow-ups, renewals and feedback." path="/app/relations" noindex />
      <PageHeader eyebrow="Client Relations" title={head.title} lede={head.lede} />

      {tab === "overview" && (
        <>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-12">
            <Metric label="Active clients" value={String(active.length)} />
            <Metric label="Need attention" value={String(board.filter((b) => b.risk > 0).length)} />
            <Metric label="Overdue follow-ups" value={String(Object.values(health.overdue).reduce((a, b) => a + b, 0))} />
            <Metric label="Renewals in 60 days" value={String(renewals.length)} />
          </div>
          <SectionHeading index="01" title="Client health" hint="most at risk first" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {board.map(({ r, last, quiet, avg, risk }) => (
              <Link key={r.id} to={`/app/residents/${r.id}`} className="press surface rounded-2xl p-4 focus-ring hover:bg-paper-raised">
                <div className="flex items-center gap-2">
                  <span className="display text-base truncate flex-1">{r.name}</span>
                  <StatusChip value={risk === 0 ? "healthy" : risk === 1 ? "watch" : "at risk"} tone={risk === 0 ? "teal" : risk === 1 ? "amber" : "stop"} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-1 text-[11px] text-ink-soft">
                  <span>{nameOf(r.handler_user_id)}</span>
                  <span className={quiet ? "text-signal" : ""}>{last ? `last contact ${day(last)}` : "never contacted"}</span>
                  <span>{health.overdue[r.id] ? `${health.overdue[r.id]} overdue` : "no overdue"}</span>
                  <span>{avg !== null ? `rating ${avg.toFixed(1)}` : "no rating"}</span>
                </div>
              </Link>
            ))}
            {board.length === 0 && <p className="text-sm text-ink-soft">No active clients.</p>}
          </div>
          <div className="mt-14">
            <RelationsPanel members={members} residents={residents} view="followups" />
          </div>
        </>
      )}

      {tab === "renewals" && (
        <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule">
          {renewals.map((c) => {
            const d = daysTo(c.ends_on!);
            return (
              <li key={c.id} className="px-5 py-4 flex items-center gap-3 flex-wrap">
                <Link to={`/app/residents/${c.resident_id}`} className="display text-base underline-offset-4 hover:underline">{clientName(c.resident_id)}</Link>
                <span className="text-sm text-ink-soft">{c.title}</span>
                <StatusChip value={d < 0 ? "ended" : `${d} days left`} tone={d <= 14 ? "stop" : "amber"} />
                <span className="ml-auto text-[11px] text-ink-faint num">ends {day(c.ends_on!)}{c.value_ugx ? ` · UGX ${c.value_ugx.toLocaleString()}` : ""}</span>
              </li>
            );
          })}
          {renewals.length === 0 && <li className="px-5 py-4 text-sm text-ink-soft">No contracts end in the next 60 days.</li>}
        </ul>
      )}

      {tab === "onboarding" && <PortalAccessPanel index="01" showOnboarding />}

      {(tab === "log" || tab === "followups" || tab === "feedback") && (
        <RelationsPanel members={members} residents={residents} view={tab as RelationsView} />
      )}
    </AppShell>
  );
}

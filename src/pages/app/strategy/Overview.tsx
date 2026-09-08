import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import StrategyPage from "@/components/strategy/StrategyPage";
import { Metric, SectionHeading, StatusChip, SearchInput, FilterBar } from "@/components/system";
import { todayISO } from "@/lib/deck";
import {
  REVIEW_LABEL,
  REVIEW_TONE,
  monthOf,
  monthLabel,
  reviewState,
  type Goal,
  type Target,
} from "@/lib/strategy";
import { ArrowUpRight } from "lucide-react";

type Resident = { id: string; name: string; handler_user_id: string | null; contact_user_id: string | null; status: string };
type Plan = { resident_id: string; review_state: string; owner_user_id: string | null; updated_at: string };
type MapRow = { resident_id: string; review_state: string; updated_at: string };
type Member = { user_id: string; display_name: string | null; email: string };

export default function StrategyOverview() {
  const today = todayISO();
  const month = monthOf(today);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [maps, setMaps] = useState<MapRow[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    (async () => {
      const [r, p, g, t, m, tm] = await Promise.all([
        supabase.from("residents").select("id, name, handler_user_id, contact_user_id, status").order("name"),
        supabase.from("client_plans").select("resident_id, review_state, owner_user_id, updated_at"),
        supabase.from("client_goals").select("*"),
        supabase.from("client_targets").select("*").eq("month", month),
        supabase.from("strategy_maps").select("resident_id, review_state, updated_at"),
        supabase.from("team_members").select("user_id, display_name, email"),
      ]);
      setResidents((r.data as Resident[]) ?? []);
      setPlans((p.data as Plan[]) ?? []);
      setGoals((g.data as unknown as Goal[]) ?? []);
      setTargets((t.data as unknown as Target[]) ?? []);
      setMaps((m.data as MapRow[]) ?? []);
      setMembers((tm.data as Member[]) ?? []);
      setLoading(false);
    })();
  }, [month]);

  const nameOf = (uid: string | null) => {
    if (!uid) return "Unassigned";
    const m = members.find((x) => x.user_id === uid);
    return m?.display_name || m?.email || "Unknown";
  };

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return residents
      .filter((r) => !needle || r.name.toLowerCase().includes(needle))
      .map((r) => {
        const plan = plans.find((p) => p.resident_id === r.id) ?? null;
        const mine = goals.filter((g) => g.resident_id === r.id);
        const live = mine.filter((g) => g.status === "active");
        const overdue = live.filter((g) => g.due_on && g.due_on < today);
        const mineTargets = targets.filter((t) => t.resident_id === r.id);
        const map = maps.find((m) => m.resident_id === r.id) ?? null;
        const waiting =
          mine.filter((g) => reviewState(g.review_state) === "submitted").length +
          mineTargets.filter((t) => reviewState(t.review_state) === "submitted").length +
          (map && reviewState(map.review_state) === "submitted" ? 1 : 0) +
          (plan && reviewState(plan.review_state) === "submitted" ? 1 : 0);
        const touched = [plan?.updated_at, map?.updated_at].filter(Boolean).sort().pop() ?? null;
        return {
          resident: r,
          plan,
          owner: plan?.owner_user_id ?? r.handler_user_id ?? r.contact_user_id ?? null,
          live: live.length,
          overdue: overdue.length,
          targets: mineTargets.length,
          approvedTargets: mineTargets.filter((t) => reviewState(t.review_state) === "approved").length,
          hasMap: !!map,
          waiting,
          touched,
        };
      });
  }, [residents, plans, goals, targets, maps, q, today]);

  const totals = {
    plans: rows.filter((r) => reviewState(r.plan?.review_state) === "approved").length,
    waiting: rows.reduce((t, r) => t + r.waiting, 0),
    overdue: rows.reduce((t, r) => t + r.overdue, 0),
    maps: rows.filter((r) => r.hasMap).length,
  };

  return (
    <StrategyPage
      title="Strategy."
      lede="Every client's plan in one place: who owns it, whether it is signed off, and what is off track."
      path="/app/strategy"
    >
      {loading ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-10">
            <Metric label="Plans approved" value={`${totals.plans}/${rows.length}`} />
            <Metric label="Waiting on a founder" value={String(totals.waiting)} />
            <Metric label="Goals past their date" value={String(totals.overdue)} />
            <Metric label="Clients with a map" value={`${totals.maps}/${rows.length}`} />
          </div>

          <SectionHeading index="01" title="Clients" hint={`Targets shown for ${monthLabel(month)}`} />
          <FilterBar>
            <SearchInput value={q} onChange={setQ} placeholder="Find a client" />
          </FilterBar>

          <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule mt-4">
            {rows.map((row) => {
              const state = reviewState(row.plan?.review_state);
              return (
                <li key={row.resident.id} className="px-5 py-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Link
                      to={`/app/residents/${row.resident.id}/strategy`}
                      className="press focus-ring text-sm font-semibold inline-flex items-center gap-1.5"
                    >
                      {row.resident.name}
                      <ArrowUpRight className="h-3.5 w-3.5 text-ink-faint" />
                    </Link>
                    <StatusChip value={REVIEW_LABEL[state]} tone={REVIEW_TONE[state]} />
                    {row.waiting > 0 && <StatusChip value={`${row.waiting} waiting`} tone="amber" />}
                    {row.overdue > 0 && <StatusChip value={`${row.overdue} past date`} tone="stop" />}
                    {!row.hasMap && <StatusChip value="No map yet" tone="neutral" />}
                    <span className="text-[11px] text-ink-faint ml-auto">Owner: {nameOf(row.owner)}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-4 flex-wrap text-[11px] text-ink-faint num">
                    <span>{row.live} live goals</span>
                    <span>
                      {row.approvedTargets}/{row.targets} targets approved
                    </span>
                    {row.touched && <span>last touched {row.touched.slice(0, 10)}</span>}
                    <Link to={`/app/strategy/map?client=${row.resident.id}`} className="press focus-ring text-ink-soft hover:text-ink">
                      Open map
                    </Link>
                    <Link to={`/app/strategy/goals?client=${row.resident.id}`} className="press focus-ring text-ink-soft hover:text-ink">
                      Goals & targets
                    </Link>
                  </div>
                </li>
              );
            })}
            {rows.length === 0 && <li className="px-5 py-6 text-sm text-ink-soft">No clients match that.</li>}
          </ul>
        </>
      )}
    </StrategyPage>
  );
}

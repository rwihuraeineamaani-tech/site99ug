import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePortalClient } from "@/hooks/usePortalClient";
import PortalPage, { PortalCard, PortalEmpty } from "@/components/portal/PortalPage";
import { Money, StatusChip } from "@/components/system";
import MonthResults from "@/components/clientspace/MonthResults";
import { TARGET_LABEL, loadMonthMetrics, monthStart } from "@/lib/clientMonth";

type Step = { id: string; title: string; status: string; due_on: string | null; department: string | null };
type Shoot = { id: string; shoot_date: string | null; call_time: string | null; location: string | null; status: string };
type Item = { id: string; title: string; stage: string; planned_at: string | null };
type Invoice = { id: string; number: string | null; total_ugx: number | null; amount_paid_ugx: number | null; due_date: string | null; status: string };
type Goal = { id: string; title: string; metric: string | null; start_value: number | null; target_value: number | null; unit: string | null; due_on: string | null };

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Date to confirm";

export default function PortalOverview() {
  const { client, clientId, loading } = usePortalClient();
  const [steps, setSteps] = useState<Step[]>([]);
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [pot, setPot] = useState<number>(0);
  const [targets, setTargets] = useState<{ metric: string; target: number; actual: number | null }[] | null>(null);
  useEffect(() => {
    if (!clientId) return;
    loadMonthMetrics(clientId, monthStart(new Date()))
      .then((m) => setTargets((m.targets ?? []) as { metric: string; target: number; actual: number | null }[]))
      .catch(() => setTargets([]));
  }, [clientId]);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [s, sd, ci, inv, gl, pb] = await Promise.all([
        supabase.from("resident_onboarding_steps").select("id, title, status, due_on, department").eq("resident_id", clientId).order("created_at"),
        supabase.from("shoot_days").select("id, shoot_date, call_time, location, status").eq("resident_id", clientId).gte("shoot_date", today).order("shoot_date").limit(3),
        supabase.from("content_items").select("id, title, stage, planned_at").eq("resident_id", clientId).order("planned_at", { ascending: false }).limit(5),
        supabase.from("invoices").select("id, number, total_ugx, amount_paid_ugx, due_date, status").eq("resident_id", clientId).eq("direction", "out").order("issue_date", { ascending: false }).limit(20),
        supabase.from("client_goals").select("id, title, metric, start_value, target_value, unit, due_on").eq("resident_id", clientId).order("sort").limit(4),
        supabase.rpc("client_pot_balance", { _resident_id: clientId }),
      ]);
      if (cancelled) return;
      setSteps((s.data as Step[]) ?? []);
      setShoots((sd.data as Shoot[]) ?? []);
      setItems((ci.data as Item[]) ?? []);
      setInvoices((inv.data as Invoice[]) ?? []);
      setGoals((gl.data as Goal[]) ?? []);
      setPot(Number(pb.data ?? 0));
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const done = steps.filter((s) => ["done", "complete", "not_needed"].includes(s.status)).length;
  const onboarding = steps.length > 0 && done < steps.length;
  const outstanding = invoices.reduce((t, i) => t + Math.max(0, (i.total_ugx ?? 0) - (i.amount_paid_ugx ?? 0)), 0);
  const nextShoot = shoots[0];

  return (
    <PortalPage
      title="Your engagement"
      lede="Everything Site 99 is doing for you, in one place."
      client={client}
      loading={loading}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {onboarding ? (
          <PortalCard title="Getting started" hint={`${done}/${steps.length}`}>
            <div className="h-1.5 w-full rounded-full bg-hairline">
              <div className="h-1.5 rounded-full bg-signal" style={{ width: `${(done / steps.length) * 100}%` }} />
            </div>
            <div className="mt-2 text-sm text-ink-soft">{`${steps.length - done} step(s) still to finish.`}</div>
          </PortalCard>
        ) : (
          <PortalCard title="This month's targets" hint={targets?.length ? `${targets.length}` : undefined}>
            <Link to="/portal/reports" className="block space-y-2">
              {!targets ? (
                <div className="text-sm text-ink-soft">Loading…</div>
              ) : targets.length === 0 ? (
                <div className="text-sm text-ink-soft">Your targets appear here once your team agrees them.</div>
              ) : (
                targets.slice(0, 3).map((t) => {
                  const pct = t.target ? Math.min(100, Math.round(((t.actual ?? 0) / Number(t.target)) * 100)) : 0;
                  return (
                    <div key={t.metric}>
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span>{TARGET_LABEL[t.metric] ?? t.metric}</span>
                        <span className="tabular-nums text-ink-soft">{(t.actual ?? 0).toLocaleString("en-GB")} of {Number(t.target).toLocaleString("en-GB")}</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-hairline">
                        <div className={`h-1.5 rounded-full ${pct >= 100 ? "bg-acc-lime" : "bg-signal"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })
              )}
            </Link>
          </PortalCard>
        )}

        <PortalCard title="Next shoot day">
          {nextShoot ? (
            <Link to="/portal/shoots" className="block">
              <div className="text-lg">{fmtDate(nextShoot.shoot_date)}</div>
              <div className="text-sm text-ink-soft">
                {nextShoot.call_time ? `Call ${nextShoot.call_time}` : "Call time to confirm"}
                {nextShoot.location ? ` · ${nextShoot.location}` : ""}
              </div>
            </Link>
          ) : (
            <div className="text-sm text-ink-soft">No shoot day booked yet.</div>
          )}
        </PortalCard>

        <PortalCard title="Money you owe">
          <div className="text-lg">
            <Money amount={outstanding} />
          </div>
          <Link to="/portal/money" className="text-sm text-signal">
            See invoices
          </Link>
        </PortalCard>

        <PortalCard title="Your shoot fund">
          <div className="text-lg">
            <Money amount={pot} />
          </div>
          <div className="text-sm text-ink-soft">Money you have put in, less what has been spent.</div>
        </PortalCard>
      </div>

      {clientId && (
        <div className="mt-6">
          <PortalCard title="This month's results" hint="Live">
            <MonthResults residentId={clientId} month={monthStart(new Date())} />
            <Link to="/portal/reports" className="mt-3 inline-block text-sm text-signal">See every video's numbers and past months</Link>
          </PortalCard>
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <PortalCard title="Latest work">
          {items.length === 0 ? (
            <PortalEmpty>No work logged yet.</PortalEmpty>
          ) : (
            <ul className="space-y-2">
              {items.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 rounded-xl border border-hairline px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm">{i.title}</div>
                    <div className="text-xs text-ink-faint">{fmtDate(i.planned_at)}</div>
                  </div>
                  <StatusChip value={i.stage} />
                </li>
              ))}
            </ul>
          )}
          <Link to="/portal/work" className="mt-3 inline-block text-sm text-signal">
            See all work
          </Link>
        </PortalCard>

        <PortalCard title="What we are aiming for">
          {goals.length === 0 ? (
            <PortalEmpty>No goals agreed yet.</PortalEmpty>
          ) : (
            <ul className="space-y-2">
              {goals.map((g) => (
                <li key={g.id} className="rounded-xl border border-hairline px-3 py-2">
                  <div className="text-sm">{g.title}</div>
                  <div className="text-xs text-ink-faint">
                    {g.metric ? `${g.metric}: ` : ""}
                    {g.start_value ?? 0} → {g.target_value ?? 0} {g.unit ?? ""}
                    {g.due_on ? ` · by ${fmtDate(g.due_on)}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </PortalCard>
      </div>

    </PortalPage>
  );
}

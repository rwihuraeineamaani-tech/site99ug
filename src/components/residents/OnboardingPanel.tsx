import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeading, StatusChip } from "@/components/system";
import { useMyRoles } from "@/hooks/useMyRoles";
import PortalAccessPanel from "@/components/residents/PortalAccessPanel";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type Step = { id: string; resident_id: string; step_key: string; title: string; department: string; owner_user_id: string | null; status: string; due_on: string | null; note: string | null; requires_md_approval: boolean; approved_at: string | null; sort: number };
type Member = { user_id: string; display_name: string | null; email: string };

const LINKS: Record<string, (id: string) => string> = {
  legal: () => "/app/legal/contracts",
  brand: (id) => `/app/residents/${id}`,
  strategy: () => "/app/strategy",
  content_plan: () => "/app/content",
  first_invoice: () => "/app/finance/invoices",
};
const done = (s: Step) => s.status === "complete" || s.status === "not_needed";
const today = () => new Date().toISOString().slice(0, 10);

export function useOnboardingPowers() {
  const { has } = useMyRoles();
  return {
    canRun: has("admin", "founder", "managing_director", "operations_manager", "communications", "client_relations"),
    canApprove: has("admin", "founder", "managing_director"),
  };
}

/** The 9-step checklist for one client. */
export default function OnboardingPanel({ residentId, index = "01" }: { residentId: string; index?: string }) {
  const { canRun, canApprove } = useOnboardingPowers();
  const [steps, setSteps] = useState<Step[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  const load = async () => {
    const [s, m] = await Promise.all([
      db.from("resident_onboarding_steps").select("*").eq("resident_id", residentId).order("sort"),
      supabase.from("team_members").select("user_id, display_name, email"),
    ]);
    setSteps(s.data ?? []);
    setMembers((m.data as Member[]) ?? []);
  };
  useEffect(() => { load(); }, [residentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (p: PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    const { error } = await p;
    if (error) return toast.error(error.message);
    toast.success(ok);
    load();
  };
  const start = (established: boolean) => run(db.rpc("start_resident_onboarding", { _id: residentId, _established: established }), established ? "Checklist added — only the MD's sign-offs are left" : "Onboarding started");

  const count = steps.filter(done).length;
  return (
    <section>
      <SectionHeading index={index} title="Onboarding" hint={steps.length ? `${count} of ${steps.length} complete` : "not started"} />
      {!steps.length ? (
        <div className="surface rounded-2xl p-6 text-sm text-ink-soft">
          <p>This client has no onboarding checklist yet.</p>
          {canRun ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="ctl ctl-solid eyebrow px-4 py-2 focus-ring" onClick={() => start(false)}>start onboarding</button>
              <button className="ctl eyebrow px-4 py-2 focus-ring" onClick={() => start(true)}>already onboarded</button>
            </div>
          ) : <p className="mt-2 text-xs">Communications starts onboarding for new clients.</p>}
          <p className="mt-3 text-[11px] text-ink-faint">"Already onboarded" is for established clients: it ticks off the routine steps and leaves the contract and handover for the MD to sign off.</p>
        </div>
      ) : (
        <ol className="surface rounded-2xl divide-y divide-rule">
          {steps.map((s, i) => {
            const late = !done(s) && s.due_on && s.due_on < today();
            const waitingMd = s.requires_md_approval && !s.approved_at;
            const link = LINKS[s.step_key]?.(residentId);
            return (
              <li key={s.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="num text-xs text-ink-faint w-5">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{s.title}</div>
                    <div className="text-[11px] text-ink-faint">{s.department}{s.requires_md_approval ? " · needs MD sign-off" : ""}{s.note ? ` · ${s.note}` : ""}</div>
                  </div>
                  <StatusChip value={done(s) ? (s.approved_at ? "signed off" : "complete") : waitingMd && s.status === "ready" ? "waiting for MD" : late ? "overdue" : s.status.replace("_", " ")} tone={done(s) ? "teal" : late ? "stop" : waitingMd && s.status === "ready" ? "amber" : "pending"} />
                </div>
                {!done(s) && (
                  <div className="mt-3 ml-8 flex flex-wrap items-center gap-2 text-xs">
                    {canRun && (
                      <>
                        <select className="field text-xs w-44" value={s.owner_user_id ?? ""} onChange={(e) => run(db.from("resident_onboarding_steps").update({ owner_user_id: e.target.value || null }).eq("id", s.id), "Owner changed")}>
                          <option value="">no owner</option>
                          {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.display_name ?? m.email}</option>)}
                        </select>
                        <input type="date" className="field text-xs w-40" value={s.due_on ?? ""} onChange={(e) => run(db.from("resident_onboarding_steps").update({ due_on: e.target.value || null }).eq("id", s.id), "Due date changed")} />
                      </>
                    )}
                    {link && <Link to={link} className="underline underline-offset-4 text-ink-faint hover:text-ink">open</Link>}
                    {canRun && !s.requires_md_approval && s.step_key !== "portal" && (
                      <button className="ctl ctl-solid eyebrow px-3 py-1.5" onClick={() => run(db.from("resident_onboarding_steps").update({ status: "complete", completed_at: new Date().toISOString() }).eq("id", s.id), "Step complete")}>mark complete</button>
                    )}
                    {canRun && s.requires_md_approval && s.status !== "ready" && (
                      <button className="ctl ctl-solid eyebrow px-3 py-1.5" onClick={() => run(db.from("resident_onboarding_steps").update({ status: "ready" }).eq("id", s.id), "Sent to the MD for sign-off")}>send to MD</button>
                    )}
                    {canApprove && s.requires_md_approval && (
                      <button className="ctl ctl-solid eyebrow px-3 py-1.5" onClick={() => run(db.rpc("approve_onboarding_step", { _step_id: s.id }), "Signed off")}>sign off</button>
                    )}
                    {canRun && !s.requires_md_approval && <button className="text-ink-faint underline" onClick={() => run(db.from("resident_onboarding_steps").update({ status: "not_needed" }).eq("id", s.id), "Marked not needed")}>not needed</button>}
                  </div>
                )}
                {s.step_key === "portal" && !done(s) && canRun && (
                  <div className="mt-4 ml-8"><PortalAccessPanel residentId={residentId} index="→" /></div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/** Communications' board: every client's onboarding progress, overdue steps and MD sign-offs. */
export function OnboardingBoard() {
  const { canApprove } = useOnboardingPowers();
  const [steps, setSteps] = useState<Step[]>([]);
  const [residents, setResidents] = useState<{ id: string; name: string; status: string | null; archived_at: string | null }[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [s, r] = await Promise.all([
        db.from("resident_onboarding_steps").select("*").order("sort"),
        db.from("residents").select("id, name, status, archived_at").order("name"),
      ]);
      setSteps(s.data ?? []);
      setResidents(((r.data ?? []) as { archived_at: string | null }[]).filter((x) => !x.archived_at) as typeof residents);
    })();
  }, [open]);

  const rows = residents.map((r) => {
    const mine = steps.filter((s) => s.resident_id === r.id);
    return {
      r, total: mine.length, complete: mine.filter(done).length,
      overdue: mine.filter((s) => !done(s) && s.due_on && s.due_on < today()).length,
      md: mine.filter((s) => s.requires_md_approval && !s.approved_at && s.status === "ready").length,
    };
  }).sort((a, b) => (b.md + b.overdue) - (a.md + a.overdue) || (a.total && a.complete === a.total ? 1 : 0) - (b.total && b.complete === b.total ? 1 : 0));
  const waiting = rows.reduce((a, x) => a + x.md, 0);

  return (
    <section>
      <SectionHeading index="02" title="Onboarding board" hint={`${waiting} waiting for the MD · ${rows.reduce((a, x) => a + x.overdue, 0)} overdue`} />
      {canApprove && waiting > 0 && <p className="mb-4 text-sm text-signal">You have {waiting} onboarding step{waiting > 1 ? "s" : ""} waiting for your sign-off.</p>}
      <ul className="surface rounded-2xl divide-y divide-rule">
        {rows.map(({ r, total, complete, overdue, md }) => (
          <li key={r.id} className="px-5 py-4">
            <button className="w-full flex flex-wrap items-center gap-3 text-left" onClick={() => setOpen(open === r.id ? null : r.id)}>
              <span className="display text-base">{r.name}</span>
              {r.status && <StatusChip value={r.status} />}
              <span className="text-[11px] text-ink-faint">{total ? `${complete} of ${total} steps` : "not started"}</span>
              {overdue > 0 && <StatusChip value={`${overdue} overdue`} tone="stop" />}
              {md > 0 && <StatusChip value="waiting for MD" tone="amber" />}
              {total > 0 && complete === total && <StatusChip value="onboarded" tone="teal" />}
              <span className="ml-auto h-1.5 w-28 rounded-full bg-rule overflow-hidden"><span className="block h-full bg-signal" style={{ width: `${total ? (complete / total) * 100 : 0}%` }} /></span>
            </button>
            {open === r.id && <div className="mt-5"><OnboardingPanel residentId={r.id} index="→" /></div>}
          </li>
        ))}
      </ul>
    </section>
  );
}

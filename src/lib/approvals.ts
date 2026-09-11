/**
 * Everything across the business that is waiting for somebody to sign it off.
 * One shape for every kind of approval, so a single page can show them all.
 */
import { supabase } from "@/integrations/supabase/client";
import { REVIEW_KIND_LABEL, setReview, type ReviewTable } from "@/lib/strategy";
import { decideRuntimeTask, loadRuntimeTasks } from "@/lib/adminWorkflows";

export type ApprovalKind =
  | "cash_request"
  | "payment_line"
  | "loan"
  | "strategy"
  | "content"
  | "workflow";

export const KIND_LABEL: Record<ApprovalKind, string> = {
  cash_request: "Cash request",
  payment_line: "Payment",
  loan: "Loan",
  strategy: "Strategy",
  content: "Content",
  workflow: "Workflow",
};

export type ApprovalAction = {
  label: string;
  /** a note or reason is asked for first */
  ask?: string;
  ghost?: boolean;
  run: (note?: string) => Promise<void>;
};

export type ApprovalItem = {
  id: string;
  kind: ApprovalKind;
  /** what has to be done, in plain words */
  move: string;
  title: string;
  detail?: string | null;
  amount?: number | null;
  /** who this is about — person or client */
  who?: string | null;
  /** who has to act, e.g. "Managing Director" */
  waitingOn: string;
  /** true when the signed-in person is the one holding it up */
  mine: boolean;
  since: string | null;
  to: string;
  actions: ApprovalAction[];
};

export type DecidedItem = {
  id: string;
  kind: ApprovalKind;
  title: string;
  outcome: string;
  tone: "lime" | "stop" | "neutral";
  when: string | null;
};

export type ApprovalContext = {
  userId: string | null;
  isFounder: boolean;
  isMd: boolean;
  canApproveStrategy: boolean;
  canSeeFinance: boolean;
};

const nameMap = (rows: { user_id: string; display_name: string | null; email: string | null }[]) => {
  const m: Record<string, string> = {};
  rows.forEach((r) => (m[r.user_id] = r.display_name || r.email || "Team member"));
  return m;
};

export async function loadApprovals(ctx: ApprovalContext): Promise<{ items: ApprovalItem[]; decided: DecidedItem[] }> {
  const [team, residents, requests, lines, runs, loans, content, goals, targets, maps, plans, versions, runtime] =
    await Promise.all([
      supabase.from("team_members").select("user_id, display_name, email"),
      supabase.from("residents").select("id, name"),
      supabase.from("cash_requests").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("payment_run_lines").select("*").eq("status", "pending"),
      supabase.from("payment_runs").select("id, month, status"),
      supabase.from("loans").select("*").order("created_at", { ascending: false }).limit(100),
      supabase
        .from("content_items")
        .select("id, ref_no, title, stage, resident_id, updated_at")
        .in("stage", ["Idea", "Review"]),
      supabase.from("client_goals").select("id, resident_id, title, review_state, submitted_at, review_note"),
      supabase.from("client_targets").select("id, resident_id, metric, month, review_state, submitted_at, review_note"),
      supabase.from("strategy_maps").select("id, resident_id, title, version, review_state, submitted_at, review_note"),
      supabase.from("client_plans").select("id, resident_id, review_state, submitted_at, review_note"),
      supabase.from("strategy_map_versions").select("id, resident_id, version, review_state, submitted_at, review_note"),
      loadRuntimeTasks(),
    ]);

  const people = nameMap((team.data ?? []) as { user_id: string; display_name: string | null; email: string | null }[]);
  const clients: Record<string, string> = {};
  ((residents.data ?? []) as { id: string; name: string }[]).forEach((r) => (clients[r.id] = r.name));
  const runMonth: Record<string, string> = {};
  ((runs.data ?? []) as { id: string; month: string }[]).forEach((r) => (runMonth[r.id] = r.month));

  const items: ApprovalItem[] = [];
  const decided: DecidedItem[] = [];
  const runtimeEntities = new Set(runtime.map((t) => {
    const i = t.approval_instances;
    return i ? `${i.entity_type}:${i.entity_id}` : "";
  }));

  runtime.forEach((t) => {
    const i = t.approval_instances;
    if (!i) return;
    const mine = t.assigned_user_id === ctx.userId || Boolean(t.assigned_role && i.requester_id !== ctx.userId);
    items.push({
      id: `workflow-${t.id}`,
      kind: "workflow",
      move: t.node_label,
      title: i.title,
      detail: i.detail,
      amount: i.amount,
      waitingOn: t.assigned_role ? String(t.assigned_role).replace(/_/g, " ") : "assigned person",
      mine,
      since: t.created_at,
      to: "/app/approvals",
      actions: mine ? [
        { label: "Approve", run: () => decideRuntimeTask(t.id, "approved") },
        { label: "Send back", ghost: true, ask: "What should change?", run: (note) => decideRuntimeTask(t.id, "changes_requested", note) },
        { label: "Reject", ghost: true, ask: "Why is this being rejected?", run: (note) => decideRuntimeTask(t.id, "rejected", note) },
      ] : [],
    });
  });

  /* ---------- money asked for ---------- */
  type Req = {
    id: string;
    requester: string;
    amount_ugx: number;
    purpose: string;
    status: string;
    created_at: string;
    updated_at: string | null;
    resident_id: string | null;
  };
  ((requests.data ?? []) as unknown as Req[]).forEach((r) => {
    if (runtimeEntities.has(`cash_request:${r.id}`)) return;
    const mineToDecide =
      r.requester !== ctx.userId &&
      ((r.status === "submitted" && ctx.isMd) || (r.status === "md_approved" && ctx.isFounder));
    if (r.status === "submitted" || r.status === "md_approved") {
      items.push({
        id: `cash-${r.id}`,
        kind: "cash_request",
        move: r.status === "submitted" ? "Approve or decline this request" : "Second sign-off needed",
        title: r.purpose,
        detail: `Asked by ${people[r.requester] ?? "a team member"}`,
        amount: r.amount_ugx,
        who: r.resident_id ? clients[r.resident_id] : null,
        waitingOn: r.status === "submitted" ? "Managing Director" : "Founder",
        mine: mineToDecide,
        since: r.created_at,
        to: "/app/finance/requests",
        actions: mineToDecide
          ? [
              {
                label: "Approve",
                run: async () => {
                  const { error } = await supabase.rpc("approve_cash_request", { _id: r.id });
                  if (error) throw error;
                },
              },
              {
                label: "Decline",
                ghost: true,
                ask: "Why is this being declined?",
                run: async (note) => {
                  const { error } = await supabase.rpc("decline_cash_request", { _id: r.id, _reason: note ?? "" });
                  if (error) throw error;
                },
              },
            ]
          : [],
      });
    } else if (["approved", "declined", "paid"].includes(r.status)) {
      decided.push({
        id: `cash-${r.id}`,
        kind: "cash_request",
        title: r.purpose,
        outcome: r.status === "declined" ? "Declined" : r.status === "paid" ? "Paid" : "Approved",
        tone: r.status === "declined" ? "stop" : "lime",
        when: r.updated_at ?? r.created_at,
      });
    }
  });

  /* ---------- monthly payment lines ---------- */
  type Line = { id: string; run_id: string; payee_name: string; amount_ugx: number; created_at: string; note: string | null };
  ((lines.data ?? []) as unknown as Line[]).forEach((l) => {
    items.push({
      id: `line-${l.id}`,
      kind: "payment_line",
      move: "Clear this payment or put it on hold",
      title: l.payee_name,
      detail: runMonth[l.run_id] ? `Monthly run · ${runMonth[l.run_id].slice(0, 7)}` : "Monthly run",
      amount: l.amount_ugx,
      who: null,
      waitingOn: "Founder",
      mine: ctx.isFounder,
      since: l.created_at,
      to: "/app/finance/monthly",
      actions: ctx.isFounder
        ? [
            {
              label: "Clear",
              run: async () => {
                const { error } = await supabase.rpc("approve_payment_run", { _run_id: l.run_id, _line_ids: [l.id] });
                if (error) throw error;
              },
            },
            {
              label: "Hold",
              ghost: true,
              run: async () => {
                const { error } = await supabase.rpc("hold_payment_line", { _line_id: l.id });
                if (error) throw error;
              },
            },
          ]
        : [],
    });
  });

  /* ---------- loans ---------- */
  type Loan = {
    id: string;
    counterparty_name: string;
    principal_ugx: number;
    status: string;
    purpose: string | null;
    created_at: string;
    direction: string;
  };
  ((loans.data ?? []) as unknown as Loan[]).forEach((l) => {
    if (runtimeEntities.has(`loan:${l.id}`)) return;
    if (l.status !== "pending_approval") return;
    items.push({
      id: `loan-${l.id}`,
      kind: "loan",
      move: "Approve this loan",
      title: `${l.direction === "out" ? "Lending to" : "Borrowing from"} ${l.counterparty_name}`,
      detail: l.purpose,
      amount: l.principal_ugx,
      who: null,
      waitingOn: "Founder",
      mine: ctx.isFounder,
      since: l.created_at,
      to: "/app/finance/loans",
      actions: ctx.isFounder
        ? [
            {
              label: "Approve",
              run: async () => {
                const { error } = await supabase.from("loans").update({ status: "active" }).eq("id", l.id);
                if (error) throw error;
              },
            },
          ]
        : [],
    });
  });

  /* ---------- content sign-off ---------- */
  type Item = { id: string; ref_no: number; title: string; stage: string; resident_id: string | null; updated_at: string };
  ((content.data ?? []) as unknown as Item[]).forEach((c) => {
    if (runtimeEntities.has(`content_item:${c.id}`)) return;
    const next = c.stage === "Idea" ? "Approved" : "Handover";
    items.push({
      id: `content-${c.id}`,
      kind: "content",
      move: c.stage === "Idea" ? "Approve this idea" : "Sign off the edit",
      title: c.title,
      detail: `SITE-${String(c.ref_no).padStart(4, "0")} · ${c.stage}`,
      who: c.resident_id ? clients[c.resident_id] : null,
      waitingOn: "Founder",
      mine: ctx.isFounder,
      since: c.updated_at,
      to: "/app/content",
      actions: ctx.isFounder
        ? [
            {
              label: c.stage === "Idea" ? "Approve" : "Sign off",
              run: async () => {
                const { error } = await supabase.from("content_items").update({ stage: next }).eq("id", c.id);
                if (error) throw error;
              },
            },
            {
              label: "Reject",
              ghost: true,
              run: async () => {
                const { error } = await supabase.from("content_items").update({ stage: "Rejected" }).eq("id", c.id);
                if (error) throw error;
              },
            },
          ]
        : [],
    });
  });

  /* ---------- strategy ---------- */
  const pushStrategy = (table: ReviewTable, row: Record<string, unknown>, what: string) => {
    if (runtimeEntities.has(`${table}:${row.id}`)) return;
    const state = String(row.review_state ?? "draft");
    const rid = (row.resident_id as string) ?? null;
    if (state === "submitted") {
      items.push({
        id: `${table}-${row.id}`,
        kind: "strategy",
        move: `Approve ${REVIEW_KIND_LABEL[table].toLowerCase()}`,
        title: what,
        detail: REVIEW_KIND_LABEL[table],
        who: rid ? clients[rid] : null,
        waitingOn: "Founder",
        mine: ctx.canApproveStrategy,
        since: (row.submitted_at as string) ?? null,
        to: rid ? `/app/residents/${rid}/strategy` : "/app/strategy/approvals",
        actions: ctx.canApproveStrategy
          ? [
              {
                label: "Approve",
                run: async () => {
                  await setReview(table, String(row.id), "approved", null);
                },
              },
              {
                label: "Send back",
                ghost: true,
                ask: "What should change?",
                run: async (note) => {
                  await setReview(table, String(row.id), "changes_requested", note ?? null);
                },
              },
            ]
          : [],
      });
    } else if (state === "approved" || state === "changes_requested") {
      decided.push({
        id: `${table}-${row.id}`,
        kind: "strategy",
        title: what,
        outcome: state === "approved" ? "Approved" : "Sent back",
        tone: state === "approved" ? "lime" : "stop",
        when: (row.submitted_at as string) ?? null,
      });
    }
  };

  ((goals.data ?? []) as Record<string, unknown>[]).forEach((g) => pushStrategy("client_goals", g, String(g.title)));
  ((targets.data ?? []) as Record<string, unknown>[]).forEach((t) =>
    pushStrategy("client_targets", t, `${t.metric} · ${String(t.month).slice(0, 7)}`)
  );
  ((maps.data ?? []) as Record<string, unknown>[]).forEach((m) =>
    pushStrategy("strategy_maps", m, `${m.title} (v${m.version})`)
  );
  ((plans.data ?? []) as Record<string, unknown>[]).forEach((p) => pushStrategy("client_plans", p, "Whole client plan"));
  ((versions.data ?? []) as Record<string, unknown>[]).forEach((v) =>
    pushStrategy("strategy_map_versions", v, `Map version ${v.version}`)
  );

  items.sort((a, b) => (a.since ?? "").localeCompare(b.since ?? ""));
  decided.sort((a, b) => (b.when ?? "").localeCompare(a.when ?? ""));

  return { items, decided: decided.slice(0, 15) };
}

/** How long something has been sitting, in plain words. */
export function waitingFor(since: string | null): string {
  if (!since) return "just now";
  const days = Math.floor((Date.now() - Date.parse(since)) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

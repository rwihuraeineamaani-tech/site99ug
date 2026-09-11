import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/hooks/useMyRoles";

export type WorkflowNodeKind = "start" | "review" | "approval" | "condition" | "parallel" | "notification" | "escalation" | "end";
export type WorkflowNodeConfig = {
  role?: AppRole;
  user_id?: string;
  sla_hours?: number;
  exclude_requester?: boolean;
  distinct_actor?: boolean;
  quorum?: "any" | "all";
  field?: string;
  operator?: "equals" | "not_equals" | "greater_than" | "less_than" | "contains";
  value?: string;
};
export type WorkflowNode = { id: string; kind: WorkflowNodeKind; label: string; x: number; y: number; config?: WorkflowNodeConfig };
export type WorkflowEdge = { id: string; source: string; target: string; label?: string; route?: string };
export type Workflow = {
  id: string; workflow_key: string; name: string; department: string; description: string | null;
  entity_type: string; active: boolean; current_version_id: string | null; updated_at: string;
};
export type WorkflowVersion = {
  id: string; workflow_id: string; version: number; state: "draft" | "published" | "retired";
  nodes: WorkflowNode[]; edges: WorkflowEdge[]; notes: string | null; validation: Record<string, unknown>;
  created_at: string; published_at: string | null;
};
export type Responsibility = {
  id: string; department: string; work_key: string; name: string; description: string | null;
  primary_user_id: string | null; primary_role: AppRole | null; backup_user_ids: string[];
  backup_roles: AppRole[]; approval_authority: boolean; active: boolean; updated_at: string;
};
export type WorkflowAudit = { id: string; event_type: string; summary: string; detail: Record<string, unknown>; actor_id: string | null; created_at: string };
export type RuntimeTask = {
  id: string; node_label: string; status: string; due_at: string | null; created_at: string;
  assigned_user_id: string | null; assigned_role: AppRole | null;
  approval_instances: { id: string; title: string; detail: string | null; amount: number | null; entity_type: string; entity_id: string; status: string; requester_id: string; created_at: string } | null;
};

export const WORKFLOW_KINDS: { key: WorkflowNodeKind; label: string; tone: string }[] = [
  { key: "start", label: "Start", tone: "hsl(var(--acc-teal))" },
  { key: "review", label: "Review", tone: "hsl(var(--acc-blue))" },
  { key: "approval", label: "Approval", tone: "hsl(var(--signal))" },
  { key: "condition", label: "Condition", tone: "hsl(var(--acc-amber))" },
  { key: "parallel", label: "Parallel", tone: "hsl(var(--acc-violet))" },
  { key: "notification", label: "Notify", tone: "hsl(var(--acc-pink))" },
  { key: "escalation", label: "Escalate", tone: "hsl(var(--state-warn))" },
  { key: "end", label: "End", tone: "hsl(var(--acc-lime))" },
];

export const DEFAULT_TEMPLATES: Record<string, { nodes: WorkflowNode[]; edges: WorkflowEdge[] }> = {
  finance: chainTemplate(["Finance check", "Managing Director", "Founder sign-off"], ["finance_ops", "managing_director", "founder"]),
  content: chainTemplate(["Creative review", "Founder sign-off"], ["creative_director", "founder"]),
  strategy: chainTemplate(["Strategy review", "Founder approval"], ["strategist", "founder"]),
  legal: chainTemplate(["Legal review", "Managing Director", "Founder signature"], ["legal", "managing_director", "founder"]),
};

function chainTemplate(labels: string[], roles: AppRole[]) {
  const nodes: WorkflowNode[] = [{ id: "start", kind: "start", label: "Submitted", x: 40, y: 170 }];
  labels.forEach((label, index) => nodes.push({
    id: `step-${index + 1}`, kind: index === 0 ? "review" : "approval", label,
    x: 280 + index * 250, y: 170,
    config: { role: roles[index], sla_hours: 24, exclude_requester: true, distinct_actor: index > 0 },
  }));
  nodes.push({ id: "end", kind: "end", label: "Approved", x: 280 + labels.length * 250, y: 170 });
  return { nodes, edges: nodes.slice(0, -1).map((n, i) => ({ id: `edge-${i + 1}`, source: n.id, target: nodes[i + 1].id, route: "approved" })) };
}

export function validateWorkflow(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
  const errors: string[] = [];
  const starts = nodes.filter((n) => n.kind === "start");
  const ends = nodes.filter((n) => n.kind === "end");
  if (starts.length !== 1) errors.push("Use exactly one Start step.");
  if (!ends.length) errors.push("Add at least one End step.");
  const ids = new Set(nodes.map((n) => n.id));
  edges.forEach((e) => { if (!ids.has(e.source) || !ids.has(e.target)) errors.push("A connection points to a missing step."); });
  nodes.filter((n) => !["start", "end", "condition", "notification"].includes(n.kind)).forEach((n) => {
    if (!n.config?.role && !n.config?.user_id) errors.push(`${n.label} needs an approver.`);
  });
  if (starts[0] && !edges.some((e) => e.source === starts[0].id)) errors.push("Start is not connected.");
  nodes.filter((n) => n.kind !== "end").forEach((n) => { if (!edges.some((e) => e.source === n.id)) errors.push(`${n.label} has no next step.`); });
  return [...new Set(errors)];
}

export async function loadAdminWorkflows() {
  const [workflows, versions, responsibilities, audit, team, delegations] = await Promise.all([
    supabase.from("approval_workflows").select("*").order("department").order("name"),
    supabase.from("approval_workflow_versions").select("*").order("version", { ascending: false }),
    supabase.from("responsibility_assignments").select("*").order("department").order("name"),
    supabase.from("approval_audit").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("team_members").select("user_id, display_name, email, title").order("display_name"),
    supabase.from("approval_delegations").select("*").order("starts_at", { ascending: false }),
  ]);
  const error = workflows.error || versions.error || responsibilities.error || audit.error || team.error || delegations.error;
  if (error) throw error;
  return {
    workflows: (workflows.data ?? []) as unknown as Workflow[], versions: (versions.data ?? []) as unknown as WorkflowVersion[],
    responsibilities: (responsibilities.data ?? []) as unknown as Responsibility[], audit: (audit.data ?? []) as unknown as WorkflowAudit[],
    team: (team.data ?? []) as { user_id: string; display_name: string | null; email: string | null; title: string | null }[],
    delegations: (delegations.data ?? []) as unknown as { id: string; delegator_id: string; delegate_id: string; department: string | null; starts_at: string; ends_at: string; active: boolean }[],
  };
}

export async function loadRuntimeTasks(): Promise<RuntimeTask[]> {
  const { data, error } = await supabase.from("approval_tasks").select("*, approval_instances(id,title,detail,amount,entity_type,entity_id,status,requester_id,created_at)").eq("status", "pending").order("due_at");
  if (error) throw error;
  return (data ?? []) as unknown as RuntimeTask[];
}

export async function decideRuntimeTask(id: string, decision: "approved" | "rejected" | "changes_requested", note?: string) {
  const { error } = await supabase.rpc("decide_approval_task", { _task_id: id, _decision: decision, _note: note ?? null, _evidence_url: null });
  if (error) throw error;
}

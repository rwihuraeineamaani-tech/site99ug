import { supabase } from "@/integrations/supabase/client";
import { buildWaiting, loadWaitingRaw } from "@/lib/inbox";
import { loadApprovals, type ApprovalContext } from "@/lib/approvals";

export type TodoKind = "content" | "shoots" | "approvals" | "strategy" | "finance" | "operations";
export type TodoItem = {
  id: string;
  kind: TodoKind;
  move: string;
  title: string;
  client: string | null;
  detail: string | null;
  due: string | null;
  to: string;
};

export async function loadTodoItems(ctx: ApprovalContext & { isLeadership: boolean }): Promise<TodoItem[]> {
  if (!ctx.userId) return [];
  const [{ flow, resLinks, myCrew }, approvals, shootBundle, compliance] = await Promise.all([
    loadWaitingRaw(ctx.userId),
    loadApprovals(ctx),
    Promise.all([
      supabase.from("shoot_days").select("id,resident_id,status,shoot_date").in("status", ["draft", "confirmed", "shooting"]),
      supabase.from("shoot_day_items").select("shoot_day_id,content_id"),
      supabase.from("content_crew").select("content_id,user_id").eq("user_id", ctx.userId),
    ]),
    ctx.isLeadership
      ? supabase.from("compliance_items").select("id,name,renews_on,status").neq("status", "complete")
      : Promise.resolve({ data: [] }),
  ]);
  const clients = new Map(resLinks.map((r) => [r.id, r.name]));
  const waiting = buildWaiting({
    userId: ctx.userId,
    flow,
    resLinks,
    myCrew,
    isFounder: ctx.isFounder,
    amContact: (id) => !!id && resLinks.some((r) => r.id === id && r.contact_user_id === ctx.userId),
    amHandler: (id) => !!id && resLinks.some((r) => r.id === id && r.handler_user_id === ctx.userId),
  }).map<TodoItem>((job) => ({
    id: `content-${job.item.id}-${job.why}`,
    kind: "content",
    move: job.why,
    title: job.item.title,
    client: job.item.resident_id ? clients.get(job.item.resident_id) ?? null : null,
    detail: `${job.item.stage} · SITE-${String(job.item.ref_no).padStart(4, "0")}`,
    due: job.due,
    to: `/app/content?ref=${job.item.ref_no}`,
  }));

  const approvalItems = approvals.items.filter((i) => i.mine).map<TodoItem>((item) => ({
    id: item.id,
    kind: item.kind === "strategy" ? "strategy" : ["cash_request", "payment_line", "loan"].includes(item.kind) ? "finance" : "approvals",
    move: item.move,
    title: item.title,
    client: item.who ?? null,
    detail: item.detail ?? item.waitingOn,
    due: item.since,
    to: item.to,
  }));

  const [shootsResult, dayItemsResult, crewResult] = shootBundle;
  const crewIds = new Set(((crewResult.data as { content_id: string; user_id: string }[]) ?? []).map((r) => r.content_id));
  const myDays = new Set(((dayItemsResult.data as { shoot_day_id: string; content_id: string }[]) ?? []).filter((r) => crewIds.has(r.content_id)).map((r) => r.shoot_day_id));
  const shoots = ((shootsResult.data as { id: string; resident_id: string | null; status: string; shoot_date: string | null }[]) ?? [])
    .filter((day) => myDays.has(day.id) || ctx.isLeadership)
    .map<TodoItem>((day) => ({
      id: `shoot-${day.id}`,
      kind: "shoots",
      move: day.status === "draft" ? "Prepare this shoot day" : day.status === "shooting" ? "Run and report this shoot" : "Get ready for this shoot",
      title: clients.get(day.resident_id ?? "") ?? "Shoot day",
      client: day.resident_id ? clients.get(day.resident_id) ?? null : null,
      detail: day.status,
      due: day.shoot_date,
      to: `/app/shoots/${day.id}`,
    }));

  const ops = ((compliance.data as { id: string; name: string; renews_on: string | null; status: string }[]) ?? []).map<TodoItem>((item) => ({
    id: `ops-${item.id}`,
    kind: "operations",
    move: "Review this deadline",
    title: item.name,
    client: null,
    detail: item.status,
    due: item.renews_on,
    to: "/app/ops/deadlines",
  }));

  return [...waiting, ...approvalItems, ...shoots, ...ops].sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"));
}

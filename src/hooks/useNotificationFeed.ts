import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMyRoles } from "@/hooks/useMyRoles";
import { loadChatThreads } from "@/lib/chat";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type ChatNotice = { id: string; name: string; preview: string; unread: number; at: string };
export type ReadNotice = { id: string; title: string; kind: "brief" | "announcement" };
export type ApprovalNotice = { key: string; title: string; sub: string; to: string };

const money = (n: number | null | undefined) => (n ? `UGX ${Number(n).toLocaleString()}` : "");
const label = (row: Record<string, unknown>, fallback: string) =>
  String(row.title ?? row.name ?? row.goal ?? row.purpose ?? fallback);

/** The real items behind the notification badge: unread chats, things to read, approvals waiting on you. */
export function useNotificationFeed() {
  const { userId, isStaff, has, roles, canApproveStrategy } = useMyRoles();
  const isFounder = has("admin", "founder");
  const isMd = has("admin", "founder", "managing_director");
  const roleKey = roles.join(",");

  const [chats, setChats] = useState<ChatNotice[]>([]);
  const [reads, setReads] = useState<ReadNotice[]>([]);
  const [approvals, setApprovals] = useState<ApprovalNotice[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    const jobs: Promise<void>[] = [];

    jobs.push(
      loadChatThreads(userId)
        .then((rows) =>
          setChats(
            rows
              .filter((t) => t.unread > 0)
              .map((t) => ({
                id: t.id,
                name: t.person.display_name,
                preview: t.lastMessage?.body ?? "",
                unread: t.unread,
                at: t.lastMessage?.created_at ?? t.updated_at,
              }))
          )
        )
        .catch(() => undefined)
    );

    if (isStaff) {
      jobs.push(
        Promise.all([
          supabase.from("briefs").select("id, title"),
          supabase.from("announcements").select("id, title").eq("published", true),
          supabase.from("communication_reads").select("entity_kind,entity_id").eq("user_id", userId),
        ])
          .then(([b, a, r]) => {
            const seen = new Set(((r.data as { entity_kind: string; entity_id: string }[]) ?? []).map((x) => `${x.entity_kind}:${x.entity_id}`));
            setReads([
              ...((b.data as { id: string; title: string }[]) ?? [])
                .filter((x) => !seen.has(`brief:${x.id}`))
                .map((x) => ({ id: x.id, title: x.title, kind: "brief" as const })),
              ...((a.data as { id: string; title: string }[]) ?? [])
                .filter((x) => !seen.has(`announcement:${x.id}`))
                .map((x) => ({ id: x.id, title: x.title, kind: "announcement" as const })),
            ]);
          })
          .catch(() => undefined)
      );
    }

    jobs.push(
      (async () => {
        const items: ApprovalNotice[] = [];
        const pulls: PromiseLike<void>[] = [];

        if (isMd)
          pulls.push(
            db.from("cash_requests").select("id, purpose, amount_ugx").eq("status", "submitted").neq("requester", userId).limit(6)
              .then(({ data }: { data: { id: string; purpose: string; amount_ugx: number }[] | null }) =>
                (data ?? []).forEach((r) => items.push({ key: `cash-${r.id}`, title: r.purpose, sub: `Money request · ${money(r.amount_ugx)}`, to: "/app/approvals" }))
              ),
            db.from("resident_onboarding_steps").select("id, title, residents(name)").eq("requires_md_approval", true).is("approved_at", null).eq("status", "in_progress").limit(6)
              .then(({ data }: { data: { id: string; title: string; residents: { name: string } | null }[] | null }) =>
                (data ?? []).forEach((s) => items.push({ key: `onb-${s.id}`, title: s.title, sub: `Client onboarding · ${s.residents?.name ?? "client"}`, to: "/app/approvals" }))
              )
          );

        if (isFounder)
          pulls.push(
            db.from("cash_requests").select("id, purpose, amount_ugx").eq("status", "md_approved").neq("requester", userId).limit(6)
              .then(({ data }: { data: { id: string; purpose: string; amount_ugx: number }[] | null }) =>
                (data ?? []).forEach((r) => items.push({ key: `cashf-${r.id}`, title: r.purpose, sub: `Final sign-off · ${money(r.amount_ugx)}`, to: "/app/approvals" }))
              ),
            db.from("payment_run_lines").select("id", { count: "exact", head: true }).eq("status", "pending")
              .then(({ count }: { count: number | null }) => {
                if (count) items.push({ key: "runs", title: "Monthly payment run", sub: `${count} payment${count > 1 ? "s" : ""} to release`, to: "/app/approvals" });
              }),
            db.from("loans").select("id, principal_ugx").eq("status", "pending_approval").limit(4)
              .then(({ data }: { data: { id: string; principal_ugx: number }[] | null }) =>
                (data ?? []).forEach((l) => items.push({ key: `loan-${l.id}`, title: "Loan request", sub: money(l.principal_ugx), to: "/app/approvals" }))
              ),
            db.from("content_items").select("id, title, stage").in("stage", ["Idea", "Review"]).limit(6)
              .then(({ data }: { data: { id: string; title: string; stage: string }[] | null }) =>
                (data ?? []).forEach((c) => items.push({ key: `content-${c.id}`, title: c.title, sub: c.stage === "Idea" ? "New idea to approve" : "Final cut to sign off", to: "/app/content" }))
              )
          );

        if (canApproveStrategy)
          (["client_goals", "client_targets", "strategy_maps", "client_plans", "strategy_map_versions"] as const).forEach((t) =>
            pulls.push(
              db.from(t).select("*").eq("review_state", "submitted").limit(4)
                .then(({ data }: { data: Record<string, unknown>[] | null }) =>
                  (data ?? []).forEach((r) => items.push({ key: `${t}-${r.id}`, title: label(r, "Strategy item"), sub: "Strategy sign-off", to: "/app/strategy" }))
                )
            )
          );

        pulls.push(
          supabase
            .from("approval_tasks")
            .select("id, assigned_user_id, assigned_role, exclude_requester, approval_instances(title, requester_id)")
            .eq("status", "pending")
            .then(({ data }) => {
              type Row = { id: string; assigned_user_id: string | null; assigned_role: string | null; exclude_requester: boolean | null; approval_instances: { title: string; requester_id: string } | null };
              ((data as unknown as Row[]) ?? [])
                .filter((t) => {
                  const forMe = t.assigned_user_id === userId || (!t.assigned_user_id && Boolean(t.assigned_role) && roles.includes(String(t.assigned_role) as never));
                  const ownRequest = t.approval_instances?.requester_id === userId && t.exclude_requester !== false;
                  return forMe && !ownRequest;
                })
                .forEach((t) => items.push({ key: `task-${t.id}`, title: t.approval_instances?.title ?? "Approval", sub: "A decision is waiting for you", to: "/app/approvals" }));
            })
        );

        await Promise.all(pulls);
        setApprovals(items);
      })().catch(() => undefined)
    );

    await Promise.all(jobs);
    setLoaded(true);
  }, [userId, isStaff, isFounder, isMd, canApproveStrategy, roleKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let live = true;
    const run = () => live && load();
    run();
    const timer = window.setInterval(run, 30000);
    return () => { live = false; window.clearInterval(timer); };
  }, [load]);

  const markAllRead = useCallback(async () => {
    if (!userId || !reads.length) return;
    const rows = reads.map((r) => ({ user_id: userId, entity_kind: r.kind, entity_id: r.id }));
    const { error } = await supabase.from("communication_reads").upsert(rows as never, { onConflict: "user_id,entity_kind,entity_id" });
    if (!error) setReads([]);
  }, [userId, reads]);

  return {
    chats,
    reads,
    approvals,
    loaded,
    refresh: load,
    markAllRead,
    total: chats.reduce((a, c) => a + c.unread, 0) + reads.length + approvals.length,
  };
}

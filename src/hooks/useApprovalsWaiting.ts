import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMyRoles } from "@/hooks/useMyRoles";

/** How many things are sitting with the signed-in person, for the sidebar badge. */
export function useApprovalsWaiting() {
  const { userId, has, roles, canApproveStrategy } = useMyRoles();
  const isFounder = has("admin", "founder");
  const isMd = has("admin", "founder", "managing_director");
  const roleKey = roles.join(",");
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) {
      setCount(0);
      return;
    }
    let cancelled = false;
    (async () => {
      const jobs: Promise<number>[] = [];
      const n = async (p: PromiseLike<{ count: number | null }>) => ((await p).count ?? 0);

      if (isMd)
        jobs.push(
          n(
            supabase
              .from("cash_requests")
              .select("id", { count: "exact", head: true })
              .eq("status", "submitted")
              .neq("requester", userId)
          )
        );
      if (isFounder) {
        jobs.push(
          n(
            supabase
              .from("cash_requests")
              .select("id", { count: "exact", head: true })
              .eq("status", "md_approved")
              .neq("requester", userId)
          )
        );
        jobs.push(n(supabase.from("payment_run_lines").select("id", { count: "exact", head: true }).eq("status", "pending")));
        jobs.push(n(supabase.from("loans").select("id", { count: "exact", head: true }).eq("status", "pending_approval")));
        jobs.push(
          n(supabase.from("content_items").select("id", { count: "exact", head: true }).in("stage", ["Idea", "Review"]))
        );
      }
      if (canApproveStrategy) {
        (["client_goals", "client_targets", "strategy_maps", "client_plans", "strategy_map_versions"] as const).forEach(
          (t) => jobs.push(n(supabase.from(t).select("id", { count: "exact", head: true }).eq("review_state", "submitted")))
        );
      }
      const totals = await Promise.all(jobs);
      // Workflow steps only count when they name you, or a role you hold.
      const { data: tasks } = await supabase
        .from("approval_tasks")
        .select("assigned_user_id, assigned_role, exclude_requester, approval_instances(requester_id)")
        .eq("status", "pending");
      const mineTasks = (tasks ?? []).filter((t) => {
        const inst = t.approval_instances as unknown as { requester_id: string } | null;
        const forMe =
          t.assigned_user_id === userId ||
          (!t.assigned_user_id && Boolean(t.assigned_role) && roles.includes(String(t.assigned_role) as never));
        const ownRequest = inst?.requester_id === userId && t.exclude_requester !== false;
        return forMe && !ownRequest;
      }).length;
      if (!cancelled) setCount(totals.reduce((a, b) => a + b, 0) + mineTasks);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, isFounder, isMd, canApproveStrategy]);

  return count;
}

export default useApprovalsWaiting;

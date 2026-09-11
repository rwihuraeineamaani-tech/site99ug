import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMyRoles } from "@/hooks/useMyRoles";

/** How many things are sitting with the signed-in person, for the sidebar badge. */
export function useApprovalsWaiting() {
  const { userId, has, canApproveStrategy } = useMyRoles();
  const isFounder = has("admin", "founder");
  const isMd = has("admin", "founder", "managing_director");
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId || (!isFounder && !isMd && !canApproveStrategy)) {
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
      jobs.push(n(supabase.from("approval_tasks").select("id", { count: "exact", head: true }).eq("status", "pending")));

      const totals = await Promise.all(jobs);
      if (!cancelled) setCount(totals.reduce((a, b) => a + b, 0));
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, isFounder, isMd, canApproveStrategy]);

  return count;
}

export default useApprovalsWaiting;

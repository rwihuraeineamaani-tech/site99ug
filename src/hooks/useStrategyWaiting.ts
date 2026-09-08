import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** How many strategy items are sitting with the founders. Only counted for people who can approve. */
export function useStrategyWaiting(enabled: boolean) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }
    let cancelled = false;
    (async () => {
      const tables = ["client_goals", "client_targets", "strategy_maps", "client_plans", "strategy_map_versions"] as const;
      const results = await Promise.all(
        tables.map((t) =>
          supabase.from(t).select("id", { count: "exact", head: true }).eq("review_state", "submitted")
        )
      );
      if (cancelled) return;
      setCount(results.reduce((total, r) => total + (r.count ?? 0), 0));
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return count;
}

export default useStrategyWaiting;

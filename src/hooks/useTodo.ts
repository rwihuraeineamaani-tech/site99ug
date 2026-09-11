import { useCallback, useEffect, useState } from "react";
import { useMyRoles } from "@/hooks/useMyRoles";
import { loadTodoItems, type TodoItem } from "@/lib/todo";

export function useTodo() {
  const roles = useMyRoles();
  const [items, setItems] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((v) => v + 1), []);
  useEffect(() => {
    if (roles.loading || !roles.userId || !roles.isStaff) return;
    let live = true;
    setLoading(true);
    loadTodoItems({
      userId: roles.userId,
      isFounder: roles.has("admin", "founder"),
      isMd: roles.has("admin", "founder", "managing_director"),
      canApproveStrategy: roles.canApproveStrategy,
      canSeeFinance: roles.canSeeFinance,
      isLeadership: roles.isLeadership,
    }).then((rows) => { if (live) setItems(rows); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [roles.loading, roles.userId, roles.canApproveStrategy, roles.canSeeFinance, roles.isLeadership, roles.roles.join(","), tick]);
  return { items, loading, reload };
}

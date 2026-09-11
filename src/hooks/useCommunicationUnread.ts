import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMyRoles } from "@/hooks/useMyRoles";

export function useCommunicationUnread() {
  const { userId, isStaff } = useMyRoles();
  const [counts, setCounts] = useState({ briefs: 0, announcements: 0 });
  useEffect(() => {
    if (!userId || !isStaff) return;
    let live = true;
    Promise.all([
      supabase.from("briefs").select("id"),
      supabase.from("announcements").select("id").eq("published", true),
      supabase.from("communication_reads").select("entity_kind,entity_id").eq("user_id", userId),
    ]).then(([briefs, announcements, reads]) => {
      if (!live) return;
      const seen = new Set(((reads.data as { entity_kind: string; entity_id: string }[]) ?? []).map((r) => `${r.entity_kind}:${r.entity_id}`));
      setCounts({
        briefs: (briefs.data ?? []).filter((r) => !seen.has(`brief:${r.id}`)).length,
        announcements: (announcements.data ?? []).filter((r) => !seen.has(`announcement:${r.id}`)).length,
      });
    });
    return () => { live = false; };
  }, [userId, isStaff]);
  return counts;
}

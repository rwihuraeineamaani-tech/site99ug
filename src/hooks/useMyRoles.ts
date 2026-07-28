import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type StaffRole = "admin" | "event_manager" | "scanner" | "viewer" | "site_editor";

export const ROLE_LABELS: Record<StaffRole, string> = {
  admin: "Admin",
  event_manager: "Event manager",
  scanner: "Gate scanner",
  viewer: "Finance / viewer",
  site_editor: "Site editor",
};

export const ROLE_HINTS: Record<StaffRole, string> = {
  admin: "Full access, including team management",
  event_manager: "Create & edit events, confirm payments, email tickets",
  scanner: "Ticket scanner at the door only",
  viewer: "Read-only dashboard, orders and exports",
  site_editor: "Projects, residents, announcements",
};

export type RoleState = {
  loading: boolean;
  userId: string | null;
  roles: StaffRole[];
  has: (...r: StaffRole[]) => boolean;
  isAdmin: boolean;
  canManageEvents: boolean;
  canViewEvents: boolean;
  canScan: boolean;
  canEditSite: boolean;
};

export function useMyRoles(): RoleState {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [roles, setRoles] = useState<StaffRole[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!data.user) {
        setUserId(null);
        setRoles([]);
        setLoading(false);
        return;
      }
      setUserId(data.user.id);
      const { data: rows } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
      if (cancelled) return;
      setRoles(((rows ?? []).map((r) => r.role) as StaffRole[]) ?? []);
      setLoading(false);
    };
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const has = (...r: StaffRole[]) => r.some((x) => roles.includes(x));

  return {
    loading,
    userId,
    roles,
    has,
    isAdmin: has("admin"),
    canManageEvents: has("admin", "event_manager"),
    canViewEvents: has("admin", "event_manager", "viewer"),
    canScan: has("admin", "event_manager", "scanner"),
    canEditSite: has("admin", "site_editor"),
  };
}

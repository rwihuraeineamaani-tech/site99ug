import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Every role the system understands. Legacy console roles are kept so existing logins keep working. */
export type StaffRole =
  | "founder"
  | "creative_director"
  | "managing_director"
  | "sales_head"
  | "finance_ops"
  | "creative"
  | "legal"
  | "admin"
  | "event_manager"
  | "scanner"
  | "viewer"
  | "site_editor";

export type AppRole = StaffRole | "client" | "resident" | "user";

/** Roles offered when adding a team member (in the order they appear). */
export const TEAM_ROLES: StaffRole[] = [
  "founder",
  "creative_director",
  "managing_director",
  "sales_head",
  "finance_ops",
  "creative",
  "legal",
  "admin",
  "event_manager",
  "scanner",
  "viewer",
  "site_editor",
];

export const ROLE_LABELS: Record<StaffRole, string> = {
  founder: "Founder",
  creative_director: "Creative Director",
  managing_director: "Managing Director",
  sales_head: "Head of Sales & Partnerships",
  finance_ops: "Finance / Ops",
  creative: "Creative / Production",
  legal: "Legal",
  admin: "System admin",
  event_manager: "Event manager",
  scanner: "Gate scanner",
  viewer: "Read-only",
  site_editor: "Site editor",
};

export const ROLE_HINTS: Record<StaffRole, string> = {
  founder: "Full access across the whole business, including money and team",
  creative_director: "Creative direction, content pipeline, clients and projects",
  managing_director: "Operations, clients, contracts, money and team",
  sales_head: "Clients, contracts and pipeline — no payroll",
  finance_ops: "Finance, payroll, contract splits and operating expenses",
  creative: "Content pipeline and production — no money",
  legal: "Contracts and legal documents",
  admin: "Technical administrator: settings, roles and every module",
  event_manager: "Create & edit events, confirm payments, email tickets",
  scanner: "Ticket scanner at the door only",
  viewer: "Read-only dashboard, orders and exports",
  site_editor: "Projects, residents, announcements",
};

const LEADERSHIP: StaffRole[] = ["admin", "founder", "managing_director"];
const FINANCE: StaffRole[] = ["admin", "founder", "managing_director", "finance_ops"];

export type RoleState = {
  loading: boolean;
  userId: string | null;
  email: string | null;
  roles: AppRole[];
  has: (...r: AppRole[]) => boolean;
  /** anyone with an internal role */
  isStaff: boolean;
  isAdmin: boolean;
  isLeadership: boolean;
  isClient: boolean;
  clientId: string | null;
  canSeeFinance: boolean;
  canManageTeam: boolean;
  canManageClients: boolean;
  canManageEvents: boolean;
  canViewEvents: boolean;
  canScan: boolean;
  canEditSite: boolean;
  /** where this person should land after signing in */
  landingPath: string;
  reload: () => void;
};

const STAFF_ROLES = new Set<string>(TEAM_ROLES);

export function useMyRoles(): RoleState {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [clientId, setClientId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!data.user) {
        setUserId(null);
        setEmail(null);
        setRoles([]);
        setClientId(null);
        setLoading(false);
        return;
      }
      setUserId(data.user.id);
      setEmail(data.user.email ?? null);

      const { data: rows } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
      if (cancelled) return;
      const list = ((rows ?? []).map((r) => r.role) as AppRole[]) ?? [];
      setRoles(list);

      if (list.includes("client")) {
        const { data: link } = await supabase
          .from("client_users")
          .select("client_id")
          .eq("user_id", data.user.id)
          .maybeSingle();
        if (!cancelled) setClientId(link?.client_id ?? null);
      } else {
        setClientId(null);
      }
      if (!cancelled) setLoading(false);
    };

    load();
    // Never call Supabase directly inside the auth callback — defer it.
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      setTimeout(() => {
        if (!cancelled) load();
      }, 0);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [tick]);

  const has = (...r: AppRole[]) => r.some((x) => roles.includes(x));

  const isStaff = roles.some((r) => STAFF_ROLES.has(r));
  const isClient = has("client");
  const isLeadership = has(...LEADERSHIP);
  const canSeeFinance = has(...FINANCE);

  const landingPath = isStaff ? "/app" : isClient ? "/portal" : has("resident") ? "/residents/portal" : "/";

  return {
    loading,
    userId,
    email,
    roles,
    has,
    isStaff,
    isAdmin: has("admin", "founder"),
    isLeadership,
    isClient,
    clientId,
    canSeeFinance,
    canManageTeam: isLeadership,
    canManageClients: has("admin", "founder", "managing_director", "sales_head", "creative_director"),
    canManageEvents: has("admin", "founder", "managing_director", "event_manager"),
    canViewEvents: has("admin", "founder", "managing_director", "event_manager", "viewer", "finance_ops"),
    canScan: has("admin", "founder", "managing_director", "event_manager", "scanner"),
    canEditSite: has("admin", "founder", "creative_director", "creative", "site_editor"),
    landingPath,
    reload: () => setTick((t) => t + 1),
  };
}

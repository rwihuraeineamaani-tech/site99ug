import { createContext, useContext, useEffect, useRef, useState } from "react";
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

/** Department sections of the internal system. */
export type Department =
  | "content"
  | "clients"
  | "sales"
  | "legal"
  | "ops"
  | "finance"
  | "site"
  | "events";

export type RoleState = {
  loading: boolean;
  userId: string | null;
  email: string | null;
  displayName: string | null;
  /** best human-readable title for this user (e.g. "Founder") */
  title: string | null;
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
  canEditContent: boolean;
  /** which department sections this person may open */
  departments: Record<Department, boolean>;
  /** where this person should land after signing in */
  landingPath: string;
  reload: () => void;
  /** clients this person is on, with their part */
  assignments: { resident_id: string; kind: "contact" | "handler" }[];
};


const STAFF_ROLES = new Set<string>(TEAM_ROLES);

export function useRolesState(): RoleState {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [clientId, setClientId] = useState<string | null>(null);
  const [jobTitle, setJobTitle] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<{ resident_id: string; kind: "contact" | "handler" }[]>([]);
  const [tick, setTick] = useState(0);
  const firstLoad = useRef(true);
  const currentUser = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!data.user) {
        currentUser.current = null;
        setUserId(null);
        setEmail(null);
        setDisplayName(null);
        setRoles([]);
        setClientId(null);
        setJobTitle(null);
        setAssignments([]);
        setLoading(false);
        firstLoad.current = false;
        return;
      }
      currentUser.current = data.user.id;
      setUserId(data.user.id);
      setEmail(data.user.email ?? null);
      setDisplayName((data.user.user_metadata?.display_name as string | undefined) ?? null);

      const [{ data: rows }, { data: member }, { data: mine }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", data.user.id),
        supabase.from("team_members").select("display_name, title").eq("user_id", data.user.id).maybeSingle(),
        supabase.from("client_assignments").select("resident_id, kind").eq("user_id", data.user.id),
      ]);
      if (cancelled) return;
      const list = ((rows ?? []).map((r) => r.role) as AppRole[]) ?? [];
      setRoles(list);
      setAssignments((mine as unknown as { resident_id: string; kind: "contact" | "handler" }[]) ?? []);
      if (member?.display_name) setDisplayName(member.display_name);
      setJobTitle((member as { title?: string | null } | null)?.title ?? null);

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
      if (!cancelled) {
        setLoading(false);
        firstLoad.current = false;
      }
    };

    load();
    // Never call Supabase directly inside the auth callback — defer it.
    // Background token renewals fire on tab focus — they never change who you are,
    // so we ignore them instead of refetching the whole session on every tab switch.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") return;
      if (event === "SIGNED_IN" && session?.user?.id === currentUser.current) return;
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

  const canEditContent = has("admin", "founder", "managing_director", "creative_director", "creative");
  const canManageClients = has("admin", "founder", "managing_director", "sales_head", "creative_director");
  const canManageEvents = has("admin", "founder", "managing_director", "event_manager");
  const canViewEvents = has("admin", "founder", "managing_director", "event_manager", "viewer", "finance_ops");
  const canScan = has("admin", "founder", "managing_director", "event_manager", "scanner");
  const canEditSite = has("admin", "founder", "creative_director", "creative", "site_editor");

  const departments: Record<Department, boolean> = {
    content: canEditContent || has("sales_head", "legal", "viewer"),
    clients: canManageClients || has("legal", "finance_ops"),
    sales: has("admin", "founder", "managing_director", "sales_head"),
    legal: has("admin", "founder", "managing_director", "legal"),
    ops: isLeadership,
    finance: canSeeFinance,
    site: canEditSite,
    events: canViewEvents || canScan,
  };

  const landingPath = isStaff ? "/app" : isClient ? "/portal" : has("resident") ? "/residents/portal" : "/";

  const primaryRole = TEAM_ROLES.find((r) => roles.includes(r));
  const title =
    jobTitle ?? (primaryRole ? ROLE_LABELS[primaryRole] : isClient ? "Client" : has("resident") ? "Resident" : null);

  return {
    loading,
    userId,
    email,
    displayName,
    title,
    roles,
    has,
    isStaff,
    isAdmin: has("admin", "founder"),
    isLeadership,
    isClient,
    clientId,
    canSeeFinance,
    canManageTeam: isLeadership,
    canManageClients,
    canManageEvents,
    canViewEvents,
    canScan,
    canEditSite,
    canEditContent,
    departments,
    landingPath,
    assignments,
    reload: () => setTick((t) => t + 1),
  };
}

const RolesContext = createContext<RoleState | null>(null);
export const RolesContextObject = RolesContext;

/** Who you are and what you may see — worked out once for the whole app. */
export function useMyRoles(): RoleState {
  const ctx = useContext(RolesContext);
  if (ctx) return ctx;
  throw new Error("useMyRoles must be used inside <RolesProvider>");
}


import { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Every role the system understands. Legacy console roles are kept so existing logins keep working. */
export type StaffRole =
  | "team_member"
  | "founder"
  | "creative_director"
  | "managing_director"
  | "sales_head"
  | "finance_ops"
  | "creative"
  | "strategist"
  | "legal"
  | "admin"
  | "event_manager"
  | "scanner"
  | "viewer"
  | "site_editor"
  | "operations_manager"
  | "talent"
  | "communications"
  | "designer";

export type AppRole = StaffRole | "client" | "resident" | "user";

/** Roles offered when adding a team member (in the order they appear). */
export const TEAM_ROLES: StaffRole[] = [
  "team_member",
  "founder",
  "managing_director",
  "operations_manager",
  "sales_head",
  "finance_ops",
  "creative",
  "strategist",
  "legal",
  "talent",
  "communications",
  "designer",
  "event_manager",
  "site_editor",
  "scanner",
  "viewer",
  "admin",
  "creative_director",
];

export const POSITION_ROLES: StaffRole[] = TEAM_ROLES.filter((role) => !["team_member", "admin", "viewer", "scanner", "site_editor", "creative_director"].includes(role));
export const WORKSPACE_ROLES: StaffRole[] = ["site_editor", "event_manager", "scanner", "viewer"];
export const TECHNICAL_ROLES: StaffRole[] = ["admin"];

export const ROLE_LABELS: Record<StaffRole, string> = {
  team_member: "Team member",
  founder: "Founder",
  creative_director: "Creative Director",
  managing_director: "Managing Director",
  sales_head: "Head of Sales & Partnerships",
  finance_ops: "Finance",
  creative: "Content Creation / Production",
  strategist: "Strategy",
  legal: "Legal",
  admin: "System admin",
  event_manager: "Event manager",
  scanner: "Gate scanner",
  viewer: "Read-only",
  site_editor: "Site editor",
  operations_manager: "Operations Manager",
  talent: "Talent",
  communications: "Communications",
  designer: "Designer",
};

export const ROLE_HINTS: Record<StaffRole, string> = {
  team_member: "Common team workspace and read-only Content Pipeline",
  founder: "Full access across the whole business, including money and team",
  creative_director: "Creative direction, content pipeline, clients and projects",
  managing_director: "Operations, clients, contracts, money and team",
  sales_head: "Clients, contracts and pipeline — no payroll",
  finance_ops: "Cashbook, payments, invoices, budgets and financial reporting",
  creative: "Content pipeline, production, shoots and publishing",
  strategist: "Client strategy: plans, goals, monthly targets and strategy maps",
  legal: "Contracts and legal documents",
  admin: "Technical administrator: settings, roles and every module",
  event_manager: "Create & edit events, confirm payments, email tickets",
  scanner: "Ticket scanner at the door only",
  viewer: "Read-only dashboard, orders and exports",
  site_editor: "Projects, residents, announcements",
  operations_manager: "Delivery, turnaround time, workload, shoots and equipment",
  talent: "Talent bookings, shoots, releases and usage deadlines",
  communications: "Briefs, announcements, messages and publishing schedule",
  designer: "Design briefs, production, reviews, revisions and delivery dates",
};

const LEADERSHIP: StaffRole[] = ["admin", "founder", "managing_director", "operations_manager"];
const FINANCE: StaffRole[] = ["admin", "founder", "managing_director", "finance_ops"];
const STRATEGY: StaffRole[] = ["admin", "founder", "managing_director", "strategist", "creative_director", "sales_head"];

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
  canAssignWork: boolean;
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
  /** may create and change client strategy */
  isStrategyTeam: boolean;
  /** may approve or send back strategy */
  canApproveStrategy: boolean;
  /** which department sections this person may open */
  departments: Record<Department, boolean>;
  /** where this person should land after signing in */
  landingPath: string;
  reload: () => void;
  /** clients this person is on, with their part */
  assignments: { resident_id: string; kind: "contact" | "handler" }[];
  /** Positions available for dashboard focus; access never changes when this changes. */
  positions: StaffRole[];
  viewRole: StaffRole | null;
  setViewRole: (role: StaffRole | null) => void;
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
  const [viewRole, setViewRoleState] = useState<StaffRole | null>(() => {
    const saved = localStorage.getItem("site99:position-view");
    return saved && TEAM_ROLES.includes(saved as StaffRole) ? (saved as StaffRole) : null;
  });
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
      // A different person just signed in — hold the guards until their roles are known.
      if (currentUser.current !== data.user.id) {
        setLoading(true);
        setRoles([]);
        setAssignments([]);
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
          .from("resident_users")
          .select("resident_id")
          .eq("user_id", data.user.id)
          .maybeSingle();
        if (!cancelled) setClientId(link?.resident_id ?? null);
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
      if (session?.user && session.user.id !== currentUser.current) {
        // Somebody new signed in: guards must wait, not decide on stale state.
        setLoading(true);
        setUserId(session.user.id);
        setRoles([]);
      }
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
  const canAssignWork = has("admin", "founder", "managing_director", "operations_manager", "creative_director", "sales_head");
  const canSeeFinance = has(...FINANCE);

  const canEditContent = has("admin", "founder", "managing_director", "creative_director", "creative", "strategist", "communications", "designer");
  const canManageClients = has("admin", "founder", "managing_director", "sales_head", "creative_director");
  const canManageEvents = has("admin", "founder", "managing_director", "operations_manager", "event_manager");
  const canViewEvents = has("admin", "founder", "managing_director", "operations_manager", "event_manager", "viewer", "finance_ops", "communications", "talent");
  const canScan = has("admin", "founder", "managing_director", "operations_manager", "event_manager", "scanner");
  const canEditSite = has("admin", "founder", "creative_director", "creative", "communications", "designer", "site_editor");
  const isStrategyTeam = has(...STRATEGY);
  const canApproveStrategy = isLeadership;

  const departments: Record<Department, boolean> = {
    content: isStaff,
    clients: canManageClients || has("legal", "finance_ops", "talent", "communications"),
    sales: has("admin", "founder", "managing_director", "sales_head"),
    legal: has("admin", "founder", "managing_director", "legal"),
    ops: isLeadership || has("talent"),
    finance: canSeeFinance,
    site: canEditSite,
    events: canViewEvents || canScan,
  };

  const landingPath = isStaff ? "/app" : isClient ? "/portal" : has("resident") ? "/residents/portal" : "/";

  const positions = POSITION_ROLES.filter((role) => roles.includes(role));
  const primaryRole = positions[0] ?? TEAM_ROLES.find((r) => roles.includes(r) && r !== "team_member");
  const title =
    jobTitle ?? (isStaff ? "Team member" : isClient ? "Client" : has("resident") ? "Resident" : null);
  const setViewRole = (role: StaffRole | null) => {
    if (role && !positions.includes(role)) return;
    setViewRoleState(role);
    if (role) localStorage.setItem("site99:position-view", role);
    else localStorage.removeItem("site99:position-view");
  };

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
    canAssignWork,
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
    isStrategyTeam,
    canApproveStrategy,
    departments,
    landingPath,
    assignments,
    positions,
    viewRole: viewRole && positions.includes(viewRole) ? viewRole : null,
    setViewRole,
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


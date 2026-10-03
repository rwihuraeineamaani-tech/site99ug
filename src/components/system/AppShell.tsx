import { ReactNode, createContext, useContext, useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  Clock,
  LayoutDashboard,
  CalendarDays,
  ScanLine,
  PenSquare,
  Users,
  Handshake,
  Scale,
  Clapperboard,
  TrendingUp,
  Wallet,
  Settings2,
  Camera,
  Package,
  LogOut,
  BookOpen,
  BookMarked,
  HandCoins,
  Banknote,
  Landmark,
  PieChart,
  FileText,
  Search,
  ShieldCheck,
  Gauge,
  CalendarClock,
  Megaphone,
  UserCog,
  Target,
  Workflow,
  Compass,
  BadgeCheck,
  ListChecks,
  MessageCircle,
  Network,
  Activity,
  ClipboardList,
  HeartHandshake,
  PhoneCall,
  RefreshCw,
  Star,
  UserPlus,
  Sparkles,
  Calculator,
  ChevronDown,
  Home,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import HeaderClock from "@/components/deck/HeaderClock";
import NotificationBell from "@/components/system/NotificationBell";
import HelpButton from "@/components/system/HelpButton";
import useActivityTracker from "@/hooks/useActivityTracker";
import {
  ThemeMode,
  readTheme,
  setTheme,
  onThemeChange,
  applyThemeClasses,
  resolveTheme,
} from "@/lib/theme";

import { useMyRoles } from "@/hooks/useMyRoles";
import { useStrategyWaiting } from "@/hooks/useStrategyWaiting";
import { useApprovalsWaiting } from "@/hooks/useApprovalsWaiting";
import { useTodo } from "@/hooks/useTodo";
import { useChatUnread } from "@/hooks/useChatUnread";
import { useCommunicationUnread } from "@/hooks/useCommunicationUnread";
import logo from "@/assets/site99-logo.png";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import AccessLoading from "@/components/system/AccessLoading";

export type ShellNavItem = { to: string; label: string; end?: boolean; icon?: typeof LayoutDashboard; badge?: number };
type ShellNavGroup = { label: string; items: ShellNavItem[] };

function useNavGroups(nav?: ShellNavItem[]): ShellNavGroup[] {
  const { isStaff, isClient, talentId, departments, canScan, isLeadership, canSeeFinance, canAssignWork, has, userId: peopleUid } = useMyRoles();
  const [canPeople, setCanPeople] = useState(false);
  useEffect(() => {
    if (!peopleUid || !isStaff) return;
    supabase.rpc("can_view_people" as never, { _u: peopleUid } as never).then(({ data }) => setCanPeople(Boolean(data)));
  }, [peopleUid, isStaff]);
  const strategyWaiting = useStrategyWaiting(isLeadership);
  const approvalsWaiting = useApprovalsWaiting();
  const { items: todoItems } = useTodo();
  const chatUnread = useChatUnread();
  const communicationUnread = useCommunicationUnread();

  if (nav) return [{ label: "Menu", items: nav }];

  if (talentId && !isStaff && !isClient) {
    return [
      {
        label: "Talent portal",
        items: [
          { to: "/talent-portal", label: "Overview", end: true, icon: LayoutDashboard },
          { to: "/talent-portal/bookings", label: "Bookings", icon: Camera },
          { to: "/talent-portal/contracts", label: "Contracts & releases", icon: FileText },
          { to: "/talent-portal/earnings", label: "Earnings", icon: Wallet },
          { to: "/talent-portal/campaigns", label: "Campaign results", icon: TrendingUp },
        ],
      },
    ];
  }

  if (isClient && !isStaff) {
    return [
      {
        label: "Menu",
        items: [
          { to: "/portal", label: "Dashboard", end: true, icon: LayoutDashboard },
          { to: "/portal/work", label: "Your work", icon: Clapperboard },
          { to: "/portal/calendar", label: "Calendar", icon: CalendarDays },
          { to: "/portal/strategy", label: "Strategy", icon: Target },
          { to: "/portal/shoots", label: "Shoot days", icon: Camera },
          { to: "/portal/money", label: "Money", icon: Wallet },
          { to: "/portal/documents", label: "Documents", icon: FileText },
          { to: "/portal/chat", label: "Chat", icon: MessageCircle, badge: chatUnread },
        ],
      },
    ];
  }

  if (!isStaff) return [];

  const groups: ShellNavGroup[] = [
    {
      label: "Overview",
      items: [
        { to: "/app", label: "Dashboard", end: true, icon: LayoutDashboard },
          { to: "/app/todo", label: "To-Do", icon: ListChecks, badge: todoItems.length },
          ...(canAssignWork ? [{ to: "/app/work", label: "Work", icon: ClipboardList } as ShellNavItem] : []),
          { to: "/app/kpi", label: "My KPI", icon: Gauge, end: true },
          ...(has("founder", "managing_director", "operations_manager", "hr", "finance_ops") ? [{ to: "/app/kpi/desk", label: "KPI desk", icon: Gauge } as ShellNavItem] : []),
          { to: "/app/chat", label: "Chat", icon: MessageCircle, badge: chatUnread },
          { to: "/app/briefs", label: "Briefs", icon: FileText, badge: communicationUnread.briefs },
          { to: "/app/announcements", label: "Announcements", icon: Megaphone, badge: communicationUnread.announcements },
        { to: "/app/approvals", label: "Approvals", icon: BadgeCheck, badge: approvalsWaiting },
        { to: "/app/calendar", label: "Calendar", icon: CalendarDays },
        { to: "/app/sops", label: "SOP Library", icon: BookMarked, end: true },
        { to: "/app/settings", label: "My settings", icon: UserCog },
      ],
    },

  ];

  const dept: ShellNavItem[] = [];
  if (departments.content) dept.push({ to: "/app/content", label: "Content Pipeline", icon: Clapperboard });
  if (departments.content && has("admin", "founder", "managing_director", "operations_manager", "creative", "talent", "communications", "designer", "creative_director")) dept.push({ to: "/app/shoots", label: "Shoot days", icon: Camera });
  if (departments.clients) dept.push({ to: "/app/residents", label: "Residents", icon: Handshake });
  if (departments.sales) dept.push({ to: "/app/sales", label: "Sales", icon: TrendingUp });
  if (departments.site) dept.push({ to: "/app/site", label: "Site editing", icon: PenSquare });
  if (dept.length) groups.push({ label: "Departments", items: dept });

  if (has("admin")) {
    groups.push({
      label: "System administration",
      items: [
        { to: "/app/system-admin", label: "Overview & people", end: true, icon: Network },
        { to: "/app/system-admin?tab=activity", label: "Activity trail", icon: Activity },
        { to: "/app/system-admin?tab=responsibilities", label: "Responsibilities", icon: Users },
        { to: "/app/system-admin?tab=dashboards", label: "Dashboards", icon: Gauge },
        { to: "/app/system-admin?tab=workflows", label: "Workflow editor", icon: Workflow },
        { to: "/app/system-admin?tab=versions", label: "Versions & publishing", icon: BadgeCheck },
        { to: "/app/system-admin?tab=audit", label: "Audit & health", icon: ShieldCheck }, { to: "/app/sops?dept=system", label: "SOPs", icon: BookMarked }
      ],
    });
  }

  const legal: ShellNavItem[] = departments.legal
    ? [
        { to: "/app/legal", label: "Overview", end: true, icon: Scale },
        { to: "/app/legal/contracts", label: "Contracts", icon: FileText },
        { to: "/app/legal/partnerships", label: "Partnerships", icon: Handshake },
        { to: "/app/legal/documents", label: "Documents", icon: BookOpen },
        { to: "/app/legal/compliance", label: "Compliance", icon: ShieldCheck }, { to: "/app/sops?dept=legal", label: "SOPs", icon: BookMarked }
      ]
    : [];
  if (legal.length) groups.push({ label: "Legal", items: legal });

  if (departments.talent) groups.push({
    label: "Talent & Campaigns",
    items: [
      { to: "/app/talent", label: "Overview", end: true, icon: Sparkles },
      { to: "/app/talent/roster", label: "Roster", icon: Users },
      { to: "/app/talent/bookings", label: "Bookings", icon: CalendarDays },
      { to: "/app/talent/contracts", label: "Contracts & releases", icon: FileText },
      { to: "/app/talent/campaigns", label: "Campaigns", icon: Megaphone },
      { to: "/app/talent/forecasts", label: "Forecasts", icon: Calculator }, { to: "/app/sops?dept=talent", label: "SOPs", icon: BookMarked }
    ],
  });

  if (departments.relations) groups.push({
    label: "Client Relations",
    items: [
      { to: "/app/relations", label: "Overview", end: true, icon: HeartHandshake },
      { to: "/app/relations/onboarding", label: "Onboarding", icon: UserPlus },
      { to: "/app/relations/log", label: "Contact log", icon: PhoneCall },
      { to: "/app/relations/followups", label: "Follow-ups", icon: ListChecks },
      { to: "/app/relations/renewals", label: "Renewals", icon: RefreshCw },
      { to: "/app/relations/feedback", label: "Feedback", icon: Star }, { to: "/app/sops?dept=relations", label: "SOPs", icon: BookMarked }
    ],
  });

  if (has("admin", "founder", "managing_director", "strategist", "creative_director", "sales_head")) groups.push({
    label: "Strategy",
    items: [
      { to: "/app/strategy", label: "Overview", end: true, icon: Compass },
      { to: "/app/strategy/map", label: "Map builder", icon: Workflow },
      { to: "/app/strategy/goals", label: "Goals & targets", icon: Target },
      { to: "/app/strategy/approvals", label: "Approvals", icon: BadgeCheck, badge: strategyWaiting }, { to: "/app/sops?dept=strategy", label: "SOPs", icon: BookMarked }
    ],
  });

  const ops: ShellNavItem[] = departments.ops
    ? [
        { to: "/app/ops", label: "Overview", end: true, icon: Settings2 },
        { to: "/app/ops/people", label: "People", icon: Users },
        { to: "/app/ops/workload", label: "Workload", icon: Gauge },
        { to: "/app/ops/deadlines", label: "Deadlines", icon: CalendarClock },
        { to: "/app/ops/attendance", label: "Clock-in", icon: Clock },
        { to: "/app/ops/report", label: "Weekly report", icon: FileText },
        { to: "/app/ops/announcements", label: "Announcements", icon: Megaphone },
        { to: "/app/equipment", label: "Equipment", icon: Package }, { to: "/app/sops?dept=ops", label: "SOPs", icon: BookMarked }
      ]
    : [];
  if (ops.length) groups.push({ label: "Management", items: ops });
  else if (canPeople) groups.push({ label: "People", items: [{ to: "/app/ops/people", label: "People", icon: Users }] });

  const winding: ShellNavItem[] = [];
  if (departments.events) winding.push({ to: "/app/events", label: "Events", icon: CalendarDays });
  if (canScan) winding.push({ to: "/app/scan", label: "Gate scanner", icon: ScanLine });
  const money = canSeeFinance || isLeadership;
  const finance: ShellNavItem[] = money
    ? [
        { to: "/app/finance", label: "Overview", end: true, icon: Wallet },
        { to: "/app/finance/cashbook", label: "Cashbook", icon: BookOpen },
        { to: "/app/finance/requests", label: "Requests", icon: HandCoins },
        { to: "/app/finance/payments", label: "Payments", icon: Banknote },
        { to: "/app/finance/monthly", label: "This month", icon: CalendarDays },
        { to: "/app/finance/loans", label: "Loans", icon: Landmark },
        { to: "/app/finance/budgets", label: "Budgets", icon: PieChart },
        { to: "/app/finance/invoices", label: "Invoices", icon: FileText },
        { to: "/app/finance/filing", label: "Filing", icon: FileText },
        { to: "/app/finance/projections", label: "Projections", icon: PieChart },
        { to: "/app/finance/reports", label: "Reports", icon: FileText },
        { to: "/app/finance/lookup", label: "Look up", icon: Search }, { to: "/app/sops?dept=finance", label: "SOPs", icon: BookMarked }
      ]
    : [{ to: "/app/finance/requests", label: "Requests", icon: HandCoins }, { to: "/app/sops?dept=finance", label: "SOPs", icon: BookMarked }];
  groups.push({ label: "Finance", items: finance });

  if (winding.length) groups.push({ label: "Winding down", items: winding });

  return groups;
}


const SIDEBAR_SCROLL_KEY = "site99:sidebar-scroll";
const SIDEBAR_GROUPS_KEY = "site99:sidebar-groups";

function itemIsActive(item: ShellNavItem, pathname: string, search: string) {
  const [itemPath, itemQuery] = item.to.split("?");
  return itemQuery
    ? pathname === itemPath && search.includes(itemQuery)
    : item.end
    ? pathname === item.to && (!item.to.startsWith("/app/system-admin") || !search)
    : pathname.startsWith(item.to);
}

function readOpenGroups(): Record<string, boolean> {
  try {
    return JSON.parse(sessionStorage.getItem(SIDEBAR_GROUPS_KEY) || "{}") as Record<string, boolean>;
  } catch {
    return {};
  }
}

function ShellSidebar({ groups, compact = false, profileTo, onSignOut }: { groups: ShellNavGroup[]; compact?: boolean; profileTo: string; onSignOut: () => void }) {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const { pathname, search } = useLocation();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [pathname, search, isMobile, setOpenMobile]);

  // The shell remounts on every route change, so keep the menu where it was.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const saved = Number(sessionStorage.getItem(SIDEBAR_SCROLL_KEY) || "0");
    if (saved > 0) el.scrollTop = saved;
    const onScroll = () => sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(el.scrollTop));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Section containing the current page is always open; "Overview" and the
  // first group start open; everything else starts closed. Choices are
  // remembered per browser session so navigating doesn't re-collapse them.
  const activeLabel = groups.find((g) => g.items.some((i) => itemIsActive(i, pathname, search)))?.label;
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const saved = readOpenGroups();
    const next: Record<string, boolean> = {};
    groups.forEach((g, i) => {
      next[g.label] = saved[g.label] ?? (g.label === "Overview" || i === 0);
    });
    return next;
  });

  const toggleGroup = (label: string, next: boolean) => {
    setOpen((prev) => {
      const merged = { ...prev, [label]: next };
      sessionStorage.setItem(SIDEBAR_GROUPS_KEY, JSON.stringify(merged));
      return merged;
    });
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-rule">
      <SidebarContent ref={scrollRef} className="bg-paper pt-[env(safe-area-inset-top)]">
        {groups.map((group) => {
          const isOpen = collapsed || open[group.label] || group.label === activeLabel;
          return (
          <Collapsible
            key={group.label}
            open={isOpen}
            onOpenChange={(next) => toggleGroup(group.label, next)}
            className="group/collapsible"
          >
          <SidebarGroup className={compact ? "py-1" : undefined}>
            {!collapsed && (
              <SidebarGroupLabel asChild className="eyebrow text-ink-faint">
                <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:text-ink focus-ring">
                  <span>{group.label}</span>
                  <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", !isOpen && "-rotate-90")} />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
            )}
            <CollapsibleContent forceMount={collapsed ? true : undefined}>
            <SidebarGroupContent>
              <SidebarMenu className={compact ? "gap-0" : undefined}>
                {group.items.map((item) => {
                  const active = itemIsActive(item, pathname, search);
                  const Icon = item.icon ?? LayoutDashboard;
                  return (
                    <SidebarMenuItem key={`${group.label}-${item.to}-${item.label}`}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                        <NavLink
                          to={item.to}
                          end={item.end}
                                                    className={cn(
                            "group relative flex min-h-11 items-center gap-2.5 rounded-full px-3 py-2 text-sm font-medium transition-all focus-ring md:min-h-0",
                            compact && "md:py-1.5 md:text-[13px]",
                            active
                              ? "bg-acc-violet-soft text-acc-violet"
                              : "text-ink-soft hover:text-ink hover:bg-paper-sunken"
                          )}
                        >
                          {active && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-1 rounded-full bg-signal" />
                          )}
                          <Icon
                            className={cn(
                              "h-4 w-4 shrink-0 transition-transform",
                              !active && "group-hover:scale-110"
                            )}
                          />
                          {!collapsed && <span className="truncate">{item.label}</span>}
                          {!!item.badge && (
                            <span
                              className={cn(
                                "ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-signal px-1.5 text-[10px] font-bold text-paper",
                                collapsed && "absolute right-1 top-1 ml-0 h-4 min-w-4 px-1 text-[9px]"
                              )}
                            >
                              {item.badge > 99 ? "99+" : item.badge}
                            </span>
                          )}
                        </NavLink>

                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
          </Collapsible>
          );
        })}
      </SidebarContent>
      {isMobile && (
        <SidebarFooter className="border-t border-rule bg-paper p-3 pb-[calc(.75rem+env(safe-area-inset-bottom))]">
          <Link to={profileTo} className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-ink-soft hover:bg-paper-sunken hover:text-ink focus-ring">
            <UserCog className="h-4 w-4" /> Profile & settings
          </Link>
          <Button variant="ghost" className="min-h-11 justify-start gap-3 px-3 text-ink-soft" onClick={onSignOut}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}

const ShellCtx = createContext<((eyebrow: string) => void) | null>(null);

/** Stays mounted across every /app page so the menu never rebuilds or jumps. */
export function AppLayout() {
  const { loading } = useMyRoles();
  const [eyebrow, setEyebrow] = useState("Operating system");
  if (loading) return <AccessLoading />;
  return (
    <ShellCtx.Provider value={setEyebrow}>
      <ShellFrame eyebrow={eyebrow}>
        <Outlet />
      </ShellFrame>
    </ShellCtx.Provider>
  );
}

export function AppShell({
  children,
  eyebrow = "Operating system",
  nav,
}: {
  children: ReactNode;
  eyebrow?: string;
  nav?: ShellNavItem[];
}) {
  const setEyebrow = useContext(ShellCtx);
  useEffect(() => {
    setEyebrow?.(eyebrow);
  }, [setEyebrow, eyebrow]);
  if (setEyebrow) return <>{children}</>;
  return <ShellFrame eyebrow={eyebrow} nav={nav}>{children}</ShellFrame>;
}

function ShellFrame({
  children,
  eyebrow,
  nav,
}: {
  children: ReactNode;
  eyebrow: string;
  nav?: ShellNavItem[];
}) {
  const navigate = useNavigate();
  const { displayName, email, title, userId, isStaff, isClient, talentId } = useMyRoles();
  const groups = useNavGroups(nav);
  useActivityTracker(isStaff ? "staff" : "client");

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  const name = displayName || email || "Site 99";
  const homeTo = isStaff ? "/app" : isClient ? "/portal" : talentId ? "/talent-portal" : "/";
  const workTo = isStaff ? "/app/todo" : isClient ? "/portal/work" : talentId ? "/talent-portal/bookings" : homeTo;
  const chatTo = isStaff ? "/app/chat" : isClient ? "/portal/chat" : talentId ? "/talent-portal/contracts" : homeTo;
  const profileTo = isStaff ? "/app/settings" : homeTo;

  // Appearance: dark by default, per-person preference remembered on the account.
  const [theme, setThemeState] = useState<ThemeMode>(readTheme());

  useEffect(() => onThemeChange(setThemeState), []);

  useEffect(() => {
    if (theme !== "system" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => setThemeState("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  // Pull the saved choice once we know who is signed in.
  const [navDensity, setNavDensity] = useState<"comfortable" | "compact">("comfortable");
  useEffect(() => {
    if (!userId) return;
    let cancel = false;
    (async () => {
      const { data } = await supabase.from("team_members").select("theme, nav_density").eq("user_id", userId).maybeSingle();
      const row = data as { theme?: string; nav_density?: string } | null;
      if (cancel) return;
      if (row?.theme === "dark" || row?.theme === "light" || row?.theme === "system") setTheme(row.theme);
      if (row?.nav_density === "compact" || row?.nav_density === "comfortable") setNavDensity(row.nav_density);
    })();
    return () => {
      cancel = true;
    };
  }, [userId]);

  // Drawers, dialogs and menus render into <body>, outside the shell,
  // so the deck tokens have to live on <body> while the app is open.
  useEffect(() => {
    applyThemeClasses(document.body, theme);
    return () => document.body.classList.remove("deck", "deck-light");
  }, [theme]);

  const light = resolveTheme(theme) === "light";

  return (
    <SidebarProvider>
      <div
        className={cn(
          "deck deck-grid min-h-screen flex w-full bg-paper text-ink",
          light && "deck-light"
        )}
      >
        {groups.length > 0 && <ShellSidebar groups={groups} compact={navDensity === "compact"} profileTo={profileTo} onSignOut={signOut} />}

        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-40 h-[calc(3.5rem+env(safe-area-inset-top))] rule-b bg-paper/95 px-2.5 pt-[env(safe-area-inset-top)] backdrop-blur flex items-center gap-2 md:h-16 md:gap-3 md:px-6 md:pt-0">
            {groups.length > 0 && <SidebarTrigger className="focus-ring" />}
            <Link to="/" className="shrink-0 focus-ring rounded-md">
              <img src={logo} alt="Site 99" className="h-8 w-auto md:h-12" />
            </Link>
            <span className="hidden sm:block h-8 w-px bg-rule" aria-hidden />
            <div className="hidden min-w-0 flex-col justify-center sm:flex">
              <span className="text-sm md:text-base font-semibold leading-tight truncate max-w-[180px] md:max-w-[280px]">
                {name}
              </span>
              <span className="text-[11px] leading-tight text-ink-faint truncate max-w-[180px] md:max-w-[280px]">
                {title || eyebrow}
              </span>
            </div>
            <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2 xl:gap-5">
              <span className="hidden lg:inline-flex"><HelpButton /></span>
              {userId && <span className="hidden lg:inline-flex"><NotificationBell /></span>}
              <Link
                to="/app/calendar"
                className="hidden xl:inline-flex items-center gap-1.5 rounded-full border border-rule px-3 py-1.5 eyebrow text-[10px] text-ink-soft hover:text-signal hover:border-signal/50 focus-ring"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Calendar
              </Link>
              <span className="hidden xl:inline-flex"><HeaderClock /></span>
              <span className="hidden lg:block h-8 w-px bg-rule" aria-hidden />
              <Link
                to="/app/settings"
                title="My settings"
                aria-label="My settings"
                className="h-9 w-9 shrink-0 rounded-full bg-acc-violet-soft text-acc-violet grid place-items-center text-xs font-semibold focus-ring hover:text-signal"
              >
                {name
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((p) => p[0]?.toUpperCase() ?? "")
                  .join("") || "S9"}
              </Link>
              <button
                onClick={signOut}
                className="hidden min-h-11 items-center gap-1 px-2 text-ink-soft hover:text-signal focus-ring xl:inline-flex"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </header>


          <main className="mobile-page flex-1 min-w-0 overflow-x-clip px-3 pb-[calc(5.75rem+env(safe-area-inset-bottom))] pt-4 sm:px-4 md:px-8 md:py-8">{children}</main>

          {groups.length > 0 && (
            <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-rule bg-paper/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Quick navigation">
              <MobileNavItem to={homeTo} label="Home" icon={Home} />
              <MobileNavItem to={workTo} label={isStaff ? "To-Do" : talentId ? "Bookings" : "Work"} icon={ListChecks} />
              <MobileNavItem to={chatTo} label={talentId && !isStaff ? "Contracts" : "Chat"} icon={talentId && !isStaff ? FileText : MessageCircle} />
              <div className="grid min-h-14 place-items-center"><NotificationBell /></div>
              <MobileNavItem to={profileTo} label="Profile" icon={UserCog} />
            </nav>
          )}
        </div>
      </div>
    </SidebarProvider>
  );
}

function MobileNavItem({ to, label, icon: Icon }: { to: string; label: string; icon: typeof Home }) {
  return (
    <NavLink to={to} end={to === "/app" || to === "/portal" || to === "/talent-portal"} className={({ isActive }) => cn("flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium text-ink-faint focus-ring", isActive && "text-signal")}>
      <Icon className="h-4 w-4" />
      <span className="max-w-full truncate">{label}</span>
    </NavLink>
  );
}

export default AppShell;

import { ReactNode, useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import {
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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import HeaderClock from "@/components/deck/HeaderClock";
import CalendarReminderBell from "@/components/calendar/CalendarReminderBell";
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

export type ShellNavItem = { to: string; label: string; end?: boolean; icon?: typeof LayoutDashboard; badge?: number };
type ShellNavGroup = { label: string; items: ShellNavItem[] };

function useNavGroups(nav?: ShellNavItem[]): ShellNavGroup[] {
  const { isStaff, isClient, departments, canScan, isLeadership, canSeeFinance, has } = useMyRoles();
  const strategyWaiting = useStrategyWaiting(isLeadership);
  const approvalsWaiting = useApprovalsWaiting();
  const { items: todoItems } = useTodo();
  const chatUnread = useChatUnread();
  const communicationUnread = useCommunicationUnread();

  if (nav) return [{ label: "Menu", items: nav }];

  if (isClient && !isStaff) {
    return [
      {
        label: "Menu",
        items: [
          { to: "/portal", label: "Dashboard", end: true, icon: LayoutDashboard },
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
          { to: "/app/chat", label: "Chat", icon: MessageCircle, badge: chatUnread },
          { to: "/app/briefs", label: "Briefs", icon: FileText, badge: communicationUnread.briefs },
          { to: "/app/announcements", label: "Announcements", icon: Megaphone, badge: communicationUnread.announcements },
        { to: "/app/approvals", label: "Approvals", icon: BadgeCheck, badge: approvalsWaiting },
        { to: "/app/calendar", label: "Calendar", icon: CalendarDays },
        { to: "/app/settings", label: "My settings", icon: UserCog },
      ],
    },

  ];

  const dept: ShellNavItem[] = [];
  if (departments.content) dept.push({ to: "/app/content", label: "Content & strategy", icon: Clapperboard });
  if (departments.content) dept.push({ to: "/app/shoots", label: "Shoot days", icon: Camera });
  if (departments.clients) dept.push({ to: "/app/residents", label: "Residents", icon: Handshake });
  if (departments.sales) dept.push({ to: "/app/sales", label: "Sales", icon: TrendingUp });
  if (departments.site) dept.push({ to: "/app/site", label: "Site editing", icon: PenSquare });
  if (isLeadership) dept.push({ to: "/app/team", label: "Team & access", icon: Users });
  if (has("admin")) dept.push({ to: "/app/system-admin", label: "System administration", icon: Network });
  if (dept.length) groups.push({ label: "Departments", items: dept });

  const legal: ShellNavItem[] = departments.legal
    ? [
        { to: "/app/legal", label: "Overview", end: true, icon: Scale },
        { to: "/app/legal/contracts", label: "Contracts", icon: FileText },
        { to: "/app/legal/partnerships", label: "Partnerships", icon: Handshake },
        { to: "/app/legal/documents", label: "Documents", icon: BookOpen },
        { to: "/app/legal/compliance", label: "Compliance", icon: ShieldCheck },
      ]
    : [];
  if (legal.length) groups.push({ label: "Legal", items: legal });

  groups.push({
    label: "Strategy",
    items: [
      { to: "/app/strategy", label: "Overview", end: true, icon: Compass },
      { to: "/app/strategy/map", label: "Map builder", icon: Workflow },
      { to: "/app/strategy/goals", label: "Goals & targets", icon: Target },
      { to: "/app/strategy/approvals", label: "Approvals", icon: BadgeCheck, badge: strategyWaiting },
    ],
  });

  const ops: ShellNavItem[] = departments.ops
    ? [
        { to: "/app/ops", label: "Overview", end: true, icon: Settings2 },
        { to: "/app/ops/people", label: "People", icon: Users },
        { to: "/app/ops/workload", label: "Workload", icon: Gauge },
        { to: "/app/ops/deadlines", label: "Deadlines", icon: CalendarClock },
        { to: "/app/ops/report", label: "Weekly report", icon: FileText },
        { to: "/app/ops/announcements", label: "Announcements", icon: Megaphone },
        { to: "/app/equipment", label: "Equipment", icon: Package },
      ]
    : [];
  if (ops.length) groups.push({ label: "Management", items: ops });

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
        { to: "/app/finance/reports", label: "Reports", icon: FileText },
        { to: "/app/finance/lookup", label: "Look up", icon: Search },
      ]
    : [{ to: "/app/finance/requests", label: "Requests", icon: HandCoins }];
  groups.push({ label: "Finance", items: finance });

  if (winding.length) groups.push({ label: "Winding down", items: winding });

  return groups;
}


const SIDEBAR_SCROLL_KEY = "site99:sidebar-scroll";

function ShellSidebar({ groups }: { groups: ShellNavGroup[] }) {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const { pathname } = useLocation();
  const scrollRef = useRef<HTMLDivElement | null>(null);

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

  return (
    <Sidebar collapsible="icon" className="border-r border-rule">
      <SidebarContent ref={scrollRef} className="bg-paper">
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            {!collapsed && <SidebarGroupLabel className="eyebrow text-ink-faint">{group.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = item.end ? pathname === item.to : pathname.startsWith(item.to);
                  const Icon = item.icon ?? LayoutDashboard;
                  return (
                    <SidebarMenuItem key={`${group.label}-${item.to}-${item.label}`}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                        <NavLink
                          to={item.to}
                          end={item.end}
                          onClick={() => isMobile && setOpenMobile(false)}
                          className={cn(
                            "group relative flex items-center gap-2.5 rounded-full px-3 py-2 text-sm font-medium transition-all focus-ring",
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
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
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
  const navigate = useNavigate();
  const { displayName, email, title, userId } = useMyRoles();
  const groups = useNavGroups(nav);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  const name = displayName || email || "Site 99";

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
  useEffect(() => {
    if (!userId) return;
    let cancel = false;
    (async () => {
      const { data } = await supabase.from("team_members").select("theme").eq("user_id", userId).maybeSingle();
      const saved = (data as { theme?: string } | null)?.theme;
      if (cancel) return;
      if (saved === "dark" || saved === "light" || saved === "system") setTheme(saved);
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
        {groups.length > 0 && <ShellSidebar groups={groups} />}

        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-40 h-16 rule-b bg-paper/95 backdrop-blur flex items-center gap-3 px-3 md:px-6">
            {groups.length > 0 && <SidebarTrigger className="focus-ring" />}
            <Link to="/" className="shrink-0 focus-ring rounded-md">
              <img src={logo} alt="Site 99" className="h-11 md:h-12 w-auto" />
            </Link>
            <span className="hidden sm:block h-8 w-px bg-rule" aria-hidden />
            <div className="flex flex-col justify-center min-w-0">
              <span className="text-sm md:text-base font-semibold leading-tight truncate max-w-[180px] md:max-w-[280px]">
                {name}
              </span>
              <span className="text-[11px] leading-tight text-ink-faint truncate max-w-[180px] md:max-w-[280px]">
                {title || eyebrow}
              </span>
            </div>
            <div className="ml-auto flex items-center gap-3 md:gap-5 min-w-0">
              {userId && <CalendarReminderBell />}
              <Link
                to="/app/calendar"
                className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-rule px-3 py-1.5 eyebrow text-[10px] text-ink-soft hover:text-signal hover:border-signal/50 focus-ring"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Calendar
              </Link>
              <HeaderClock />
              <span className="hidden md:block h-8 w-px bg-rule" aria-hidden />
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
                className="eyebrow text-ink-soft hover:text-signal px-2 focus-ring inline-flex items-center gap-1"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </header>


          <main className="flex-1 px-4 md:px-8 py-8 min-w-0">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default AppShell;

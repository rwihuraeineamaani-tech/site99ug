import { ReactNode } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarDays,
  ScanLine,
  PenSquare,
  Users,
  Briefcase,
  Wallet,
  Scale,
  LogOut,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useMyRoles, ROLE_LABELS, type StaffRole } from "@/hooks/useMyRoles";
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

export type ShellNavItem = { to: string; label: string; end?: boolean; icon?: typeof LayoutDashboard };
type ShellNavGroup = { label: string; items: ShellNavItem[] };

function useNavGroups(nav?: ShellNavItem[]): ShellNavGroup[] {
  const { isStaff, isClient, canSeeFinance, canManageEvents, canViewEvents, canScan, canEditSite, isLeadership } =
    useMyRoles();

  if (nav) return [{ label: "Menu", items: nav }];

  if (isClient && !isStaff) {
    return [
      {
        label: "Menu",
        items: [{ to: "/portal", label: "Dashboard", end: true, icon: LayoutDashboard }],
      },
    ];
  }

  if (!isStaff) return [];

  const groups: ShellNavGroup[] = [
    { label: "Overview", items: [{ to: "/app", label: "Dashboard", end: true, icon: LayoutDashboard }] },
  ];

  const work: ShellNavItem[] = [];
  if (canManageEvents || canViewEvents) work.push({ to: "/app/events", label: "Events", icon: CalendarDays });
  if (canScan) work.push({ to: "/app/scan", label: "Gate scanner", icon: ScanLine });
  if (canEditSite) work.push({ to: "/admin", label: "Public site", icon: PenSquare });
  if (work.length) groups.push({ label: "Work", items: work });

  if (canSeeFinance) {
    groups.push({
      label: "Money",
      items: [{ to: "/app/events", label: "Ticket revenue", icon: Wallet }],
    });
  }

  const org: ShellNavItem[] = [];
  if (isLeadership) org.push({ to: "/app/team", label: "Team & access", icon: Users });
  org.push({ to: "/services", label: "Services", icon: Briefcase });
  org.push({ to: "/about", label: "About Site 99", icon: Scale });
  groups.push({ label: "Organisation", items: org });

  return groups;
}

function ShellSidebar({ groups }: { groups: ShellNavGroup[] }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();

  return (
    <Sidebar collapsible="icon" className="border-r border-rule">
      <SidebarContent className="bg-paper">
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
                          className={cn(
                            "flex items-center gap-2 rounded-sm px-3 py-2 text-sm transition-colors focus-ring",
                            active ? "bg-ink text-paper" : "text-ink-soft hover:text-ink hover:bg-paper-sunken"
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          {!collapsed && <span className="truncate">{item.label}</span>}
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
  const { roles, email } = useMyRoles();
  const groups = useNavGroups(nav);

  const roleLine = roles
    .filter((r): r is StaffRole => r in ROLE_LABELS)
    .map((r) => ROLE_LABELS[r])
    .join(" · ");

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-paper text-ink">
        {groups.length > 0 && <ShellSidebar groups={groups} />}

        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-40 h-14 rule-b bg-paper/95 backdrop-blur flex items-center gap-3 px-3 md:px-6">
            {groups.length > 0 && <SidebarTrigger className="focus-ring" />}
            <Link to="/" className="shrink-0">
              <img src={logo} alt="Site 99" className="h-8 w-auto" />
            </Link>
            <span className="eyebrow text-ink-faint hidden sm:inline">{eyebrow}</span>
            <div className="ml-auto flex items-center gap-3 min-w-0">
              <span className="hidden md:block text-right min-w-0">
                <span className="block text-xs truncate max-w-[220px]">{email}</span>
                {roleLine && <span className="block eyebrow text-ink-faint truncate max-w-[220px]">{roleLine}</span>}
              </span>
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

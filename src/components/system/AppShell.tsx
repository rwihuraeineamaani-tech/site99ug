import { ReactNode } from "react";
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
  LogOut,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useMyRoles } from "@/hooks/useMyRoles";
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
  const { isStaff, isClient, departments, canScan, isLeadership } = useMyRoles();

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

  const dept: ShellNavItem[] = [];
  if (departments.content) dept.push({ to: "/app/content", label: "Content & strategy", icon: Clapperboard });
  if (departments.clients) dept.push({ to: "/app/clients", label: "Client relations", icon: Handshake });
  if (departments.sales) dept.push({ to: "/app/sales", label: "Sales", icon: TrendingUp });
  if (departments.legal) dept.push({ to: "/app/legal", label: "Legal & contracts", icon: Scale });
  if (departments.ops) dept.push({ to: "/app/ops", label: "Management & ops", icon: Settings2 });
  if (departments.finance) dept.push({ to: "/app/finance", label: "Finance", icon: Wallet });
  if (departments.site) dept.push({ to: "/app/site", label: "Site editing", icon: PenSquare });
  if (isLeadership) dept.push({ to: "/app/team", label: "Team & access", icon: Users });
  if (dept.length) groups.push({ label: "Departments", items: dept });

  const winding: ShellNavItem[] = [];
  if (departments.events) winding.push({ to: "/app/events", label: "Events", icon: CalendarDays });
  if (canScan) winding.push({ to: "/app/scan", label: "Gate scanner", icon: ScanLine });
  if (winding.length) groups.push({ label: "Winding down", items: winding });

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
  const { displayName, email, title } = useMyRoles();
  const groups = useNavGroups(nav);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  const name = displayName || email || "Site 99";

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
            <div className="flex flex-col justify-center min-w-0">
              <span className="text-sm font-semibold leading-tight truncate max-w-[200px] md:max-w-[280px]">
                {name}
              </span>
              {title && (
                <span className="text-[11px] leading-tight text-ink-faint truncate max-w-[200px] md:max-w-[280px]">
                  {title}
                </span>
              )}
            </div>
            <span className="eyebrow text-ink-faint hidden sm:inline ml-auto">{eyebrow}</span>
            <div className="ml-auto sm:ml-0 flex items-center gap-3 min-w-0">
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

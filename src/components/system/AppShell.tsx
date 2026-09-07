import { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useMyRoles, ROLE_LABELS, type StaffRole } from "@/hooks/useMyRoles";
import logo from "@/assets/site99-logo.png";

export type ShellNavItem = { to: string; label: string; end?: boolean };

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
  const { roles, email, isStaff, isClient, canSeeFinance, canManageEvents, canScan, canEditSite, isLeadership } =
    useMyRoles();

  const items: ShellNavItem[] =
    nav ??
    (isStaff
      ? [
          { to: "/app", label: "Overview", end: true },
          ...(canManageEvents || canScan ? [{ to: "/admin/events", label: "Events" }] : []),
          ...(canScan ? [{ to: "/admin/scan", label: "Gate scanner" }] : []),
          ...(canEditSite ? [{ to: "/admin", label: "Public site" }] : []),
          ...(isLeadership ? [{ to: "/app/team", label: "Team & access" }] : []),
        ]
      : isClient
      ? [{ to: "/portal", label: "My engagement", end: true }]
      : []);

  const roleLine = roles
    .filter((r): r is StaffRole => r in ROLE_LABELS)
    .map((r) => ROLE_LABELS[r])
    .join(" · ");

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  const link = ({ isActive }: { isActive: boolean }) =>
    cn(
      "block rounded-sm px-3 py-2 eyebrow transition-colors focus-ring",
      isActive ? "bg-ink text-paper" : "text-ink-soft hover:text-ink hover:bg-paper-sunken"
    );

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <header className="sticky top-0 z-40 h-14 rule-b bg-paper/95 backdrop-blur flex items-center gap-4 px-4 md:px-6">
        <Link to="/" className="shrink-0">
          <img src={logo} alt="Site 99" className="h-8 w-auto" />
        </Link>
        <span className="eyebrow text-ink-faint hidden sm:inline">{eyebrow}</span>
        <div className="ml-auto flex items-center gap-3 min-w-0">
          <span className="hidden md:block text-right min-w-0">
            <span className="block text-xs truncate max-w-[220px]">{email}</span>
            {roleLine && <span className="block eyebrow text-ink-faint truncate max-w-[220px]">{roleLine}</span>}
          </span>
          <button onClick={signOut} className="eyebrow text-ink-soft hover:text-signal px-2 focus-ring">
            Sign out
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-w-0">
        {items.length > 0 && (
          <aside className="hidden lg:block w-56 shrink-0 border-r border-rule p-3">
            <div className="sticky top-[4.5rem] space-y-1">
              {items.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end} className={link}>
                  {n.label}
                </NavLink>
              ))}
              {canSeeFinance && (
                <div className="pt-4 eyebrow text-ink-faint px-3">Finance access on</div>
              )}
            </div>
          </aside>
        )}

        <div className="flex-1 min-w-0">
          {items.length > 0 && (
            <div className="lg:hidden rule-b overflow-x-auto scrollbar-none">
              <div className="flex gap-1 p-2 w-max">
                {items.map((n) => (
                  <NavLink key={n.to} to={n.to} end={n.end} className={link}>
                    <span className="whitespace-nowrap">{n.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          )}
          <main className="px-4 md:px-8 py-8 min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}

export default AppShell;

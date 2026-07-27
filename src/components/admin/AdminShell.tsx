import { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export type AdminNavItem = {
  key: string;
  label: string;
  badge?: number;
  onClick?: () => void;
  to?: string;
};

type Props = {
  title: string;
  eyebrow?: string;
  nav?: AdminNavItem[];
  active?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function AdminShell({ title, eyebrow = "Console", nav = [], active, actions, children }: Props) {
  const navigate = useNavigate();
  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login", { replace: true });
  };

  const itemClass = (isActive: boolean) =>
    `w-full text-left rounded-md px-3 py-2 mono text-[11px] uppercase tracking-[0.2em] transition-colors flex items-center justify-between gap-2 ${
      isActive
        ? "bg-site-red text-site-white"
        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
    }`;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top bar — replaces the marketing nav so nothing overlaps */}
      <header className="sticky top-0 z-50 h-14 border-b border-border bg-background/95 backdrop-blur flex items-center gap-4 px-4 md:px-6">
        <Link to="/" className="flex items-center gap-2 shrink-0" data-hover>
          <img
            src={new URL("../../assets/site99-logo.png", import.meta.url).href}
            alt="Site 99"
            className="h-8 w-auto"
          />
        </Link>
        <span className="mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground hidden sm:inline">
          {eyebrow}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {actions}
          <button
            onClick={signOut}
            className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-site-red px-2"
            data-hover
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-w-0">
        {/* Sidebar (desktop) */}
        {nav.length > 0 && (
          <aside className="hidden lg:block w-56 shrink-0 border-r border-border p-3">
            <div className="sticky top-[4.5rem] space-y-1">
              {nav.map((n) =>
                n.to ? (
                  <Link key={n.key} to={n.to} className={itemClass(false)} data-hover>
                    {n.label}
                  </Link>
                ) : (
                  <button key={n.key} onClick={n.onClick} className={itemClass(active === n.key)} data-hover>
                    <span>{n.label}</span>
                    {!!n.badge && (
                      <span className="rounded-full bg-site-red text-site-white px-1.5 py-0.5 text-[9px] leading-none">
                        {n.badge}
                      </span>
                    )}
                  </button>
                )
              )}
            </div>
          </aside>
        )}

        <div className="flex-1 min-w-0">
          {/* Mobile nav strip */}
          {nav.length > 0 && (
            <div className="lg:hidden border-b border-border overflow-x-auto scrollbar-none">
              <div className="flex gap-1 p-2 w-max">
                {nav.map((n) =>
                  n.to ? (
                    <Link key={n.key} to={n.to} className={`${itemClass(false)} w-auto whitespace-nowrap`} data-hover>
                      {n.label}
                    </Link>
                  ) : (
                    <button
                      key={n.key}
                      onClick={n.onClick}
                      className={`${itemClass(active === n.key)} w-auto whitespace-nowrap`}
                      data-hover
                    >
                      <span>{n.label}</span>
                      {!!n.badge && <span className="text-[9px]">({n.badge})</span>}
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          <main className="px-4 md:px-8 py-8 min-w-0">
            <h1 className="display text-3xl md:text-4xl mb-6">{title}</h1>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

export default AdminShell;

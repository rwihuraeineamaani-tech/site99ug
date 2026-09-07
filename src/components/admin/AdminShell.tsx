import { ReactNode } from "react";
import { Link } from "react-router-dom";
import AppShell from "@/components/system/AppShell";
import { cn } from "@/lib/utils";

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

/**
 * Legacy console shell — now rendered inside the team system shell so every
 * module shares one sidebar. `nav` becomes an in-page tab strip.
 */
export function AdminShell({ title, eyebrow = "Console", nav = [], active, actions, children }: Props) {
  const tabClass = (isActive: boolean) =>
    cn(
      "rounded-sm px-3 py-2 eyebrow transition-colors focus-ring flex items-center gap-2 whitespace-nowrap",
      isActive ? "bg-ink text-paper" : "text-ink-soft hover:text-ink hover:bg-paper-sunken"
    );

  return (
    <AppShell eyebrow={eyebrow}>
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <h1 className="display text-3xl md:text-4xl">{title}</h1>
        {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
      </div>

      {nav.length > 0 && (
        <div className="rule-b mb-6 overflow-x-auto scrollbar-none">
          <div className="flex gap-1 pb-2 w-max">
            {nav.map((n) =>
              n.to ? (
                <Link key={n.key} to={n.to} className={tabClass(false)}>
                  {n.label}
                </Link>
              ) : (
                <button key={n.key} onClick={n.onClick} className={tabClass(active === n.key)}>
                  <span>{n.label}</span>
                  {!!n.badge && (
                    <span className="rounded-full bg-signal text-paper px-1.5 py-0.5 text-[9px] leading-none">
                      {n.badge}
                    </span>
                  )}
                </button>
              )
            )}
          </div>
        </div>
      )}

      {children}
    </AppShell>
  );
}

export default AdminShell;

import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import AppShell from "@/components/system/AppShell";
import { cn } from "@/lib/utils";

export type AdminNavItem = {
  key: string;
  label: string;
  badge?: number;
  icon?: ReactNode;
  onClick?: () => void;
  to?: string;
};

type Props = {
  title: string;
  eyebrow?: string;
  nav?: AdminNavItem[];
  active?: string;
  actions?: ReactNode;
  layout?: "tabs" | "sidebar";
  children: ReactNode;
};

/**
 * Legacy console shell — now rendered inside the team system shell so every
 * module shares one sidebar. `nav` becomes an in-page tab strip.
 */
export function AdminShell({ title, eyebrow = "Console", nav = [], active, actions, layout = "tabs", children }: Props) {
  const tabClass = (isActive: boolean) =>
    cn(
      "rounded-sm px-3 py-2 eyebrow transition-colors focus-ring flex items-center gap-2 whitespace-nowrap",
      isActive ? "bg-ink text-paper" : "text-ink-soft hover:text-ink hover:bg-paper-sunken"
    );

  const activeLabel = nav.find((item) => item.key === active)?.label ?? "Choose a section";
  const sidebarNav = (
    <nav aria-label={`${title} sections`} className="space-y-1">
      {nav.map((item, index) => {
        const classes = cn(
          "group flex min-h-11 w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left text-sm transition-colors focus-ring",
          active === item.key
            ? "border-signal/50 bg-signal/10 text-ink"
            : "border-transparent text-ink-soft hover:border-rule hover:bg-paper-sunken hover:text-ink"
        );
        const content = <>
          <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-sm border border-rule bg-paper-sunken text-ink-faint", active === item.key && "border-signal/40 text-signal")}>{item.icon ?? String(index + 1).padStart(2, "0")}</span>
          <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
          {!!item.badge && <span className="rounded-full bg-signal px-2 py-0.5 text-[10px] font-semibold text-paper">{item.badge}</span>}
        </>;
        return item.to ? <Link key={item.key} to={item.to} className={classes}>{content}</Link> : <button key={item.key} type="button" onClick={item.onClick} className={classes}>{content}</button>;
      })}
    </nav>
  );

  return (
    <AppShell eyebrow={eyebrow}>
      <div className="mb-6 flex flex-wrap items-end gap-4 border-b border-rule pb-5">
        <div>
          <p className="eyebrow mb-2 text-signal">Website workspace</p>
          <h1 className="text-3xl font-black md:text-4xl">{title}</h1>
        </div>
        {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
      </div>

      {nav.length > 0 && layout === "tabs" && (
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
      {layout === "sidebar" && nav.length > 0 ? (
        <div className="grid min-w-0 gap-5 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-4 rounded-md border border-rule bg-paper-raised p-2">
              <p className="eyebrow px-3 pb-3 pt-2 text-ink-faint">Edit website</p>
              {sidebarNav}
            </div>
          </aside>
          <div className="lg:hidden">
            <details className="group rounded-md border border-rule bg-paper-raised">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-sm font-semibold focus-ring">
                <span>{activeLabel}</span><ChevronDown className="h-4 w-4 text-ink-faint transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-t border-rule p-2">{sidebarNav}</div>
            </details>
          </div>
          <main className="min-w-0">{children}</main>
        </div>
      ) : children}
    </AppShell>
  );
}

export default AdminShell;

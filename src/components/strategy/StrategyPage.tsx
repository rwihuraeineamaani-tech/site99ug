import { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import Seo from "@/components/Seo";
import AppShell from "@/components/system/AppShell";
import { PageHeader } from "@/components/system";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/app/strategy", label: "Overview", end: true },
  { to: "/app/strategy/map", label: "Map builder" },
  { to: "/app/strategy/goals", label: "Goals & targets" },
  { to: "/app/strategy/approvals", label: "Approvals" },
];

export default function StrategyPage({
  title,
  lede,
  path,
  actions,
  children,
}: {
  title: string;
  lede: string;
  path: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <AppShell>
      <Seo title={`${title} — Strategy — Site 99`} description={lede} path={path} noindex />
      <PageHeader eyebrow="Strategy" title={title} lede={lede} actions={actions} />
      <nav className="flex flex-wrap gap-1 mb-8 no-print">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              cn(
                "press focus-ring rounded-full px-4 py-1.5 text-xs tracking-wide border",
                isActive
                  ? "border-transparent bg-ink text-paper"
                  : "border-rule text-ink-soft hover:text-ink"
              )
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
      {children}
    </AppShell>
  );
}

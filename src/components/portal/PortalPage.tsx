import { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import Seo from "@/components/Seo";
import AppShell from "@/components/system/AppShell";
import { PageHeader, StatusChip } from "@/components/system";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PortalClient } from "@/hooks/usePortalClient";

const TABS = [
  { to: "/portal", label: "Overview", end: true },
  { to: "/portal/work", label: "Your work" },
  { to: "/portal/shoots", label: "Shoot days" },
  { to: "/portal/money", label: "Money" },
  { to: "/portal/documents", label: "Documents" },
];

export default function PortalPage({
  title,
  lede,
  client,
  loading,
  children,
}: {
  title: string;
  lede?: string;
  client: PortalClient | null;
  loading: boolean;
  children: ReactNode;
}) {
  return (
    <AppShell eyebrow="Client portal">
      <Seo title={`${title} — Site 99`} description="Your Site 99 engagement." path="/portal" noindex />
      <PageHeader
        eyebrow={client?.name ?? "Client portal"}
        title={loading ? "Loading…" : title}
        lede={lede}
        actions={
          client ? (
            <div className="flex items-center gap-2">
              <Link to="/portal/chat">
                <Button size="sm" className="gap-2">
                  <MessageCircle className="h-4 w-4" /> Chat
                </Button>
              </Link>
              <StatusChip value={client.status} />
            </div>
          ) : undefined
        }
      />

      {client && (
        <nav className="-mt-4 mb-8 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                cn(
                  "rounded-full border border-hairline px-4 py-1.5 text-sm transition-colors",
                  isActive ? "bg-signal/15 text-signal border-signal/40" : "text-ink-soft hover:text-ink"
                )
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      )}

      {!loading && !client ? (
        <div className="surface rounded-2xl p-10 text-center text-sm text-ink-soft">
          Your account isn’t linked to an engagement yet. Ask your Site 99 contact to finish the invite.
        </div>
      ) : (
        children
      )}
    </AppShell>
  );
}

export function PortalCard({
  title,
  hint,
  children,
  className,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("surface rounded-2xl p-5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="eyebrow text-ink-faint">{title}</div>
        {hint && <div className="text-xs text-ink-faint">{hint}</div>}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function PortalEmpty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-hairline p-6 text-center text-sm text-ink-soft">{children}</div>;
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Seo from "@/components/Seo";
import AppShell from "@/components/system/AppShell";
import { PageHeader, Metric, SectionHeading } from "@/components/system";
import { useMyRoles, ROLE_LABELS, type StaffRole } from "@/hooks/useMyRoles";

export default function Dashboard() {
  const { roles, canSeeFinance, canManageEvents, canScan, canEditSite, isLeadership, email } = useMyRoles();
  const [clients, setClients] = useState<number | null>(null);
  const [events, setEvents] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ count: c }, { count: e }] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("events").select("id", { count: "exact", head: true }),
      ]);
      if (cancelled) return;
      setClients(c ?? 0);
      setEvents(e ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const titles = roles.filter((r): r is StaffRole => r in ROLE_LABELS).map((r) => ROLE_LABELS[r]);

  const modules = [
    { to: "/admin/events", label: "Events", note: "Ticketing, orders and payouts", on: canManageEvents },
    { to: "/admin/scan", label: "Gate scanner", note: "Check tickets at the door", on: canScan },
    { to: "/admin", label: "Public site", note: "Projects, residents, announcements", on: canEditSite },
    { to: "/app/team", label: "Team & access", note: "Accounts, roles and client logins", on: isLeadership },
  ].filter((m) => m.on);

  return (
    <AppShell>
      <Seo title="Overview — Site 99" description="Site 99 operating system." path="/app" noindex />
      <PageHeader
        eyebrow="Operating system"
        title="Overview."
        lede={`Signed in as ${email ?? "—"}${titles.length ? ` · ${titles.join(" · ")}` : ""}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Clients" value={clients ?? "—"} hint="Records in the system" />
        <Metric label="Events" value={events ?? "—"} hint="Ticketing module" />
        <Metric label="Your access" value={titles.length} hint={titles.join(", ") || "No roles"} />
        <Metric
          label="Money"
          value={canSeeFinance ? "Visible" : "Hidden"}
          tone={canSeeFinance ? "signal" : "default"}
          hint="Payroll, splits and expenses"
        />
      </div>

      <div className="mt-12">
        <SectionHeading index="01" title="Modules" hint={`${modules.length} available to you`} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => (
            <Link key={m.to} to={m.to} className="surface rounded-sm p-5 hover:bg-paper-sunken transition-colors focus-ring">
              <div className="display text-xl">{m.label}</div>
              <div className="mt-2 text-sm text-ink-soft">{m.note}</div>
              <div className="mt-4 eyebrow text-signal">Open →</div>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-12">
        <SectionHeading index="02" title="Coming next" hint="Phase 3" />
        <p className="text-sm text-ink-soft max-w-2xl">
          Clients, contracts, content pipeline, finance and payroll records land next — every module reading the same
          set of records, so a client or contract is only ever typed once.
        </p>
      </div>
    </AppShell>
  );
}

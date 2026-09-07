import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Seo from "@/components/Seo";
import AppShell from "@/components/system/AppShell";
import { PageHeader, Metric, SectionHeading, StatusChip } from "@/components/system";
import { useMyRoles, ROLE_LABELS, type StaffRole } from "@/hooks/useMyRoles";

type ContentRow = {
  id: string;
  title: string;
  stage: string;
  planned_at: string | null;
  updated_at: string;
};

export default function Dashboard() {
  const { roles, canSeeFinance, departments, canScan, isLeadership, email } = useMyRoles();
  const [clients, setClients] = useState<number | null>(null);
  const [events, setEvents] = useState<number | null>(null);
  const [content, setContent] = useState<ContentRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ count: c }, { count: e }, { data: items }] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("events").select("id", { count: "exact", head: true }),
        supabase
          .from("content_items")
          .select("id, title, stage, planned_at, updated_at")
          .not("stage", "in", '("Posted","Archived","Rejected")')
          .order("planned_at", { ascending: true, nullsFirst: false })
          .limit: undefined as never,
      ]);
      if (cancelled) return;
      setClients(c ?? 0);
      setEvents(e ?? 0);
      setContent((items as ContentRow[]) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const titles = roles.filter((r): r is StaffRole => r in ROLE_LABELS).map((r) => ROLE_LABELS[r]);

  const modules = [
    { to: "/app/content", label: "Content & strategy", note: "Idea to posted, per client", on: departments.content },
    { to: "/app/clients", label: "Client relations", note: "Client records and contacts", on: departments.clients },
    { to: "/app/sales", label: "Sales", note: "Leads, proposals and deals", on: departments.sales },
    { to: "/app/legal", label: "Legal & contracts", note: "Contracts, partners, documents", on: departments.legal },
    { to: "/app/ops", label: "Management & ops", note: "People, workload and delivery", on: departments.ops },
    { to: "/app/finance", label: "Finance", note: "Money in, out and payroll", on: departments.finance },
    { to: "/app/site", label: "Site editing", note: "Projects, residents, announcements", on: departments.site },
    { to: "/app/team", label: "Team & access", note: "Accounts, roles and client logins", on: isLeadership },
    { to: "/app/events", label: "Events", note: "Ticketing, orders and payouts", on: departments.events },
    { to: "/app/scan", label: "Gate scanner", note: "Check tickets at the door", on: canScan },
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
        <Metric label="In the pipeline" value={content.length} hint="Content not yet posted" />
        <Metric label="Events" value={events ?? "—"} hint="Winding down" />
        <Metric
          label="Money"
          value={canSeeFinance ? "Visible" : "Hidden"}
          tone={canSeeFinance ? "signal" : "default"}
          hint="Payroll, splits and expenses"
        />
      </div>

      {departments.content && (
        <div className="mt-12">
          <SectionHeading index="01" title="Content in flight" hint={`${content.length} open`} />
          {content.length === 0 ? (
            <p className="text-sm text-ink-soft">
              Nothing in the pipeline yet.{" "}
              <Link to="/app/content" className="text-signal focus-ring">
                Add the first item →
              </Link>
            </p>
          ) : (
            <ul className="surface rounded-sm divide-y divide-rule">
              {content.slice(0, 6).map((i) => (
                <li key={i.id} className="px-4 py-3 flex items-center gap-3">
                  <Link to="/app/content" className="text-sm truncate focus-ring">
                    {i.title}
                  </Link>
                  <StatusChip value={i.stage} className="ml-auto" />
                  <span className="num text-[11px] text-ink-faint w-20 text-right">{i.planned_at ?? "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-12">
        <SectionHeading index="02" title="Departments" hint={`${modules.length} open to you`} />
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
    </AppShell>
  );
}

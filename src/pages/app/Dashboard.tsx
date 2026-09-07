import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Seo from "@/components/Seo";
import AppShell from "@/components/system/AppShell";
import { PageHeader, Metric, SectionHeading, StatusChip } from "@/components/system";
import { useMyRoles, ROLE_LABELS, type StaffRole } from "@/hooks/useMyRoles";
import { refCode } from "@/lib/contentFlow";
import { weekLabel } from "@/lib/weeks";

type ContentRow = {
  id: string;
  title: string;
  stage: string;
  planned_at: string | null;
  updated_at: string;
};

type FlowRow = {
  id: string;
  ref_no: number;
  title: string;
  stage: string;
  resident_id: string | null;
  shoot_at: string | null;
  metrics_due_at: string | null;
};

type PendingWeek = {
  account_id: string;
  resident_name: string;
  platform: string;
  handle: string;
  week_start: string;
};

type ResidentLink = { id: string; name: string; contact_user_id: string | null; handler_user_id: string | null };

const FOUNDER_ROLES = ["admin", "founder", "managing_director", "creative_director"] as const;

export default function Dashboard() {
  const { roles, canSeeFinance, departments, canScan, isLeadership, email, userId, has } = useMyRoles();
  const isFounder = has(...FOUNDER_ROLES);
  const [clients, setClients] = useState<number | null>(null);
  const [events, setEvents] = useState<number | null>(null);
  const [content, setContent] = useState<ContentRow[]>([]);
  const [flow, setFlow] = useState<FlowRow[]>([]);
  const [resLinks, setResLinks] = useState<ResidentLink[]>([]);
  const [myCrew, setMyCrew] = useState<{ content_id: string; role: string }[]>([]);
  const [pendingWeeks, setPendingWeeks] = useState<PendingWeek[]>([]);

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
          .limit(12),
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

  useEffect(() => {
    if (!userId || !departments.content) return;
    let cancelled = false;
    (async () => {
      const [{ data: rows }, { data: rs }, { data: cw }] = await Promise.all([
        supabase
          .from("content_items")
          .select("id, ref_no, title, stage, resident_id, shoot_at, metrics_due_at")
          .not("stage", "in", '("Archived","Rejected")'),
        supabase.rpc("resident_options"),
        supabase.from("content_crew").select("content_id, role").eq("user_id", userId),
      ]);
      if (cancelled) return;
      setFlow((rows as unknown as FlowRow[]) ?? []);
      setResLinks((rs as unknown as ResidentLink[]) ?? []);
      setMyCrew((cw as { content_id: string; role: string }[]) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, departments.content]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc("my_pending_account_weeks");
      if (!cancelled) setPendingWeeks((data as unknown as PendingWeek[]) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const waiting = useMemo(() => {
    if (!userId) return [] as { item: FlowRow; why: string }[];
    const today = new Date().toISOString().slice(0, 10);
    const resById = new Map(resLinks.map((r) => [r.id, r]));
    const editorOf = new Set(myCrew.filter((c) => /edit/i.test(c.role)).map((c) => c.content_id));

    const out: { item: FlowRow; why: string }[] = [];
    flow.forEach((i) => {
      const r = i.resident_id ? resById.get(i.resident_id) : undefined;
      const contact = r?.contact_user_id === userId;
      const handler = r?.handler_user_id === userId;
      const push = (why: string) => out.push({ item: i, why });

      switch (i.stage) {
        case "Idea":
          if (isFounder) push("Approve or reject");
          break;
        case "Approved":
          if (contact || isFounder) push("Fill the production team");
          break;
        case "Crewed":
          if (contact || isFounder) push("Set the shoot date");
          break;
        case "Scheduled":
          if ((contact || isFounder) && i.shoot_at && i.shoot_at <= today) push("Shoot day");
          break;
        case "Shooting":
          if (contact || isFounder) push("Send to post production");
          break;
        case "Editing":
          if (editorOf.has(i.id)) push("Edit and deliver");
          break;
        case "Review":
          if (isFounder) push("Sign off the cut");
          break;
        case "Handover":
          if (handler || isFounder) push("Post it");
          break;
        case "Posted":
          if ((handler || isFounder) && i.metrics_due_at && i.metrics_due_at <= today) push("Add the numbers");
          break;
      }
    });
    return out;
  }, [flow, resLinks, myCrew, userId, isFounder]);


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

      {waiting.length > 0 && (
        <div className="mt-12">
          <SectionHeading index="00" title="Waiting on you" hint={`${waiting.length} to act on`} />
          <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule">
            {waiting.map(({ item, why }) => (
              <li key={`${item.id}-${why}`} className="px-4 py-3 flex items-center gap-3">
                <span className="num text-[11px] text-ink-faint w-20 shrink-0">{refCode(item.ref_no)}</span>
                <Link to="/app/content" className="text-sm truncate focus-ring">
                  {item.title}
                </Link>
                <span className="ml-auto text-xs font-semibold text-signal whitespace-nowrap">{why}</span>
                <StatusChip value={item.stage} />
              </li>
            ))}
          </ul>
        </div>
      )}

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
            <ul className="surface rounded-2xl overflow-hidden divide-y divide-rule">
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
            <Link key={m.to} to={m.to} className="surface rounded-2xl p-5 card-lift hover:bg-paper-sunken hover:border-signal/40 focus-ring">
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

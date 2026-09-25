import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DeckPanel, DeckList } from "@/components/deck";
import { StatusChip } from "@/components/system";
import { todayISO } from "@/lib/deck";

type Row = { id: string; title: string; note?: string; state?: string; to?: string; right?: string };

function plusDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const money = (v: number | null) =>
  v == null ? "" : `UGX ${Math.round(Number(v)).toLocaleString("en-UG")}`;

async function financeRows(): Promise<Row[]> {
  const today = todayISO();
  const [cash, lines, invoices] = await Promise.all([
    supabase.from("cash_requests").select("id, purpose, amount_ugx, status, needed_on").eq("status", "submitted").limit(6),
    supabase.from("payment_run_lines").select("id, payee_name, amount_ugx, status").not("status", "in", "(paid,cancelled)").limit(6),
    supabase
      .from("invoices")
      .select("id, number, party_name, total_ugx, status, due_date, direction")
      .in("status", ["sent", "approved", "part_paid"])
      .limit(6),
  ]);
  const rows: Row[] = [];
  (cash.data ?? []).forEach((r) =>
    rows.push({
      id: `cash-${r.id}`,
      title: r.purpose ?? "Cash request",
      note: `Cash request${r.needed_on ? ` · needed ${new Date(r.needed_on).toLocaleDateString()}` : ""}`,
      state: "Waiting",
      right: money(r.amount_ugx as number),
      to: "/app/approvals",
    })
  );
  (lines.data ?? []).forEach((r) =>
    rows.push({
      id: `line-${r.id}`,
      title: r.payee_name ?? "Payment",
      note: "Payment run line",
      state: r.status as string,
      right: money(r.amount_ugx as number),
      to: "/app/finance/payments",
    })
  );
  (invoices.data ?? []).forEach((r) =>
    rows.push({
      id: `inv-${r.id}`,
      title: `${r.number ?? "Invoice"} · ${r.party_name ?? ""}`,
      note: `${r.direction === "in" ? "Bill to pay" : "Invoice to collect"}${
        r.due_date ? ` · due ${new Date(r.due_date).toLocaleDateString()}${r.due_date < today ? " (late)" : ""}` : ""
      }`,
      state: r.status as string,
      right: money(r.total_ugx as number),
      to: "/app/finance/invoices",
    })
  );
  return rows;
}

async function salesRows(): Promise<Row[]> {
  const [opps, followups, offers] = await Promise.all([
    supabase
      .from("sales_opportunities")
      .select("id, organisation_name, stage, value_ugx, expected_close, next_action")
      .eq("status", "open")
      .order("expected_close", { ascending: true })
      .limit(6),
    supabase
      .from("sales_followups")
      .select("id, title, due_at, status")
      .eq("status", "open")
      .lte("due_at", plusDays(7) + "T23:59:59Z")
      .limit(5),
    supabase.from("sales_offers").select("id, title, status").in("status", ["submitted", "changes_requested"]).limit(5),
  ]);
  const rows: Row[] = [];
  (opps.data ?? []).forEach((r) =>
    rows.push({
      id: `opp-${r.id}`,
      title: r.organisation_name ?? "Deal",
      note: r.next_action ? `Next: ${r.next_action}` : "Open deal",
      state: String(r.stage).split("_").join(" "),
      right: money(r.value_ugx as number),
      to: "/app/sales",
    })
  );
  (followups.data ?? []).forEach((r) =>
    rows.push({
      id: `fu-${r.id}`,
      title: r.title,
      note: r.due_at ? `Follow up by ${new Date(r.due_at).toLocaleDateString()}` : "Follow up",
      state: "Follow-up",
      to: "/app/sales",
    })
  );
  (offers.data ?? []).forEach((r) =>
    rows.push({ id: `of-${r.id}`, title: r.title, note: "Offer waiting on a decision", state: r.status as string, to: "/app/sales" })
  );
  return rows;
}

async function strategyRows(): Promise<Row[]> {
  const [goals, maps, targets] = await Promise.all([
    supabase.from("client_goals").select("id, title, status, review_state, due_on").neq("status", "done").limit(6),
    supabase.from("strategy_maps").select("id, title, review_state").limit(5),
    supabase.from("client_targets").select("id, metric, month, review_state").eq("review_state", "submitted").limit(5),
  ]);
  const rows: Row[] = [];
  (goals.data ?? []).forEach((r) =>
    rows.push({
      id: `g-${r.id}`,
      title: r.title,
      note: r.due_on ? `Goal · due ${new Date(r.due_on).toLocaleDateString()}` : "Goal",
      state: (r.review_state as string) === "submitted" ? "Waiting approval" : (r.status as string),
      to: "/app/strategy/goals",
    })
  );
  (maps.data ?? []).forEach((r) =>
    rows.push({ id: `m-${r.id}`, title: r.title, note: "Strategy map", state: r.review_state as string, to: "/app/strategy/map" })
  );
  (targets.data ?? []).forEach((r) =>
    rows.push({ id: `t-${r.id}`, title: `${r.metric} target`, note: `Month ${r.month}`, state: "Waiting approval", to: "/app/strategy/goals" })
  );
  return rows;
}

async function legalRows(): Promise<Row[]> {
  const [contracts, compliance] = await Promise.all([
    supabase
      .from("contracts")
      .select("id, title, party_name, ends_on, status")
      .not("ends_on", "is", null)
      .lte("ends_on", plusDays(60))
      .order("ends_on", { ascending: true })
      .limit(6),
    supabase
      .from("compliance_items")
      .select("id, name, authority, renews_on, status")
      .not("renews_on", "is", null)
      .lte("renews_on", plusDays(60))
      .order("renews_on", { ascending: true })
      .limit(6),
  ]);
  const rows: Row[] = [];
  (contracts.data ?? []).forEach((r) =>
    rows.push({
      id: `c-${r.id}`,
      title: r.title,
      note: `${r.party_name ?? ""} · ends ${new Date(r.ends_on as string).toLocaleDateString()}`,
      state: r.status as string,
      to: "/app/legal/contracts",
    })
  );
  (compliance.data ?? []).forEach((r) =>
    rows.push({
      id: `cm-${r.id}`,
      title: r.name,
      note: `${r.authority ?? ""} · renews ${new Date(r.renews_on as string).toLocaleDateString()}`,
      state: r.status as string,
      to: "/app/legal/compliance",
    })
  );
  return rows;
}

async function shootRows(): Promise<Row[]> {
  const { data } = await supabase
    .from("shoot_days")
    .select("id, shoot_date, call_time, location, status")
    .gte("shoot_date", todayISO())
    .in("status", ["draft", "confirmed", "shooting"])
    .order("shoot_date", { ascending: true })
    .limit(8);
  return (data ?? []).map((r) => ({
    id: r.id,
    title: `${new Date(r.shoot_date as string).toLocaleDateString()}${r.call_time ? ` · call ${String(r.call_time).slice(0, 5)}` : ""}`,
    note: r.location ?? "Location not set",
    state: r.status as string,
    to: `/app/shoots/${r.id}`,
  }));
}

async function myContentRows(userId: string | null): Promise<Row[]> {
  if (!userId) return [];
  const { data: crew } = await supabase.from("content_crew").select("content_id").eq("user_id", userId).limit(50);
  const ids = (crew ?? []).map((c) => c.content_id as string);
  if (!ids.length) return [];
  const { data } = await supabase.from("content_items").select("id, title, stage, planned_at").in("id", ids).limit(8);
  return (data ?? []).map((r) => ({
    id: r.id,
    title: r.title as string,
    note: r.planned_at ? `Planned ${new Date(r.planned_at as string).toLocaleDateString()}` : "No date set",
    state: String(r.stage).split("_").join(" "),
    to: "/app/content",
  }));
}

async function contentPipelineRows(): Promise<Row[]> {
  const { data } = await supabase.from("content_items").select("id, title, stage, planned_at, updated_at").not("stage", "in", '("Archived","Rejected")').order("updated_at", { ascending: true }).limit(10);
  return (data ?? []).map((row) => ({ id: row.id, title: row.title, note: row.planned_at ? `Due ${new Date(row.planned_at).toLocaleDateString()}` : "No delivery date", state: row.stage, to: "/app/content" }));
}

async function turnaroundRows(): Promise<Row[]> {
  const { data } = await supabase.from("content_items").select("id, title, stage, created_at, updated_at").not("stage", "in", '("Archived","Rejected","Handover")').order("created_at", { ascending: true }).limit(50);
  const now = Date.now();
  const aged = (data ?? []).map((row) => ({ ...row, days: Math.max(0, Math.floor((now - Date.parse(row.updated_at ?? row.created_at)) / 86400000)) })).sort((a, b) => b.days - a.days);
  const average = aged.length ? Math.round(aged.reduce((sum, row) => sum + row.days, 0) / aged.length) : 0;
  return aged.slice(0, 8).map((row, index) => ({ id: row.id, title: row.title, note: `${row.stage} · ${row.days} day${row.days === 1 ? "" : "s"} in current work`, state: index === 0 ? `Longest · ${row.days}d` : undefined, right: index === 0 ? `Average ${average}d` : undefined, to: "/app/content" }));
}

async function communicationsRows(): Promise<Row[]> {
  const [briefs, announcements, posts] = await Promise.all([
    supabase.from("briefs").select("id, title, updated_at").order("updated_at", { ascending: false }).limit(4),
    supabase.from("announcements").select("id, title, published, updated_at").order("updated_at", { ascending: false }).limit(4),
    supabase.from("content_items").select("id, title, stage, planned_at").not("planned_at", "is", null).order("planned_at", { ascending: true }).limit(4),
  ]);
  return [
    ...(briefs.data ?? []).map((row) => ({ id: `brief-${row.id}`, title: row.title, note: "Brief", state: "Ready", to: `/app/briefs/${row.id}` })),
    ...(announcements.data ?? []).map((row) => ({ id: `announcement-${row.id}`, title: row.title, note: "Announcement", state: row.published ? "Published" : "Draft", to: `/app/announcements/${row.id}` })),
    ...(posts.data ?? []).map((row) => ({ id: `post-${row.id}`, title: row.title, note: row.planned_at ? `Posts ${new Date(row.planned_at).toLocaleDateString()}` : "Post", state: row.stage, to: "/app/content" })),
  ].slice(0, 10);
}

async function talentRows(): Promise<Row[]> {
  const [shoots, contracts] = await Promise.all([
    shootRows(),
    supabase.from("contracts").select("id, title, party_name, ends_on, status").not("ends_on", "is", null).lte("ends_on", plusDays(60)).order("ends_on").limit(5),
  ]);
  return [...shoots, ...(contracts.data ?? []).map((row) => ({ id: `talent-${row.id}`, title: row.title, note: `${row.party_name ?? "Agreement"} · ends ${new Date(row.ends_on as string).toLocaleDateString()}`, state: row.status, to: "/app/legal/contracts" }))].slice(0, 10);
}

async function eventsRows(): Promise<Row[]> {
  const { data } = await supabase.from("events").select("id, title, starts_at, published").gte("starts_at", new Date().toISOString()).order("starts_at").limit(8);
  return (data ?? []).map((row) => ({ id: row.id, title: row.title, note: new Date(row.starts_at).toLocaleDateString(), state: row.published ? "Published" : "Draft", to: "/app/events" }));
}

async function peopleRows(): Promise<Row[]> {
  const { data } = await supabase.from("leadership_tasks").select("id, title, status, due_at").not("status", "in", '("accepted","cancelled")').order("due_at", { ascending: true, nullsFirst: false }).limit(10);
  return (data ?? []).map((row) => ({ id: row.id, title: row.title, note: row.due_at ? `Due ${new Date(row.due_at).toLocaleDateString()}` : "No deadline", state: row.status.replace(/_/g, " "), to: `/app/work/${row.id}` }));
}

async function siteRows(): Promise<Row[]> {
  const [projects, announcements] = await Promise.all([
    supabase.from("projects").select("id, title, client, updated_at").order("updated_at", { ascending: false }).limit(5),
    supabase.from("announcements").select("id, title, published, updated_at").order("updated_at", { ascending: false }).limit(5),
  ]);
  return [...(projects.data ?? []).map((row) => ({ id: `project-${row.id}`, title: row.title, note: row.client ?? "In house", state: "Project", to: "/app/site" })), ...(announcements.data ?? []).map((row) => ({ id: `site-announcement-${row.id}`, title: row.title, note: "Website announcement", state: row.published ? "Published" : "Draft", to: "/app/site" }))];
}

const LOADERS: Record<string, (userId: string | null) => Promise<Row[]>> = {
  finance_queue: () => financeRows(),
  sales_pipeline: () => salesRows(),
  strategy_queue: () => strategyRows(),
  legal_queue: () => legalRows(),
  ops_shoots: () => shootRows(),
  my_content: (userId) => myContentRows(userId),
  content_pipeline: () => contentPipelineRows(),
  turnaround: () => turnaroundRows(),
  communications_queue: () => communicationsRows(),
  talent_queue: () => talentRows(),
  people_queue: () => peopleRows(),
  events_queue: () => eventsRows(),
  site_queue: () => siteRows(),
};

const META: Record<string, { title: string; empty: string; to?: string; toLabel?: string }> = {
  finance_queue: { title: "Finance queue", empty: "Nothing waiting in finance.", to: "/app/finance", toLabel: "Open finance" },
  sales_pipeline: { title: "Sales", empty: "No open deals or follow-ups.", to: "/app/sales", toLabel: "Open sales" },
  strategy_queue: { title: "Strategy", empty: "No goals, targets or maps need you.", to: "/app/strategy", toLabel: "Open strategy" },
  legal_queue: { title: "Legal", empty: "No contracts or renewals coming up.", to: "/app/legal", toLabel: "Open legal" },
  ops_shoots: { title: "Shoots ahead", empty: "No shoot days booked.", to: "/app/shoots", toLabel: "Open shoots" },
  my_content: { title: "My content", empty: "You are not on any content yet.", to: "/app/content", toLabel: "Open pipeline" },
  content_pipeline: { title: "Production pipeline", empty: "No content is moving through production yet.", to: "/app/content", toLabel: "Open pipeline" },
  turnaround: { title: "Turnaround time", empty: "Turnaround appears when content enters production.", to: "/app/content", toLabel: "Review pipeline" },
  communications_queue: { title: "Communications", empty: "No briefs, announcements or scheduled posts need attention.", to: "/app/calendar", toLabel: "Open calendar" },
  talent_queue: { title: "Talent work", empty: "No upcoming talent work or agreement deadlines.", to: "/app/shoots", toLabel: "Open shoots" },
  people_queue: { title: "People and workload", empty: "No open work needs people support.", to: "/app/work", toLabel: "Open work" },
  events_queue: { title: "Events", empty: "No upcoming events.", to: "/app/events", toLabel: "Open events" },
  site_queue: { title: "Website publishing", empty: "No recent website work.", to: "/app/site", toLabel: "Open editor" },
};

/** A read-only panel for one department, loading only what the person may already see. */
export function RolePanel({ panelKey, userId, index }: { panelKey: string; userId: string | null; index?: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const meta = META[panelKey];

  useEffect(() => {
    let live = true;
    const loader = LOADERS[panelKey];
    if (!loader) return;
    setLoading(true);
    loader(userId)
      .then((r) => live && setRows(r))
      .catch(() => live && setRows([]))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [panelKey, userId]);

  if (!meta) return null;

  return (
    <DeckPanel index={index} title={meta.title} hint={loading ? "Loading…" : `${rows.length} item${rows.length === 1 ? "" : "s"}`} to={meta.to} toLabel={meta.toLabel}>
      <DeckList>
        {!loading && rows.length === 0 && <li className="px-4 py-6 text-sm text-ink-soft">{meta.empty}</li>}
        {rows.map((row) => (
          <li key={row.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
            {row.to ? (
              <Link to={row.to} className="text-sm font-semibold hover:text-signal focus-ring truncate max-w-[18rem]">
                {row.title}
              </Link>
            ) : (
              <span className="text-sm font-semibold truncate max-w-[18rem]">{row.title}</span>
            )}
            {row.note && <span className="text-xs text-ink-faint truncate">{row.note}</span>}
            {row.state && <StatusChip value={row.state} />}
            {row.right && <span className="num ml-auto text-xs whitespace-nowrap">{row.right}</span>}
          </li>
        ))}
      </DeckList>
    </DeckPanel>
  );
}

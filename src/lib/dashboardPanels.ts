/**
 * Dashboard panel registry.
 *
 * Every block on the dashboard has a key. A layout is an ordered list of those
 * keys with the width each one takes. The system admin can set a layout per role
 * or per person; anything unset falls back to the built-in default for the role.
 */
import { supabase } from "@/integrations/supabase/client";
import type { AppRole, StaffRole } from "@/hooks/useMyRoles";

export type PanelWidth = "column" | "full";

export type PanelKey =
  | "today"
  | "week"
  | "kpi"
  | "weekgrid"
  | "numbers"
  | "share"
  | "assigned_work"
  | "signoffs"
  | "team_load"
  | "my_content"
  | "finance_queue"
  | "sales_pipeline"
  | "strategy_queue"
  | "legal_queue"
  | "ops_shoots"
  | "content_pipeline"
  | "turnaround"
  | "communications_queue"
  | "talent_queue"
  | "events_queue"
  | "site_queue";

export type PanelItem = { key: PanelKey; width: PanelWidth };

export type PanelSpec = {
  key: PanelKey;
  title: string;
  hint: string;
  width: PanelWidth;
  /** Roles that may see this panel at all. Empty means everyone on staff. */
  roles: AppRole[];
};

export const PANELS: PanelSpec[] = [
  { key: "today", title: "Today and late", hint: "Everything dated today or overdue", width: "column", roles: [] },
  { key: "week", title: "This week", hint: "The rest of the week from the calendar", width: "column", roles: [] },
  { key: "kpi", title: "How you are doing", hint: "Last 30 days against the 30 before", width: "column", roles: [] },
  { key: "weekgrid", title: "Your week", hint: "Seven-day calendar strip", width: "full", roles: [] },
  { key: "numbers", title: "Weekly numbers to fill", hint: "Client accounts waiting on figures", width: "full", roles: [] },
  { key: "share", title: "Your retainer share", hint: "This month, your line only", width: "full", roles: [] },
  {
    key: "assigned_work",
    title: "Work I assigned",
    hint: "Tasks you gave out and where they stand",
    width: "full",
    roles: ["admin", "founder", "managing_director", "creative_director", "sales_head"],
  },
  {
    key: "signoffs",
    title: "Waiting for my sign-off",
    hint: "Submitted work to accept or send back",
    width: "full",
    roles: ["admin", "founder", "managing_director", "creative_director", "sales_head"],
  },
  {
    key: "team_load",
    title: "Team load",
    hint: "Open and late work per person",
    width: "full",
    roles: ["admin", "founder", "managing_director", "creative_director", "sales_head"],
  },
  { key: "my_content", title: "My content", hint: "Pieces you are crewed on", width: "full", roles: [] },
  {
    key: "finance_queue",
    title: "Finance queue",
    hint: "Approvals, payments and unpaid invoices",
    width: "full",
    roles: ["admin", "founder", "managing_director", "finance_ops"],
  },
  {
    key: "sales_pipeline",
    title: "Sales",
    hint: "Open deals, follow-ups and offers",
    width: "full",
    roles: ["admin", "founder", "managing_director", "sales_head"],
  },
  {
    key: "strategy_queue",
    title: "Strategy",
    hint: "Goals, targets and maps waiting",
    width: "full",
    roles: ["admin", "founder", "managing_director", "strategist", "creative_director", "sales_head"],
  },
  {
    key: "legal_queue",
    title: "Legal",
    hint: "Contracts ending and compliance dates",
    width: "full",
    roles: ["admin", "founder", "managing_director", "legal"],
  },
  {
    key: "ops_shoots",
    title: "Shoots ahead",
    hint: "Shoot days coming up",
    width: "full",
    roles: ["admin", "founder", "managing_director", "creative_director", "creative"],
  },
  { key: "content_pipeline", title: "Production pipeline", hint: "Content moving through each stage", width: "full", roles: [] },
  { key: "turnaround", title: "Turnaround time", hint: "Average age and longest-open content work", width: "full", roles: ["admin", "founder", "managing_director", "operations_manager", "creative", "strategist", "communications", "designer"] },
  { key: "communications_queue", title: "Communications", hint: "Briefs, announcements and scheduled posts", width: "full", roles: ["admin", "founder", "managing_director", "communications"] },
  { key: "talent_queue", title: "Talent work", hint: "Shoots, agreements and assigned talent work", width: "full", roles: ["admin", "founder", "managing_director", "operations_manager", "talent"] },
  { key: "events_queue", title: "Events", hint: "Upcoming events and readiness", width: "full", roles: ["admin", "founder", "managing_director", "operations_manager", "event_manager"] },
  { key: "site_queue", title: "Website publishing", hint: "Projects, announcements and recent changes", width: "full", roles: ["admin", "founder", "site_editor", "communications", "designer"] },
];

export const PANEL_BY_KEY = new Map(PANELS.map((p) => [p.key, p]));

const BASE: PanelItem[] = [
  { key: "today", width: "column" },
  { key: "week", width: "column" },
  { key: "kpi", width: "column" },
  { key: "weekgrid", width: "full" },
  { key: "numbers", width: "full" },
  { key: "share", width: "full" },
];

const LEADERSHIP_SET: PanelItem[] = [
  { key: "today", width: "column" },
  { key: "week", width: "column" },
  { key: "kpi", width: "column" },
  { key: "signoffs", width: "full" },
  { key: "assigned_work", width: "full" },
  { key: "team_load", width: "full" },
  { key: "weekgrid", width: "full" },
];

export const DEFAULT_LAYOUTS: Partial<Record<StaffRole, PanelItem[]>> = {
  team_member: [{ key: "today", width: "column" }, { key: "week", width: "column" }, { key: "content_pipeline", width: "full" }, { key: "weekgrid", width: "full" }],
  founder: [...LEADERSHIP_SET, { key: "finance_queue", width: "full" }, { key: "sales_pipeline", width: "full" }],
  managing_director: [...LEADERSHIP_SET, { key: "finance_queue", width: "full" }, { key: "legal_queue", width: "full" }],
  operations_manager: [...LEADERSHIP_SET, { key: "turnaround", width: "full" }, { key: "ops_shoots", width: "full" }],
  admin: LEADERSHIP_SET,
  creative_director: [
    { key: "today", width: "column" },
    { key: "week", width: "column" },
    { key: "kpi", width: "column" },
    { key: "signoffs", width: "full" },
    { key: "assigned_work", width: "full" },
    { key: "ops_shoots", width: "full" },
    { key: "weekgrid", width: "full" },
  ],
  sales_head: [
    { key: "today", width: "column" },
    { key: "week", width: "column" },
    { key: "kpi", width: "column" },
    { key: "sales_pipeline", width: "full" },
    { key: "signoffs", width: "full" },
    { key: "assigned_work", width: "full" },
    { key: "weekgrid", width: "full" },
  ],
  finance_ops: [
    { key: "today", width: "column" },
    { key: "week", width: "column" },
    { key: "kpi", width: "column" },
    { key: "finance_queue", width: "full" },
    { key: "weekgrid", width: "full" },
  ],
  creative: [
    { key: "today", width: "column" },
    { key: "week", width: "column" },
    { key: "my_content", width: "full" },
    { key: "ops_shoots", width: "full" },
    { key: "weekgrid", width: "full" },
    { key: "numbers", width: "full" },
  ],
  strategist: [
    { key: "today", width: "column" },
    { key: "week", width: "column" },
    { key: "kpi", width: "column" },
    { key: "strategy_queue", width: "full" },
    { key: "weekgrid", width: "full" },
  ],
  legal: [
    { key: "today", width: "column" },
    { key: "week", width: "column" },
    { key: "legal_queue", width: "full" },
    { key: "weekgrid", width: "full" },
  ],
  talent: [{ key: "today", width: "column" }, { key: "week", width: "column" }, { key: "talent_queue", width: "full" }, { key: "ops_shoots", width: "full" }, { key: "weekgrid", width: "full" }],
  communications: [{ key: "today", width: "column" }, { key: "week", width: "column" }, { key: "communications_queue", width: "full" }, { key: "content_pipeline", width: "full" }, { key: "weekgrid", width: "full" }],
  designer: [{ key: "today", width: "column" }, { key: "week", width: "column" }, { key: "my_content", width: "full" }, { key: "turnaround", width: "full" }, { key: "weekgrid", width: "full" }],
  event_manager: [{ key: "today", width: "column" }, { key: "week", width: "column" }, { key: "events_queue", width: "full" }, { key: "weekgrid", width: "full" }],
  site_editor: [{ key: "today", width: "column" }, { key: "week", width: "column" }, { key: "site_queue", width: "full" }, { key: "weekgrid", width: "full" }],
  scanner: [{ key: "today", width: "column" }, { key: "weekgrid", width: "full" }],
  viewer: [{ key: "today", width: "column" }, { key: "week", width: "column" }, { key: "content_pipeline", width: "full" }, { key: "weekgrid", width: "full" }],
};

export const FALLBACK_LAYOUT = BASE;

/** The default a role gets before the admin changes anything. */
export function defaultLayoutFor(roles: AppRole[]): PanelItem[] {
  const merged = (Object.keys(DEFAULT_LAYOUTS) as StaffRole[])
    .filter((role) => role !== "team_member" && roles.includes(role))
    .flatMap((role) => DEFAULT_LAYOUTS[role] ?? []);
  if (!merged.length) return roles.includes("team_member") ? (DEFAULT_LAYOUTS.team_member as PanelItem[]) : FALLBACK_LAYOUT;
  return merged.filter((item, index) => merged.findIndex((candidate) => candidate.key === item.key) === index);
}

export function allowedPanel(spec: PanelSpec, roles: AppRole[]) {
  return spec.roles.length === 0 || spec.roles.some((r) => roles.includes(r));
}

type LayoutRow = { scope: string; role: string | null; user_id: string | null; panels: unknown };

function cleanPanels(value: unknown): PanelItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => entry as { key?: string; width?: string })
    .filter((entry) => entry?.key && PANEL_BY_KEY.has(entry.key as PanelKey))
    .map((entry) => ({ key: entry.key as PanelKey, width: entry.width === "full" ? "full" : "column" } as PanelItem));
}

/** Person layout beats role layout beats the built-in default. Panels the person may not see are dropped. */
export async function loadDashboardLayout(userId: string | null, roles: AppRole[]): Promise<PanelItem[]> {
  let chosen: PanelItem[] | null = null;
  if (userId) {
    const { data } = await supabase.from("dashboard_layouts").select("scope, role, user_id, panels");
    const rows = (data as LayoutRow[] | null) ?? [];
    const mine = rows.find((r) => r.scope === "user" && r.user_id === userId);
    if (mine) chosen = cleanPanels(mine.panels);
    if (!chosen?.length) {
      const byRoles = rows.filter((r) => r.scope === "role" && r.role && roles.includes(r.role as AppRole));
      const merged = byRoles.flatMap((row) => cleanPanels(row.panels));
      if (merged.length) chosen = merged.filter((item, index) => merged.findIndex((candidate) => candidate.key === item.key) === index);
    }
  }
  const layout = chosen?.length ? chosen : defaultLayoutFor(roles);
  return layout.filter((item) => {
    const spec = PANEL_BY_KEY.get(item.key);
    return spec ? allowedPanel(spec, roles) : false;
  });
}

import { completeness } from "@/lib/staffProfile";
import { supabase } from "@/integrations/supabase/client";
import type { StaffRole } from "@/hooks/useMyRoles";

/** Each department gets its own dashboard. These loaders read real records only. */
export type DeptKey = "exec" | "finance" | "sales" | "content" | "strategy" | "legal" | "relations" | "talent" | "people" | "ops" | "personal";

export const DEPT_LABEL: Record<DeptKey, string> = {
  exec: "Company overview",
  finance: "Finance desk",
  sales: "Sales desk",
  content: "Production board",
  strategy: "Strategy desk",
  legal: "Legal desk",
  relations: "Client health",
  talent: "Talent & campaigns",
  people: "People desk",
  ops: "Operations desk",
  personal: "My work",
};

const ROLE_DEPT: Partial<Record<StaffRole, DeptKey>> = {
  founder: "exec",
  admin: "exec",
  managing_director: "exec",
  creative_director: "content",
  finance_ops: "finance",
  sales_head: "sales",
  creative: "content",
  strategist: "strategy",
  legal: "legal",
  communications: "relations",
  client_relations: "relations",
  talent_director: "talent",
  hr: "people",
  operations_manager: "ops",
  event_manager: "ops",
};

export function deptFor(role: StaffRole | null | undefined, positions: StaffRole[]): DeptKey {
  if (role) return ROLE_DEPT[role] ?? "personal";
  for (const p of positions) if (ROLE_DEPT[p]) return ROLE_DEPT[p]!;
  return "personal";
}

export type Figure = { label: string; value: string | number; delta?: number | null; money?: boolean; to?: string };
export type ChartKind = "area" | "bar" | "stacked" | "line" | "hbar";
export type ChartSpec = {
  title: string;
  kind: ChartKind;
  data: Record<string, string | number>[];
  xKey: string;
  series: { key: string; label: string }[];
  money?: boolean;
  wide?: boolean;
  to?: string;
  explain: { what: string; how: string; good: string };
};
export type DeptBoard = { figures: Figure[]; charts: ChartSpec[] };

/* ---------- helpers ---------- */
const DAY = 86400000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (n: number) => iso(new Date(Date.now() + n * DAY));
function weekKeys(n = 12) {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return Array.from({ length: n }, (_, i) => iso(new Date(monday.getTime() - (n - 1 - i) * 7 * DAY)));
}
const wkLabel = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;
function bucket(keys: string[], date: string | null | undefined) {
  if (!date) return -1;
  const d = date.slice(0, 10);
  for (let i = keys.length - 1; i >= 0; i--) if (d >= keys[i]) return i;
  return -1;
}
function monthKeys(n = 6) {
  const d = new Date();
  return Array.from({ length: n }, (_, i) => {
    const m = new Date(d.getFullYear(), d.getMonth() - (n - 1 - i), 1);
    return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
  });
}
const monLabel = (k: string) => new Date(`${k}-01`).toLocaleString("en-GB", { month: "short" });
function pct(now: number, before: number) {
  if (!before) return now ? null : 0;
  return Math.round(((now - before) / before) * 100);
}
const n = (v: unknown) => Number(v ?? 0) || 0;
type R = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
async function rows(q: PromiseLike<{ data: unknown }>): Promise<R[]> {
  const { data } = await q;
  return (data as R[]) ?? [];
}

/* ---------- departments ---------- */
async function finance(): Promise<DeptBoard> {
  const keys = weekKeys();
  const [cash, inv] = await Promise.all([
    rows(supabase.from("cashbook_entries").select("direction, amount_ugx, entry_date, transfer_group_id").is("transfer_group_id", null)),
    rows(supabase.from("invoices").select("direction, status, total_ugx, amount_paid_ugx, due_date, vat_ugx, issue_date")),
  ]);
  const weeks = keys.map((k) => ({ week: wkLabel(k), in: 0, out: 0, balance: 0 }));
  let opening = 0;
  for (const c of cash) {
    const i = bucket(keys, c.entry_date);
    const amt = n(c.amount_ugx) * (c.direction === "in" ? 1 : -1);
    if (i < 0) opening += amt;
    else if (c.direction === "in") weeks[i].in += n(c.amount_ugx);
    else weeks[i].out += n(c.amount_ugx);
  }
  let run = opening;
  for (const w of weeks) { run += w.in - w.out; w.balance = run; }
  const today = iso(new Date());
  const age = [{ age: "Not due", owed: 0 }, { age: "0–30 days late", owed: 0 }, { age: "31–60 days late", owed: 0 }, { age: "60+ days late", owed: 0 }];
  let bills = 0, billsAmt = 0, vat = 0;
  for (const r of inv) {
    if (r.status === "void") continue;
    const left = n(r.total_ugx) - n(r.amount_paid_ugx);
    if (r.direction === "out") {
      vat += n(r.vat_ugx);
      if (left > 0 && r.status !== "draft") {
        const late = r.due_date ? Math.floor((Date.parse(today) - Date.parse(r.due_date)) / DAY) : -1;
        age[late < 0 ? 0 : late <= 30 ? 1 : late <= 60 ? 2 : 3].owed += left;
      }
    } else if (r.status === "approved" || r.status === "part_paid") { bills++; billsAmt += left; }
  }
  const last = weeks[weeks.length - 1], prev = weeks[weeks.length - 2];
  return {
    figures: [
      { label: "Cash on hand", value: run, money: true, to: "/app/finance/cashbook" },
      { label: "In this week", value: last.in, money: true, delta: pct(last.in, prev.in) },
      { label: "Clients owe us", value: age.reduce((t, a) => t + a.owed, 0), money: true, to: "/app/finance/invoices" },
      { label: "Bills waiting on PIN", value: bills, to: "/app/finance/payments" },
    ],
    charts: [
      { title: "Cash position, last 12 weeks", kind: "area", wide: true, money: true, xKey: "week", series: [{ key: "balance", label: "Balance" }], data: weeks, to: "/app/finance/cashbook",
        explain: { what: "How much money the company holds at the end of each week.", how: "The cashbook's running balance: all money in minus all money out, excluding transfers between our own accounts.", good: "A line that stays flat or climbs. A steady fall means spending is ahead of income — look at the next chart." } },
      { title: "Money in vs money out", kind: "bar", money: true, xKey: "week", series: [{ key: "in", label: "In" }, { key: "out", label: "Out" }], data: weeks,
        explain: { what: "Cash received and cash paid out each week.", how: "Totals of cashbook credits and debits per week (Monday start).", good: "Most weeks the 'In' bar should be taller than 'Out'." } },
      { title: "Unpaid client invoices by age", kind: "hbar", money: true, xKey: "age", series: [{ key: "owed", label: "Owed" }], data: age, to: "/app/finance/invoices",
        explain: { what: "Money clients still owe us, grouped by how late it is.", how: `Sent client invoices minus what has been paid, compared to the due date. VAT charged so far: UGX ${vat.toLocaleString()}.`, good: "Almost everything in 'Not due'. Anything 31+ days late needs a call today." } },
    ],
  };
}

async function exec(): Promise<DeptBoard> {
  const keys = weekKeys();
  const [cash, res, goals, content] = await Promise.all([
    rows(supabase.from("cashbook_entries").select("direction, amount_ugx, entry_date").is("transfer_group_id", null).gte("entry_date", keys[0])),
    rows(supabase.from("residents").select("status, lifecycle_status, since, onboarded_at, archived_at, created_at")),
    rows(supabase.from("client_goals").select("status")),
    rows(supabase.from("content_items").select("stage, posted_at, created_at").gte("created_at", keys[0])),
  ]);
  const weeks = keys.map((k) => ({ week: wkLabel(k), revenue: 0, spend: 0, posted: 0 }));
  for (const c of cash) { const i = bucket(keys, c.entry_date); if (i >= 0) weeks[i][c.direction === "in" ? "revenue" : "spend"] += n(c.amount_ugx); }
  for (const c of content) { const i = bucket(keys, c.posted_at); if (i >= 0) weeks[i].posted++; }
  const active = res.filter((r) => !r.archived_at && (r.lifecycle_status ?? r.status) === "active").length;
  const months = monthKeys();
  const clients = months.map((m) => ({ month: monLabel(m), clients: res.filter((r) => (r.onboarded_at ?? r.created_at ?? "").slice(0, 7) <= m && (!r.archived_at || r.archived_at.slice(0, 7) > m)).length }));
  const goalStat = [...new Set(goals.map((g) => g.status ?? "unset"))].map((s) => ({ status: String(s).replace("_", " "), goals: goals.filter((g) => (g.status ?? "unset") === s).length }));
  const last = weeks[11], prev = weeks[10];
  return {
    figures: [
      { label: "Active clients", value: active, to: "/app/residents" },
      { label: "Revenue this week", value: last.revenue, money: true, delta: pct(last.revenue, prev.revenue) },
      { label: "Spend this week", value: last.spend, money: true, delta: pct(last.spend, prev.spend) },
      { label: "Posts this week", value: last.posted, delta: pct(last.posted, prev.posted), to: "/app/content" },
    ],
    charts: [
      { title: "Revenue vs spend, 12 weeks", kind: "area", wide: true, money: true, xKey: "week", series: [{ key: "revenue", label: "Revenue" }, { key: "spend", label: "Spend" }], data: weeks,
        explain: { what: "Money coming in against money going out, week by week.", how: "Cashbook credits and debits, excluding transfers.", good: "Revenue sitting above spend in most weeks — the gap is your weekly margin." } },
      { title: "Clients over the last 6 months", kind: "line", xKey: "month", series: [{ key: "clients", label: "Clients" }], data: clients, to: "/app/residents",
        explain: { what: "How many clients we were serving each month.", how: "Clients onboarded by that month and not yet archived.", good: "A rising or steady line. A drop means clients left — check Client Relations." } },
      { title: "Client goals by status", kind: "bar", xKey: "status", series: [{ key: "goals", label: "Goals" }], data: goalStat, to: "/app/strategy",
        explain: { what: "Where every client goal stands right now.", how: "Status set on each goal by the Strategy team.", good: "Most goals 'on track' or 'achieved'; 'at risk' goals need a plan this week." } },
    ],
  };
}

async function sales(): Promise<DeptBoard> {
  const opp = await rows(supabase.from("sales_opportunities").select("stage, status, value_ugx, probability, won_at, lost_at, created_at"));
  const stages = ["new_lead", "contacted", "qualified", "discovery", "proposal", "negotiation"];
  const funnel = stages.map((s) => ({ stage: s.replace("_", " "), deals: opp.filter((o) => o.status === "open" && o.stage === s).length }));
  const months = monthKeys();
  const wl = months.map((m) => ({ month: monLabel(m), won: opp.filter((o) => (o.won_at ?? "").slice(0, 7) === m).length, lost: opp.filter((o) => (o.lost_at ?? "").slice(0, 7) === m).length }));
  const open = opp.filter((o) => o.status === "open");
  const weighted = open.reduce((t, o) => t + n(o.value_ugx) * n(o.probability) / 100, 0);
  const won = opp.filter((o) => o.status === "won").length, lost = opp.filter((o) => o.status === "lost").length;
  return {
    figures: [
      { label: "Open deals", value: open.length, to: "/app/sales" },
      { label: "Pipeline value", value: open.reduce((t, o) => t + n(o.value_ugx), 0), money: true },
      { label: "Likely to close", value: Math.round(weighted), money: true },
      { label: "Win rate", value: won + lost ? `${Math.round((won / (won + lost)) * 100)}%` : "—" },
    ],
    charts: [
      { title: "Open deals by stage", kind: "hbar", wide: true, xKey: "stage", series: [{ key: "deals", label: "Deals" }], data: funnel, to: "/app/sales",
        explain: { what: "How many open deals sit at each step of the sale.", how: "Open opportunities counted by their current stage.", good: "A wide top narrowing smoothly. A pile-up at one step means deals are stuck there." } },
      { title: "Won vs lost per month", kind: "bar", xKey: "month", series: [{ key: "won", label: "Won" }, { key: "lost", label: "Lost" }], data: wl,
        explain: { what: "Deals closed each month, good and bad.", how: "Counted by the date each deal was marked won or lost.", good: "More won than lost. Read the 'lost reason' on lost deals to spot patterns." } },
    ],
  };
}

async function content(): Promise<DeptBoard> {
  const keys = weekKeys(8);
  const [items, shoots] = await Promise.all([
    rows(supabase.from("content_items").select("stage, shoot_at, editor_done_at, posted_at, created_at, planned_at").not("stage", "in", '("Archived","Rejected")')),
    rows(supabase.from("shoot_days").select("shoot_date, status").gte("shoot_date", addDays(-1)).lte("shoot_date", addDays(14))),
  ]);
  const LIVE = ["Idea", "Approved", "Crewed", "Scheduled", "Shooting", "Editing", "Review", "Handover", "Posted"];
  const flow = LIVE.map((s) => ({ stage: s, items: items.filter((i) => i.stage === s).length }));
  const weeks = keys.map((k) => ({ week: wkLabel(k), posted: 0, turnaround: 0, _c: 0 }));
  for (const i of items) {
    const p = bucket(keys, i.posted_at); if (p >= 0) weeks[p].posted++;
    const e = bucket(keys, i.editor_done_at);
    if (e >= 0 && i.shoot_at) { weeks[e].turnaround += (Date.parse(i.editor_done_at) - Date.parse(i.shoot_at)) / DAY; weeks[e]._c++; }
  }
  const wk = weeks.map(({ _c, turnaround, ...w }) => ({ ...w, turnaround: _c ? Math.round((turnaround / _c) * 10) / 10 : 0 }));
  const today = iso(new Date());
  return {
    figures: [
      { label: "In production", value: items.filter((i) => !["Idea", "Posted"].includes(i.stage)).length, to: "/app/content" },
      { label: "Shoots next 14 days", value: shoots.length, to: "/app/shoots" },
      { label: "Waiting on edit", value: items.filter((i) => i.stage === "Editing").length },
      { label: "Posts overdue", value: items.filter((i) => i.stage !== "Posted" && i.planned_at && i.planned_at < today).length },
    ],
    charts: [
      { title: "Where every idea is right now", kind: "bar", wide: true, xKey: "stage", series: [{ key: "items", label: "Pieces" }], data: flow, to: "/app/content",
        explain: { what: "The whole content pipeline, from idea to posted.", how: "Every live piece counted by its current stage.", good: "An even spread. A tall bar in Editing or Review is a bottleneck — move people there." } },
      { title: "Posts and edit turnaround, 8 weeks", kind: "line", xKey: "week", series: [{ key: "posted", label: "Posted" }, { key: "turnaround", label: "Days shoot→edit" }], data: wk,
        explain: { what: "How many pieces went live, and how many days editing took after the shoot.", how: "Posted date per week; average days between shoot date and editor finishing.", good: "Posts rising, turnaround under 3 days." } },
    ],
  };
}

async function strategy(): Promise<DeptBoard> {
  const [goals, maps, res] = await Promise.all([
    rows(supabase.from("client_goals").select("resident_id, status, start_value, target_value, review_state")),
    rows(supabase.from("strategy_maps").select("review_state")),
    supabase.rpc("resident_options").then((r) => (r.data as R[]) ?? []),
  ]);
  const names = new Map(res.map((r) => [r.id, r.name]));
  const by = new Map<string, { client: string; goals: number; onTrack: number }>();
  for (const g of goals) {
    const k = g.resident_id; const c = by.get(k) ?? { client: names.get(k) ?? "Client", goals: 0, onTrack: 0 };
    c.goals++; if (["on_track", "achieved", "active", "complete"].includes(g.status)) c.onTrack++; by.set(k, c);
  }
  const clients = [...by.values()].sort((a, b) => b.goals - a.goals).slice(0, 10);
  const states = ["draft", "submitted", "approved", "changes_requested"].map((s) => ({ state: s.replace("_", " "), maps: maps.filter((m) => (m.review_state ?? "draft") === s).length }));
  return {
    figures: [
      { label: "Client goals", value: goals.length, to: "/app/strategy" },
      { label: "On track", value: goals.filter((g) => ["on_track", "achieved", "active", "complete"].includes(g.status)).length },
      { label: "At risk", value: goals.filter((g) => g.status === "at_risk").length },
      { label: "Maps awaiting sign-off", value: maps.filter((m) => m.review_state === "submitted").length, to: "/app/strategy/approvals" },
    ],
    charts: [
      { title: "Goals per client — total vs on track", kind: "hbar", wide: true, xKey: "client", series: [{ key: "goals", label: "Goals" }, { key: "onTrack", label: "On track" }], data: clients,
        explain: { what: "For each client, how many goals exist and how many are healthy.", how: "Goals with status 'on track' or 'achieved' count as healthy.", good: "The two bars nearly the same length for every client." } },
      { title: "Strategy maps by review state", kind: "bar", xKey: "state", series: [{ key: "maps", label: "Maps" }], data: states, to: "/app/strategy/map",
        explain: { what: "How many strategy maps are drafted, waiting, approved or sent back.", how: "Each map's current review state.", good: "Few maps stuck in 'submitted' — Founders should clear them within 2 days." } },
    ],
  };
}

async function legal(): Promise<DeptBoard> {
  const ctr = await rows(supabase.from("resident_contracts").select("status, ends_on, value_ugx"));
  const buckets = [{ window: "Expired", contracts: 0 }, { window: "Next 30 days", contracts: 0 }, { window: "31–60 days", contracts: 0 }, { window: "61–90 days", contracts: 0 }, { window: "Later", contracts: 0 }];
  const today = Date.now();
  for (const c of ctr) {
    if (c.status !== "signed" || !c.ends_on) continue;
    const d = (Date.parse(c.ends_on) - today) / DAY;
    buckets[d < 0 ? 0 : d <= 30 ? 1 : d <= 60 ? 2 : d <= 90 ? 3 : 4].contracts++;
  }
  const status = ["draft", "signed", "cancelled"].map((s) => ({ status: s, contracts: ctr.filter((c) => c.status === s).length }));
  return {
    figures: [
      { label: "Signed contracts", value: ctr.filter((c) => c.status === "signed").length, to: "/app/legal" },
      { label: "Drafts", value: ctr.filter((c) => c.status === "draft").length },
      { label: "Ending in 30 days", value: buckets[1].contracts },
      { label: "Signed value", value: ctr.filter((c) => c.status === "signed").reduce((t, c) => t + n(c.value_ugx), 0), money: true },
    ],
    charts: [
      { title: "When signed contracts end", kind: "bar", wide: true, xKey: "window", series: [{ key: "contracts", label: "Contracts" }], data: buckets, to: "/app/legal",
        explain: { what: "Signed client contracts grouped by how soon they end.", how: "Days between today and each contract's end date.", good: "Nothing 'Expired'. Anything in the next 30 days should already have a renewal draft." } },
      { title: "Contracts by status", kind: "bar", xKey: "status", series: [{ key: "contracts", label: "Contracts" }], data: status,
        explain: { what: "Drafts, signed and cancelled contracts.", how: "Current status of every client contract.", good: "Drafts shouldn't sit for more than a week." } },
    ],
  };
}

async function relations(): Promise<DeptBoard> {
  const [fu, res, ctr] = await Promise.all([
    rows(supabase.from("client_followups").select("due_date, done_at")),
    rows(supabase.from("residents").select("onboarding_status, lifecycle_status, archived_at")),
    rows(supabase.from("resident_contracts").select("status, ends_on")),
  ]);
  const keys = weekKeys(8);
  const weeks = keys.map((k) => ({ week: wkLabel(k), due: 0, done: 0 }));
  for (const f of fu) { const a = bucket(keys, f.due_date); if (a >= 0) weeks[a].due++; const b = bucket(keys, f.done_at); if (b >= 0) weeks[b].done++; }
  const live = res.filter((r) => !r.archived_at);
  const life = [...new Set(live.map((r) => r.lifecycle_status ?? "unset"))].map((s) => ({ stage: String(s), clients: live.filter((r) => (r.lifecycle_status ?? "unset") === s).length }));
  const today = iso(new Date());
  return {
    figures: [
      { label: "Follow-ups overdue", value: fu.filter((f) => !f.done_at && f.due_date && f.due_date < today).length, to: "/app/relations" },
      { label: "Clients onboarding", value: live.filter((r) => r.onboarding_status && r.onboarding_status !== "done" && r.onboarding_status !== "onboarded").length, to: "/app/relations" },
      { label: "Renewals in 60 days", value: ctr.filter((c) => c.status === "signed" && c.ends_on && c.ends_on <= addDays(60) && c.ends_on >= today).length },
      { label: "Active clients", value: live.filter((r) => r.lifecycle_status === "active").length, to: "/app/residents" },
    ],
    charts: [
      { title: "Follow-ups due vs done, 8 weeks", kind: "bar", wide: true, xKey: "week", series: [{ key: "due", label: "Due" }, { key: "done", label: "Done" }], data: weeks, to: "/app/relations",
        explain: { what: "How well we keep promises to call or check in with clients.", how: "Follow-ups by due week against those completed that week.", good: "'Done' matching or beating 'Due' every week." } },
      { title: "Clients by stage", kind: "bar", xKey: "stage", series: [{ key: "clients", label: "Clients" }], data: life,
        explain: { what: "Where each client is in their journey with us.", how: "Worked out automatically from contracts, onboarding and payments.", good: "Most clients 'active'; 'renewal' clients need a conversation now." } },
    ],
  };
}

async function talent(): Promise<DeptBoard> {
  const [bk, cr] = await Promise.all([
    rows(supabase.from("talent_bookings").select("booked_on, fee_ugx, status")),
    rows(supabase.from("campaign_results").select("recorded_on, reach, engagements, revenue_ugx")),
  ]);
  const months = monthKeys();
  const spend = months.map((m) => ({ month: monLabel(m), fees: bk.filter((b) => b.status !== "cancelled" && (b.booked_on ?? "").slice(0, 7) === m).reduce((t, b) => t + n(b.fee_ugx), 0) }));
  const reach = months.map((m) => { const r = cr.filter((c) => (c.recorded_on ?? "").slice(0, 7) === m); return { month: monLabel(m), reach: r.reduce((t, c) => t + n(c.reach), 0), engagements: r.reduce((t, c) => t + n(c.engagements), 0) }; });
  return {
    figures: [
      { label: "Upcoming bookings", value: bk.filter((b) => ["requested", "confirmed"].includes(b.status) && (b.booked_on ?? "") >= iso(new Date())).length, to: "/app/talent" },
      { label: "Awaiting confirmation", value: bk.filter((b) => b.status === "requested").length },
      { label: "Campaign reach (all)", value: cr.reduce((t, c) => t + n(c.reach), 0).toLocaleString() },
      { label: "Campaign revenue", value: cr.reduce((t, c) => t + n(c.revenue_ugx), 0), money: true },
    ],
    charts: [
      { title: "Campaign reach and engagement", kind: "area", wide: true, xKey: "month", series: [{ key: "reach", label: "Reach" }, { key: "engagements", label: "Engagements" }], data: reach, to: "/app/talent",
        explain: { what: "How many people our campaigns reached and how many interacted.", how: "Results recorded against campaigns, by month.", good: "Engagement staying above 3% of reach. Compare with the Forecasts tab." } },
      { title: "Talent fees per month", kind: "bar", money: true, xKey: "month", series: [{ key: "fees", label: "Fees" }], data: spend,
        explain: { what: "What we committed to pay talent each month.", how: "Fees on bookings not cancelled, by booking date.", good: "Fees rising only when campaign revenue rises too." } },
    ],
  };
}

async function people(): Promise<DeptBoard> {
  const month = iso(new Date()).slice(0, 7);
  const [tm, kt, lt, sp, sv, se, sdoc] = await Promise.all([
    rows(supabase.from("team_members").select("user_id, display_name, email")),
    rows(supabase.from("kpi_targets").select("user_id, month, target_value, manual_actual")),
    rows(supabase.from("leadership_tasks").select("status, due_at")),
    rows(supabase.from("staff_profiles" as never).select("*")),
    rows(supabase.from("staff_private" as never).select("*")),
    rows(supabase.from("staff_employment" as never).select("user_id, contract_end, probation_end")),
    rows(supabase.from("staff_documents" as never).select("user_id, kind")),
  ]);
  const fileBands = [{ band: "0–49%", people: 0 }, { band: "50–79%", people: 0 }, { band: "80–99%", people: 0 }, { band: "Complete", people: 0 }];
  for (const m of tm) {
    const c = completeness(sp.find((x) => x.user_id === m.user_id) ?? null, sv.find((x) => x.user_id === m.user_id) ?? null, sdoc.filter((d) => d.user_id === m.user_id)).pct;
    fileBands[c >= 100 ? 3 : c >= 80 ? 2 : c >= 50 ? 1 : 0].people++;
  }
  const todayIso = iso(new Date());
  const in90 = iso(new Date(Date.now() + 90 * 864e5));
  const expiring = [
    { what: "Work permits", count: sv.filter((x) => x.permit_expiry && x.permit_expiry >= todayIso && x.permit_expiry <= in90).length },
    { what: "Passports", count: sv.filter((x) => x.passport_expiry && x.passport_expiry >= todayIso && x.passport_expiry <= in90).length },
    { what: "Contracts", count: se.filter((x) => x.contract_end && x.contract_end >= todayIso && x.contract_end <= in90).length },
    { what: "Probation", count: se.filter((x) => x.probation_end && x.probation_end >= todayIso && x.probation_end <= in90).length },
  ];
  const names = new Map(tm.map((t) => [t.user_id, t.display_name || (t.email ?? "").split("@")[0]]));
  const mine = kt.filter((k) => (k.month ?? "").slice(0, 7) === month);
  const per = new Map<string, { person: string; targets: number; hit: number }>();
  for (const k of mine) { const p = per.get(k.user_id) ?? { person: names.get(k.user_id) ?? "Staff", targets: 0, hit: 0 }; p.targets++; if (n(k.manual_actual) >= n(k.target_value) && n(k.target_value) > 0) p.hit++; per.set(k.user_id, p); }
  const taskStat = ["open", "in_progress", "submitted", "accepted"].map((s) => ({ status: s.replace("_", " "), tasks: lt.filter((t) => t.status === s).length }));
  return {
    figures: [
      { label: "Team members", value: tm.length, to: "/app/team" },
      { label: "Targets set this month", value: mine.length, to: "/app/kpi-desk" },
      { label: "People with targets", value: per.size },
      { label: "Tasks overdue", value: lt.filter((t) => !["accepted", "cancelled"].includes(t.status) && t.due_at && t.due_at < new Date().toISOString()).length, to: "/app/work" },
    ],
    charts: [
      { title: "KPI targets this month — set vs hit", kind: "hbar", wide: true, xKey: "person", series: [{ key: "targets", label: "Targets" }, { key: "hit", label: "Hit so far" }], data: [...per.values()], to: "/app/kpi-desk",
        explain: { what: "Each person's monthly targets and how many they have already hit.", how: "Targets from the KPI desk; 'hit' when the recorded result reaches the target.", good: "Bars closing up by month end. Hit = 30% bonus, miss = −30%." } },
      { title: "Assigned work by status", kind: "bar", xKey: "status", series: [{ key: "tasks", label: "Tasks" }], data: taskStat, to: "/app/work",
        explain: { what: "Leadership-assigned tasks across the team.", how: "Current status of every assigned task.", good: "'Submitted' tasks reviewed quickly so they move to 'accepted'." } },
      { title: "Staff files — how complete", kind: "bar", xKey: "band", series: [{ key: "people", label: "People" }], data: fileBands, to: "/app/ops/people",
        explain: { what: "How much of each person's staff file is filled in.", how: "Required personal, ID (NIN for Ugandans, passport and work permit for foreigners), next of kin and education fields, plus required documents.", good: "Everyone in 'Complete'. Chase anyone under 50%." } },
      { title: "Ending in the next 90 days", kind: "bar", xKey: "what", series: [{ key: "count", label: "People" }], data: expiring, to: "/app/ops/people",
        explain: { what: "Work permits, passports, contracts and probation periods ending soon.", how: "Dates from staff files; HR and the MD also get alerts at 60, 30 and 7 days.", good: "Zero work permits here without a renewal already started." } },
    ],
  };
}

async function ops(): Promise<DeptBoard> {
  const keys = weekKeys(8);
  const [sd, eq, lt] = await Promise.all([
    rows(supabase.from("shoot_days").select("shoot_date, status, budget_ugx")),
    rows(supabase.from("equipment").select("quantity, active, category")),
    rows(supabase.from("leadership_tasks").select("status")),
  ]);
  const weeks = keys.map((k) => ({ week: wkLabel(k), shoots: 0 }));
  for (const s of sd) { const i = bucket(keys, s.shoot_date); if (i >= 0) weeks[i].shoots++; }
  const cats = new Map<string, number>();
  for (const e of eq) if (e.active !== false) cats.set(e.category ?? "Other", (cats.get(e.category ?? "Other") ?? 0) + n(e.quantity || 1));
  return {
    figures: [
      { label: "Shoots next 7 days", value: sd.filter((s) => s.shoot_date && s.shoot_date >= iso(new Date()) && s.shoot_date <= addDays(7)).length, to: "/app/shoots" },
      { label: "Unconfirmed shoots", value: sd.filter((s) => s.status === "draft").length },
      { label: "Equipment items", value: [...cats.values()].reduce((a, b) => a + b, 0), to: "/app/equipment" },
      { label: "Open tasks", value: lt.filter((t) => !["accepted", "cancelled"].includes(t.status)).length, to: "/app/work" },
    ],
    charts: [
      { title: "Shoot days per week", kind: "bar", wide: true, xKey: "week", series: [{ key: "shoots", label: "Shoots" }], data: weeks, to: "/app/shoots",
        explain: { what: "How busy production has been each week.", how: "Shoot days counted by date.", good: "A steady rhythm. Spikes need extra crew and equipment booked early." } },
      { title: "Equipment by category", kind: "hbar", xKey: "category", series: [{ key: "items", label: "Items" }], data: [...cats.entries()].map(([category, items]) => ({ category, items })), to: "/app/equipment",
        explain: { what: "What gear we own, grouped by type.", how: "Active equipment quantities.", good: "Enough of each category to cover the busiest shoot week." } },
    ],
  };
}

async function personal(userId: string | null): Promise<DeptBoard> {
  if (!userId) return { figures: [], charts: [] };
  const keys = weekKeys(8);
  const month = iso(new Date()).slice(0, 7);
  const [crew, kt, lt] = await Promise.all([
    rows(supabase.from("content_crew").select("content_id, content_items(stage, posted_at, editor_done_at)").eq("user_id", userId)),
    rows(supabase.from("kpi_targets").select("label, metric, month, target_value, manual_actual").eq("user_id", userId)),
    rows(supabase.from("leadership_task_assignees").select("leadership_tasks(status, due_at)").eq("user_id", userId)),
  ]);
  const weeks = keys.map((k) => ({ week: wkLabel(k), finished: 0 }));
  for (const c of crew) { const ci = c.content_items; const i = bucket(keys, ci?.editor_done_at ?? ci?.posted_at); if (i >= 0) weeks[i].finished++; }
  const targets = kt.filter((k) => (k.month ?? "").slice(0, 7) === month).map((k) => ({ target: k.label || k.metric, goal: n(k.target_value), done: n(k.manual_actual) }));
  const tasks = lt.map((t) => t.leadership_tasks).filter(Boolean);
  return {
    figures: [
      { label: "My pieces in progress", value: crew.filter((c) => c.content_items && !["Posted", "Archived", "Rejected"].includes(c.content_items.stage)).length, to: "/app/content" },
      { label: "My open tasks", value: tasks.filter((t: R) => !["accepted", "cancelled"].includes(t.status)).length, to: "/app/todo" },
      { label: "Targets this month", value: targets.length, to: "/app/kpi" },
      { label: "Targets hit", value: targets.filter((t) => t.goal > 0 && t.done >= t.goal).length, to: "/app/kpi" },
    ],
    charts: [
      { title: "My finished work, 8 weeks", kind: "area", wide: true, xKey: "week", series: [{ key: "finished", label: "Finished" }], data: weeks, to: "/app/content",
        explain: { what: "Pieces you worked on that were finished each week.", how: "Content where you're crew, counted when edited or posted.", good: "A steady or rising line — it feeds your KPI." } },
      { title: "My targets this month", kind: "hbar", xKey: "target", series: [{ key: "goal", label: "Target" }, { key: "done", label: "Done" }], data: targets, to: "/app/kpi",
        explain: { what: "Each target you've been set this month and your progress.", how: "Targets from your manager; progress recorded on the KPI desk.", good: "'Done' reaching 'Target' by month end earns the 30% bonus." } },
    ],
  };
}

export async function loadDeptBoard(dept: DeptKey, userId: string | null): Promise<DeptBoard> {
  switch (dept) {
    case "exec": return exec();
    case "finance": return finance();
    case "sales": return sales();
    case "content": return content();
    case "strategy": return strategy();
    case "legal": return legal();
    case "relations": return relations();
    case "talent": return talent();
    case "people": return people();
    case "ops": return ops();
    default: return personal(userId);
  }
}

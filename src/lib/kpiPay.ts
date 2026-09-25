import { supabase } from "@/integrations/supabase/client";

/* ------------------------------------------------------------------ *
 * KPI score + monthly pay. Pure maths in `computePerson`, one loader.
 * ------------------------------------------------------------------ */

export type Weights = Record<ComponentKey, number>;
export type ComponentKey = "work_done" | "work_missed" | "todo_done" | "content" | "numbers" | "approvals";

export type KpiSettings = {
  hit_bonus_pct: number;
  head_bonus_pct: number;
  miss_penalty_pct: number;
  contract_end_pct: number;
  renewal_pct: number;
  weights: Weights;
};

export const DEFAULT_SETTINGS: KpiSettings = {
  hit_bonus_pct: 30,
  head_bonus_pct: 15,
  miss_penalty_pct: 30,
  contract_end_pct: 10,
  renewal_pct: 5,
  weights: { work_done: 30, work_missed: 15, todo_done: 10, content: 20, numbers: 15, approvals: 10 },
};

export const COMPONENTS: { key: ComponentKey; label: string; negative?: boolean; meaning: string; improve: string }[] = [
  {
    key: "work_done",
    label: "Work assigned and completed",
    meaning: "Share of work given to you this month that was signed off.",
    improve: "Pick up assigned work quickly, hand in what was asked for, and get it signed off before month end.",
  },
  {
    key: "work_missed",
    label: "Work assigned and not done",
    negative: true,
    meaning: "Assigned work past its deadline and still not signed off. This takes points away.",
    improve: "Watch deadlines in To-Do. If something can't be done in time, ask for clarification early instead of letting it go late.",
  },
  {
    key: "todo_done",
    label: "Work handed in on time",
    meaning: "Of the work you handed in, how much came in on or before its deadline.",
    improve: "Submit your update before the due date, not on it.",
  },
  {
    key: "content",
    label: "Content posted and shoots done",
    meaning: "Pieces you worked on that went live, plus shoot days you were on, against your monthly target.",
    improve: "Move your pieces through the pipeline to posted and show up for shoot days.",
  },
  {
    key: "numbers",
    label: "Client numbers filled",
    meaning: "Weekly account numbers for your clients, filled in on time.",
    improve: "Fill in each client's numbers every week — don't wait for reminders.",
  },
  {
    key: "approvals",
    label: "Approvals handled on time",
    meaning: "Sign-offs sent to you that you dealt with before they went late.",
    improve: "Check Approvals daily and decide before the deadline.",
  },
];

export const TARGET_METRICS: { key: string; label: string; unit?: string }[] = [
  { key: "posted", label: "Content posted" },
  { key: "shoots", label: "Shoot days done" },
  { key: "numbers", label: "Client weeks filled" },
  { key: "work_done", label: "Assigned work completed" },
  { key: "kpi_score", label: "KPI score", unit: "%" },
  { key: "custom", label: "Custom target" },
];

export type StaffPay = { user_id: string; base_salary_ugx: number; is_head: boolean; head_bonus_ugx: number; department: string | null };
export type KpiTarget = {
  id: string;
  user_id: string;
  month: string;
  metric: string;
  label: string | null;
  target_value: number;
  approval_state: "pending" | "approved" | "rejected";
  manual_actual: number | null;
};
export type Allowance = { user_id: string; month: string; data_ugx: number; transport_ugx: number; shoot_days: number; note: string | null };
export type ContractBonus = {
  id: string;
  user_id: string;
  resident_id: string | null;
  kind: "end" | "renewal";
  contract_value_ugx: number;
  percent: number;
  amount_ugx: number;
  month: string;
  note: string | null;
};
export type Member = { user_id: string; display_name: string | null; email: string | null; title: string | null };

export type Activity = {
  workTotal: number;
  workDone: number;
  workLate: number;
  submitted: number;
  submittedOnTime: number;
  posted: number;
  shoots: number;
  numbersFilled: number;
  numbersExpected: number;
  approvalsTotal: number;
  approvalsOnTime: number;
};

export type PersonKpi = {
  member: Member;
  pay: StaffPay | null;
  activity: Activity;
  parts: { key: ComponentKey; label: string; value: number | null; weight: number; negative?: boolean }[];
  score: number;
  targets: (KpiTarget & { actual: number; met: boolean; counts: boolean })[];
  allTargetsMet: boolean;
  hasTargets: boolean;
  allowance: Allowance | null;
  contractBonuses: ContractBonus[];
  lines: { label: string; amount: number }[];
  expected: number;
  possible: number;
};

export const monthStart = (d = new Date()) => `${d.toISOString().slice(0, 7)}-01`;
export const monthEnd = (m: string) => {
  const d = new Date(`${m}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
};
export const monthLabel = (m: string) =>
  new Date(`${m}T00:00:00Z`).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });

const ratio = (a: number, b: number) => (b > 0 ? Math.min(1, a / b) : null);

/** Pure: score + pay for one person. */
export function computePerson(input: {
  member: Member;
  pay: StaffPay | null;
  activity: Activity;
  targets: KpiTarget[];
  allowance: Allowance | null;
  contractBonuses: ContractBonus[];
  settings: KpiSettings;
}): PersonKpi {
  const { member, pay, activity: a, allowance, contractBonuses, settings } = input;
  const w = { ...DEFAULT_SETTINGS.weights, ...settings.weights };
  const postedTarget = input.targets.find((t) => t.metric === "posted")?.target_value ?? 0;
  const shootTarget = input.targets.find((t) => t.metric === "shoots")?.target_value ?? 0;

  const contentGoal = postedTarget + shootTarget;
  const contentValue =
    contentGoal > 0 ? ratio(a.posted + a.shoots, contentGoal) : a.posted + a.shoots > 0 ? 1 : null;

  const values: Record<ComponentKey, number | null> = {
    work_done: ratio(a.workDone, a.workTotal),
    work_missed: a.workTotal > 0 ? a.workLate / a.workTotal : null,
    todo_done: ratio(a.submittedOnTime, a.submitted),
    content: contentValue,
    numbers: ratio(a.numbersFilled, a.numbersExpected),
    approvals: ratio(a.approvalsOnTime, a.approvalsTotal),
  };

  const parts = COMPONENTS.map((c) => ({ key: c.key, label: c.label, value: values[c.key], weight: Number(w[c.key] ?? 0), negative: c.negative }));
  const positive = parts.filter((p) => !p.negative && p.value !== null && p.weight > 0);
  const posWeight = positive.reduce((s, p) => s + p.weight, 0);
  let score = posWeight ? positive.reduce((s, p) => s + p.weight * (p.value ?? 0), 0) / posWeight : 0;
  const miss = parts.find((p) => p.key === "work_missed");
  if (miss && miss.value !== null && posWeight) score -= (miss.weight * miss.value) / posWeight;
  score = Math.max(0, Math.min(100, Math.round(score * 100)));

  const actualOf = (t: KpiTarget) => {
    switch (t.metric) {
      case "posted": return a.posted;
      case "shoots": return a.shoots;
      case "numbers": return a.numbersFilled;
      case "work_done": return a.workDone;
      case "kpi_score": return score;
      default: return Number(t.manual_actual ?? 0);
    }
  };
  const targets = input.targets.map((t) => {
    const actual = actualOf(t);
    return { ...t, actual, met: actual >= Number(t.target_value), counts: t.approval_state === "approved" };
  });
  const counting = targets.filter((t) => t.counts);
  const hasTargets = counting.length > 0;
  const allTargetsMet = hasTargets && counting.every((t) => t.met);

  const base = pay?.base_salary_ugx ?? 0;
  const pct = (p: number) => Math.round((base * p) / 100);
  const allow = (allowance?.data_ugx ?? 0) + (allowance?.transport_ugx ?? 0);
  const contract = contractBonuses.reduce((s, c) => s + c.amount_ugx, 0);
  const headExtra = pay?.is_head ? pct(settings.head_bonus_pct) + (pay.head_bonus_ugx ?? 0) : 0;

  const lines: { label: string; amount: number }[] = [{ label: "Base salary", amount: base }];
  if (allowance?.data_ugx) lines.push({ label: "Data allowance", amount: allowance.data_ugx });
  if (allowance?.transport_ugx) lines.push({ label: `Transport (${allowance.shoot_days} shoot days)`, amount: allowance.transport_ugx });
  if (hasTargets) {
    if (allTargetsMet) {
      lines.push({ label: `Targets hit bonus (+${settings.hit_bonus_pct}%)`, amount: pct(settings.hit_bonus_pct) });
      if (pay?.is_head) lines.push({ label: `Head of department bonus (+${settings.head_bonus_pct}% + head pay)`, amount: headExtra });
    } else {
      lines.push({ label: `Targets missed (-${settings.miss_penalty_pct}%)`, amount: -pct(settings.miss_penalty_pct) });
    }
  }
  contractBonuses.forEach((c) =>
    lines.push({ label: c.kind === "end" ? `Contract targets bonus (${c.percent}%)` : `Renewal bonus (+${c.percent}%)`, amount: c.amount_ugx })
  );

  const expected = lines.reduce((s, l) => s + l.amount, 0);
  const possible = base + allow + pct(settings.hit_bonus_pct) + headExtra + contract;

  return { member, pay, activity: a, parts, score, targets, allTargetsMet, hasTargets, allowance, contractBonuses, lines, expected, possible };
}

const emptyActivity = (): Activity => ({
  workTotal: 0, workDone: 0, workLate: 0, submitted: 0, submittedOnTime: 0,
  posted: 0, shoots: 0, numbersFilled: 0, numbersExpected: 0, approvalsTotal: 0, approvalsOnTime: 0,
});

export async function loadSettings(): Promise<KpiSettings> {
  const { data } = await supabase.from("kpi_settings" as never).select("*").maybeSingle();
  if (!data) return DEFAULT_SETTINGS;
  const d = data as unknown as KpiSettings;
  return {
    hit_bonus_pct: Number(d.hit_bonus_pct), head_bonus_pct: Number(d.head_bonus_pct), miss_penalty_pct: Number(d.miss_penalty_pct),
    contract_end_pct: Number(d.contract_end_pct), renewal_pct: Number(d.renewal_pct),
    weights: { ...DEFAULT_SETTINGS.weights, ...(d.weights ?? {}) },
  };
}

/** Load everything for one month. `onlyUser` narrows to one person (My KPI). */
export async function loadKpiMonth(month: string, onlyUser?: string) {
  const end = monthEnd(month);
  const from = `${month}T00:00:00Z`;
  const to = `${end}T23:59:59Z`;
  const today = new Date().toISOString().slice(0, 10);
  const q = <T,>(p: PromiseLike<{ data: unknown }>) => Promise.resolve(p).then((r) => (r.data as T[]) ?? []);
  const t = (name: string) => supabase.from(name as never);

  const [settings, members, pays, targets, allowances, bonuses, tasks, assignees, content, crew, shoots, shootItems, metrics, assigns, accounts, approvals] =
    await Promise.all([
      loadSettings(),
      q<Member>(supabase.from("team_members").select("user_id, display_name, email, title")),
      q<StaffPay>(t("staff_pay").select("*")),
      q<KpiTarget>(t("kpi_targets").select("*").eq("month", month)),
      q<Allowance>(t("kpi_allowances").select("*").eq("month", month)),
      q<ContractBonus>(t("kpi_contract_bonuses").select("*").eq("month", month)),
      q<{ id: string; status: string; due_at: string | null; submitted_at: string | null; accepted_at: string | null; created_at: string }>(
        supabase.from("leadership_tasks").select("id,status,due_at,submitted_at,accepted_at,created_at").or(`and(due_at.gte.${from},due_at.lte.${to}),and(due_at.is.null,created_at.gte.${from},created_at.lte.${to})`)
      ),
      q<{ task_id: string; user_id: string }>(supabase.from("leadership_task_assignees").select("task_id,user_id")),
      q<{ id: string; posted_at: string | null }>(supabase.from("content_items").select("id,posted_at").gte("posted_at", from).lte("posted_at", to)),
      q<{ content_id: string; user_id: string | null }>(supabase.from("content_crew").select("content_id,user_id")),
      q<{ id: string; shoot_date: string | null; status: string; created_by: string | null; confirmed_by: string | null }>(
        supabase.from("shoot_days").select("id,shoot_date,status,created_by,confirmed_by").gte("shoot_date", month).lte("shoot_date", end)
      ),
      q<{ shoot_day_id: string; content_id: string }>(supabase.from("shoot_day_items").select("shoot_day_id,content_id")),
      q<{ account_id: string; week_start: string; filled_by: string | null }>(
        supabase.from("account_metrics").select("account_id,week_start,filled_by").gte("week_start", month).lte("week_start", end)
      ),
      q<{ resident_id: string; user_id: string }>(supabase.from("client_assignments").select("resident_id,user_id")),
      q<{ id: string; resident_id: string }>(supabase.from("client_accounts").select("id,resident_id")),
      q<{ assigned_user_id: string | null; status: string; due_at: string | null; acted_at: string | null; acted_by: string | null }>(
        supabase.from("approval_tasks").select("assigned_user_id,status,due_at,acted_at,acted_by").gte("created_at", from).lte("created_at", to)
      ),
    ]);

  // Weeks in the month so far (Mondays up to today / month end).
  const weekStarts: string[] = [];
  const cursor = new Date(`${month}T00:00:00Z`);
  const stop = end < today ? end : today;
  while (cursor.toISOString().slice(0, 10) <= stop) {
    if (cursor.getUTCDay() === 1) weekStarts.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const taskById = new Map(tasks.map((x) => [x.id, x]));
  const doneShoots = shoots.filter((s) => s.status === "done");
  const people = onlyUser ? members.filter((m) => m.user_id === onlyUser) : members;

  const result = people.map((member) => {
    const uid = member.user_id;
    const a = emptyActivity();
    assignees.filter((x) => x.user_id === uid).forEach((x) => {
      const tk = taskById.get(x.task_id);
      if (!tk || tk.status === "cancelled") return;
      a.workTotal++;
      if (tk.status === "accepted") a.workDone++;
      else if (tk.due_at && tk.due_at.slice(0, 10) < today) a.workLate++;
      if (tk.submitted_at) {
        a.submitted++;
        if (!tk.due_at || tk.submitted_at <= tk.due_at) a.submittedOnTime++;
      }
    });
    const mine = new Set(crew.filter((c) => c.user_id === uid).map((c) => c.content_id));
    a.posted = content.filter((c) => mine.has(c.id)).length;
    const myDays = new Set(shootItems.filter((s) => mine.has(s.content_id)).map((s) => s.shoot_day_id));
    a.shoots = doneShoots.filter((s) => myDays.has(s.id) || s.created_by === uid || s.confirmed_by === uid).length;
    const myRes = new Set(assigns.filter((x) => x.user_id === uid).map((x) => x.resident_id));
    const myAcc = new Set(accounts.filter((x) => myRes.has(x.resident_id)).map((x) => x.id));
    a.numbersExpected = myAcc.size * weekStarts.length;
    a.numbersFilled = metrics.filter((m) => myAcc.has(m.account_id) && m.filled_by).length;
    approvals.filter((x) => x.assigned_user_id === uid).forEach((x) => {
      a.approvalsTotal++;
      if (x.acted_at && (!x.due_at || x.acted_at <= x.due_at)) a.approvalsOnTime++;
    });

    return computePerson({
      member,
      pay: pays.find((p) => p.user_id === uid) ?? null,
      activity: a,
      targets: targets.filter((x) => x.user_id === uid),
      allowance: allowances.find((x) => x.user_id === uid) ?? null,
      contractBonuses: bonuses.filter((x) => x.user_id === uid),
      settings,
    });
  });

  return { settings, people: result, members, targets, assigns };
}

export const ugx = (n: number) => `UGX ${Math.round(n).toLocaleString()}`;

import { supabase } from "@/integrations/supabase/client";
import type { StateTone } from "@/components/system";

/** Money a client has put in, and money spent on their shoots. */

export type FundLine = {
  id: string;
  resident_id: string;
  direction: "top_up" | "refund";
  amount_ugx: number;
  received_on: string;
  method: string | null;
  reference: string | null;
  note: string | null;
  attachment_path: string | null;
  shoot_day_id: string | null;
  added_by: string | null;
  created_at: string;
};

export type SpendLine = {
  id: string;
  shoot_day_id: string;
  resident_id: string | null;
  payer: "studio" | "client";
  amount_ugx: number;
  category: string;
  note: string | null;
  attachment_path: string | null;
  spent_on: string;
  spent_by: string | null;
  cashbook_entry_id: string | null;
  created_at: string;
};

export const SPEND_CATEGORIES = [
  "transport",
  "food",
  "location",
  "props",
  "talent",
  "permits",
  "gear hire",
  "data",
  "other",
] as const;

export const PAY_METHODS = ["cash", "mobile money", "bank transfer", "card", "other"] as const;

export const ugx = (n: number) => `UGX ${Math.round(n).toLocaleString()}`;

export const dayLabel = (d: string | null) =>
  d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";

export const todayKampala = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kampala" }).format(new Date());

/** Money in minus refunds minus everything the client paid for. */
export function potBalance(funds: FundLine[], spend: SpendLine[]) {
  const inflow = funds.reduce((a, f) => a + (f.direction === "top_up" ? f.amount_ugx : -f.amount_ugx), 0);
  const clientPaid = spend.filter((s) => s.payer === "client").reduce((a, s) => a + s.amount_ugx, 0);
  return { inflow, clientPaid, balance: inflow - clientPaid };
}

export function dayTotals(spend: SpendLine[]) {
  const studio = spend.filter((s) => s.payer === "studio").reduce((a, s) => a + s.amount_ugx, 0);
  const client = spend.filter((s) => s.payer === "client").reduce((a, s) => a + s.amount_ugx, 0);
  return { studio, client, total: studio + client };
}

export async function loadClientMoney(residentId: string) {
  const [{ data: funds }, { data: spend }] = await Promise.all([
    supabase.from("client_funds").select("*").eq("resident_id", residentId).order("received_on", { ascending: false }),
    supabase.from("shoot_spend").select("*").eq("resident_id", residentId).order("spent_on", { ascending: false }),
  ]);
  return {
    funds: ((funds ?? []) as FundLine[]),
    spend: ((spend ?? []) as SpendLine[]),
  };
}

export async function loadDayMoney(dayId: string) {
  const { data } = await supabase
    .from("shoot_spend")
    .select("*")
    .eq("shoot_day_id", dayId)
    .order("created_at", { ascending: false });
  return (data ?? []) as SpendLine[];
}

export async function addFunds(input: {
  residentId: string;
  direction: "top_up" | "refund";
  amount: number;
  receivedOn: string;
  method?: string | null;
  reference?: string | null;
  note?: string | null;
  shootDayId?: string | null;
}) {
  const { error } = await supabase.from("client_funds").insert({
    resident_id: input.residentId,
    direction: input.direction,
    amount_ugx: Math.round(input.amount),
    received_on: input.receivedOn,
    method: input.method ?? null,
    reference: input.reference ?? null,
    note: input.note ?? null,
    shoot_day_id: input.shootDayId ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function addSpend(input: {
  shootDayId: string;
  residentId: string | null;
  payer: "studio" | "client";
  amount: number;
  category: string;
  note?: string | null;
  spentOn: string;
}) {
  const { error } = await supabase.from("shoot_spend").insert({
    shoot_day_id: input.shootDayId,
    resident_id: input.residentId,
    payer: input.payer,
    amount_ugx: Math.round(input.amount),
    category: input.category,
    note: input.note ?? null,
    spent_on: input.spentOn,
  });
  if (error) throw new Error(error.message);
}

export async function removeSpend(id: string) {
  const { error } = await supabase.from("shoot_spend").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* ---------------- what was shot ---------------- */

export type Outcome = "planned" | "shot" | "partly" | "missed";

export const OUTCOME_LABEL: Record<Outcome, string> = {
  planned: "Not marked yet",
  shot: "Shot",
  partly: "Partly shot",
  missed: "Not shot",
};

export const OUTCOME_TONE: Record<Outcome, StateTone> = {
  planned: "neutral",
  shot: "teal",
  partly: "amber",
  missed: "stop",
};

export async function setOutcome(
  itemId: string,
  outcome: Outcome,
  note: string | null,
  footageWhere: string | null,
  userId: string | null
) {
  const { error } = await supabase
    .from("shoot_day_items")
    .update({
      outcome,
      outcome_note: note,
      footage_where: footageWhere,
      outcome_by: userId,
      outcome_at: new Date().toISOString(),
    })
    .eq("id", itemId);
  if (error) throw new Error(error.message);
}

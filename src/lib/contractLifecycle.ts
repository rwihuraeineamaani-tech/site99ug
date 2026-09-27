import { supabase } from "@/integrations/supabase/client";
import type { StateTone } from "@/components/system/StatusChip";

/** Client contract statuses. Only draft / signed / cancelled are set by people; the rest follow the dates and payments. */
export const CONTRACT_LABEL: Record<string, string> = {
  draft: "Draft",
  signed: "Signed – not started",
  active: "Running",
  renewal_due: "Renewal due",
  renewed: "Renewed",
  complete: "Complete",
  ended_unpaid: "Ended – balance owed",
  cancelled: "Cancelled",
  archived: "Archived",
};

export const CONTRACT_TONE: Record<string, StateTone> = {
  draft: "neutral",
  signed: "pending",
  active: "teal",
  renewal_due: "amber",
  renewed: "lime",
  complete: "blue",
  ended_unpaid: "stop",
  cancelled: "stop",
  archived: "neutral",
};

/** Statuses a person may choose by hand. Signed contracts become Running on their start date automatically. */
export const MANUAL_CONTRACT_STATUSES = ["draft", "signed", "cancelled"] as const;

export const CLIENT_STATUS_TONE: Record<string, StateTone> = {
  active: "teal",
  renewal_due: "amber",
  complete: "blue",
  ended_unpaid: "stop",
  onboarding: "pending",
};

export const clientTone = (status?: string | null): StateTone => {
  const k = (status ?? "").toLowerCase().replace(/ /g, "_");
  if (k === "balance_owed") return "stop";
  return CLIENT_STATUS_TONE[k] ?? "neutral";
};

export type ContractMoney = {
  contract_id: string;
  resident_id: string;
  title: string;
  status: string;
  starts_on: string | null;
  ends_on: string | null;
  renewal_due_on: string | null;
  value_ugx: number;
  invoiced_ugx: number;
  paid_ugx: number;
  outstanding_ugx: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = supabase.rpc as any;

export async function loadContractMoney(residentId?: string): Promise<ContractMoney[]> {
  const { data, error } = await rpc("contract_finance_summary", residentId ? { _resident_id: residentId } : {});
  if (error) return [];
  return ((data as ContractMoney[]) ?? []).map((r) => ({
    ...r,
    value_ugx: Number(r.value_ugx ?? 0),
    invoiced_ugx: Number(r.invoiced_ugx ?? 0),
    paid_ugx: Number(r.paid_ugx ?? 0),
    outstanding_ugx: Number(r.outstanding_ugx ?? 0),
  }));
}

/** Creates a draft follow-on contract prefilled from the old one, starting the day after it ends. */
export async function startRenewal(c: {
  id: string;
  resident_id: string;
  title: string;
  starts_on: string | null;
  ends_on: string | null;
  value_ugx: number | null;
}) {
  const next = (d: string) => {
    const x = new Date(`${d}T00:00:00Z`);
    x.setUTCDate(x.getUTCDate() + 1);
    return x.toISOString().slice(0, 10);
  };
  let starts: string | null = c.ends_on ? next(c.ends_on) : null;
  let ends: string | null = null;
  if (c.starts_on && c.ends_on && starts) {
    const len = new Date(`${c.ends_on}T00:00:00Z`).getTime() - new Date(`${c.starts_on}T00:00:00Z`).getTime();
    ends = new Date(new Date(`${starts}T00:00:00Z`).getTime() + len).toISOString().slice(0, 10);
  }
  if (!starts) starts = null;
  const { data: u } = await supabase.auth.getUser();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from("resident_contracts") as any)
    .insert({
      resident_id: c.resident_id,
      title: `${c.title.replace(/ \(renewal\)$/i, "")} (renewal)`,
      starts_on: starts,
      ends_on: ends,
      value_ugx: c.value_ugx,
      status: "draft",
      renewed_from_id: c.id,
      created_by: u.user?.id ?? null,
    })
    .select("id")
    .single();
}

export const RENEWABLE = new Set(["active", "renewal_due", "ended_unpaid", "complete"]);

import { supabase } from "@/integrations/supabase/client";

export const SALES_STAGES = ["new_lead", "contacted", "qualified", "discovery", "proposal", "negotiation", "won", "lost"] as const;
export type SalesStage = (typeof SALES_STAGES)[number];
export const STAGE_LABEL: Record<SalesStage, string> = {
  new_lead: "New lead", contacted: "Contacted", qualified: "Qualified", discovery: "Discovery",
  proposal: "Proposal", negotiation: "Negotiation", won: "Won", lost: "Lost",
};

export type Opportunity = {
  id: string; resident_id: string | null; converted_resident_id: string | null;
  journey: "new_client" | "existing_growth" | "partnership"; organisation_name: string;
  contact_name: string | null; contact_email: string | null; contact_phone: string | null;
  source: string | null; service: string | null; stage: SalesStage; status: "open" | "won" | "lost";
  owner_user_id: string; value_ugx: number; probability: number; expected_close: string | null;
  next_action: string; next_action_at: string; notes: string | null; lost_reason: string | null;
  won_at: string | null; lost_at: string | null; created_at: string; updated_at: string;
};

export type SalesOffer = {
  id: string; opportunity_id: string; kind: "quote" | "estimate" | "proposal" | "rate_card";
  title: string; version: number; status: string; subtotal_ugx: number; discount_ugx: number;
  vat_rate: number; vat_ugx: number; total_ugx: number; valid_until: string | null;
  terms: string | null; notes: string | null; approval_instance_id: string | null; created_at: string;
};

export type SalesFollowup = { id: string; opportunity_id: string; assigned_user_id: string; title: string; due_at: string; status: string };
export type SalesActivity = { id: string; opportunity_id: string; kind: string; summary: string; detail: string | null; actor_id: string; occurred_at: string };
export type SalesAssignment = { id: string; opportunity_id: string; user_id: string; assignment_role: string };
export type SalesPackage = { id: string; name: string; description: string | null; service: string | null; price_ugx: number; vat_rate: number; active: boolean };

export const salesMoney = (value: number) => `UGX ${Math.round(value).toLocaleString()}`;
export const weightedValue = (o: Opportunity) => Math.round(o.value_ugx * o.probability / 100);
export const isFollowupLate = (date: string) => new Date(date).getTime() < Date.now();

export async function moveOpportunity(id: string, stage: SalesStage, reason?: string) {
  return supabase.rpc("sales_move_opportunity", { _id: id, _stage: stage, _reason: reason ?? null });
}

export async function onboardOpportunity(id: string) {
  return supabase.rpc("sales_onboard_resident", { _opportunity_id: id });
}

export function csvDownload(rows: Opportunity[]) {
  const columns = ["Organisation", "Journey", "Stage", "Value UGX", "Probability", "Weighted UGX", "Expected close", "Next action", "Next action at", "Source", "Service"];
  const quote = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const body = rows.map((o) => [o.organisation_name, o.journey, STAGE_LABEL[o.stage], o.value_ugx, o.probability, weightedValue(o), o.expected_close, o.next_action, o.next_action_at, o.source, o.service].map(quote).join(","));
  const blob = new Blob([[columns.join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `site99-sales-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}
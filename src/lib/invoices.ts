/** Invoice vocabulary shared by the register, the payment board and the filing pack. */

export type InvoiceDirection = "out" | "in";
export type InvoiceStatus = "draft" | "sent" | "approved" | "part_paid" | "paid" | "void";

export type Invoice = {
  id: string;
  direction: InvoiceDirection;
  status: InvoiceStatus;
  number: string | null;
  party_kind: string;
  party_name: string;
  resident_id: string | null;
  contract_id: string | null;
  issue_date: string;
  due_date: string | null;
  period_label: string | null;
  category: string;
  subtotal_ugx: number;
  vat_rate: number;
  vat_ugx: number;
  total_ugx: number;
  amount_paid_ugx: number;
  note: string | null;
  file_path: string | null;
  recurring: boolean;
  recur_day: number | null;
  recur_parent_id: string | null;
  approved_at: string | null;
  sent_at: string | null;
  created_at: string;
};

export type InvoiceLine = {
  id: string;
  invoice_id: string;
  description: string;
  qty: number;
  unit_price_ugx: number;
  amount_ugx: number;
  sort: number;
};

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  approved: "Approved to pay",
  part_paid: "Part paid",
  paid: "Paid",
  void: "Void",
};

export const INVOICE_TONE: Record<InvoiceStatus, "neutral" | "pending" | "teal" | "amber" | "blue" | "stop"> = {
  draft: "neutral",
  sent: "blue",
  approved: "pending",
  part_paid: "amber",
  paid: "teal",
  void: "stop",
};

export const OUT_STATUSES: InvoiceStatus[] = ["draft", "sent", "part_paid", "paid", "void"];
export const IN_STATUSES: InvoiceStatus[] = ["draft", "approved", "part_paid", "paid", "void"];

/** VAT is charged on top of the subtotal on invoices we issue. */
export function invoiceTotals(subtotal: number, vatRate: number) {
  const vat = Math.round(subtotal * vatRate);
  return { subtotal: Math.round(subtotal), vat, total: Math.round(subtotal) + vat };
}

export function outstanding(inv: Invoice) {
  return Math.max(0, inv.total_ugx - inv.amount_paid_ugx);
}

export function isOverdue(inv: Invoice) {
  if (!inv.due_date || inv.status === "paid" || inv.status === "void") return false;
  return inv.due_date < new Date().toISOString().slice(0, 10);
}

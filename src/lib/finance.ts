/** Shared finance vocabulary: categories, payment methods and plain-English labels. */

export const EXPENSE_CATEGORIES = [
  "general",
  "production",
  "transport",
  "talent",
  "equipment",
  "rent",
  "utilities",
  "subscriptions",
  "salaries",
  "retainer",
  "marketing",
  "legal",
  "loan",
  "other",
];

export const PAY_METHODS = ["MTN MoMo", "Airtel Money", "Bank transfer", "Cash", "Card"];

export const REQUEST_STATUS_LABEL: Record<string, string> = {
  submitted: "Waiting on the MD",
  md_approved: "Waiting on a founder",
  approved: "Cleared for payment",
  paid: "Paid",
  declined: "Declined",
  cancelled: "Cancelled",
};

export const REQUEST_STATUS_TONE: Record<string, "amber" | "violet" | "teal" | "stop" | "neutral"> = {
  submitted: "amber",
  md_approved: "violet",
  approved: "teal",
  paid: "teal",
  declined: "stop",
  cancelled: "neutral",
};


export const LINE_STATUS_LABEL: Record<string, string> = {
  pending: "Waiting on a founder",
  approved: "Cleared for payment",
  held: "On hold",
  paid: "Paid",
};

export const LOAN_STATUS_LABEL: Record<string, string> = {
  pending_approval: "Waiting on approval",
  active: "Running",
  settled: "Settled",
  written_off: "Written off",
};

export const SOURCE_LABEL: Record<string, string> = {
  cash_request: "Cash request",
  run_line: "Monthly payment",
  loan_disbursement: "Loan paid out",
  loan_repayment: "Loan repayment",
  reversal: "Reversal",
};

export function monthKey(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

export function monthLabel(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

export function dayLabel(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function csv(rows: (string | number)[][]) {
  return rows
    .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

export function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export const WALLET_KINDS = ["mobile_money", "bank", "cash", "other"];

export const WALLET_KIND_LABEL: Record<string, string> = {
  mobile_money: "Mobile money",
  bank: "Bank",
  cash: "Cash",
  other: "Other",
};

export const INCOME_CATEGORIES = [
  "client_payment",
  "retainer",
  "event_sales",
  "project_fee",
  "refund",
  "loan_in",
  "transfer",
  "other",
];

export const COUNTERPARTY_KINDS = ["client", "resident", "team", "supplier", "wallet", "other"];

export const CATEGORY_LABEL: Record<string, string> = {
  client_payment: "Client payment",
  event_sales: "Event sales",
  project_fee: "Project fee",
  loan_in: "Loan received",
  transfer: "Wallet transfer",
};

export function catLabel(c?: string | null) {
  if (!c) return "—";
  return CATEGORY_LABEL[c] ?? c.charAt(0).toUpperCase() + c.slice(1).replace(/_/g, " ");
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function monthBounds(monthISO: string) {
  const start = new Date(`${monthISO.slice(0, 7)}-01T00:00:00`);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: iso(start), to: iso(end) };
}

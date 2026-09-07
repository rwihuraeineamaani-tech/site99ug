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

/** Shared finance vocabulary: categories, payment methods and plain-English labels. */

export const EXPENSE_CATEGORIES = [
  "general",
  "production",
  "transport",
  "talent",
  "equipment",
  "equipment_purchase",
  "computers_software",
  "vehicle_purchase",
  "furniture_fittings",
  "building_improvement",
  "rent",
  "utilities",
  "subscriptions",
  "salaries",
  "retainer",
  "marketing",
  "legal",
  "bank_charges",
  "taxes_paid",
  "loan",
  "loan_repayment",
  "owner_drawings",
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

/* ---------------------------------------------------------------------------
   Capex / opex and the Uganda tax view.
   Plain-English guidance so whoever logs an entry picks the right category and
   the accountant can see, at a glance, what is deductible and what is withheld.
   Not tax advice — confirm anything unusual with the accountant or URA.
--------------------------------------------------------------------------- */

export type SpendKind = "capex" | "opex" | "neither";
export type IncomeKind = "taxable" | "not_taxable" | "neither";

export const SPEND_LABEL: Record<SpendKind, string> = {
  capex: "Capital (capex)",
  opex: "Running cost (opex)",
  neither: "Neither",
};

export type CategoryRule = {
  /** Capital spend, running cost, or neither (money that is not a cost at all). */
  spend: SpendKind;
  /** For money in: does URA treat it as business income? */
  income?: IncomeKind;
  /** Corporation-tax treatment in one line. */
  treatment: string;
  /** VAT position. */
  vat: string;
  /** Withholding tax position. */
  wht: string;
};

const OPEX = (treatment: string, vat: string, wht: string): CategoryRule => ({
  spend: "opex",
  treatment,
  vat,
  wht,
});
const CAPEX = (treatment: string, vat: string, wht: string): CategoryRule => ({
  spend: "capex",
  treatment,
  vat,
  wht,
});

export const CATEGORY_TAX: Record<string, CategoryRule> = {
  /* ---- Running costs (opex): deducted in full in the year they are spent ---- */
  general: OPEX(
    "Deductible if it is wholly and exclusively for the business. Keep a receipt or it will be disallowed.",
    "Claim the 18% input VAT only on a proper EFRIS invoice.",
    "Withhold 6% if you are a designated agent and the payment is UGX 1,000,000 or more."
  ),
  production: OPEX(
    "Fully deductible cost of doing the work — shoots, props, location fees.",
    "18% input VAT recoverable on EFRIS invoices from VAT-registered suppliers.",
    "6% on supplier payments of UGX 1,000,000 or more."
  ),
  transport: OPEX(
    "Deductible when it is business travel. Personal trips are not.",
    "Passenger transport is VAT-exempt; fuel carries VAT but input VAT on petrol for cars is restricted.",
    "Rarely applies — boda and taxi payments are usually below the threshold."
  ),
  talent: OPEX(
    "Deductible. If the person works only for us on our terms, URA may treat them as an employee and expect PAYE.",
    "Only if the talent is VAT-registered and issues an EFRIS invoice.",
    "6% on payments of UGX 1,000,000 or more; 15% if the talent is non-resident."
  ),
  equipment: OPEX(
    "Hire, servicing and small repairs are deducted in full this year.",
    "18% input VAT recoverable on an EFRIS invoice.",
    "6% on hire payments of UGX 1,000,000 or more."
  ),
  rent: OPEX(
    "Deductible. Rent paid in advance is spread over the period it covers.",
    "Commercial rent carries 18% VAT if the landlord is registered; residential rent is exempt.",
    "Withhold rental tax on rent to a resident landlord (10%) and 15% to a non-resident."
  ),
  utilities: OPEX("Fully deductible.", "18% input VAT on Umeme and NWSC bills in the company name.", "Not applicable."),
  subscriptions: OPEX(
    "Software and platform fees are deductible.",
    "Imported digital services carry 18% reverse-charge VAT that we must self-account for.",
    "Non-resident digital providers face 5% digital services tax; 15% WHT may apply on other non-resident fees."
  ),
  salaries: OPEX(
    "Deductible, but only if PAYE has been operated on it.",
    "No VAT on employment.",
    "PAYE on the graduated scale, NSSF 10% employer plus 5% employee, and Local Service Tax."
  ),
  retainer: OPEX(
    "Deductible where it is a genuine service fee to a creator or contractor.",
    "18% if the payee is VAT-registered.",
    "6% on payments of UGX 1,000,000 or more."
  ),
  marketing: OPEX(
    "Advertising and promotion are deductible. Gifts and entertainment are restricted.",
    "18% recoverable locally; ads bought from Meta, Google and TikTok carry reverse-charge VAT.",
    "15% on payments to non-resident platforms unless a treaty says otherwise."
  ),
  legal: OPEX(
    "Professional fees are deductible, except fees on buying an asset — those go into the asset's cost.",
    "18% input VAT on an EFRIS invoice.",
    "6% on professional fees of UGX 1,000,000 or more."
  ),
  bank_charges: OPEX(
    "Deductible.",
    "Financial services are largely VAT-exempt; ledger fees may carry VAT.",
    "Not applicable. Mobile money withdrawals also carry the 0.5% levy."
  ),
  taxes_paid: {
    spend: "neither",
    treatment: "Income tax and penalties are NOT deductible. VAT and PAYE remitted are pass-through, not a cost.",
    vat: "No input VAT on a tax payment.",
    wht: "Not applicable.",
  },
  loan: {
    spend: "neither",
    treatment: "Money lent out is not an expense. Only interest we pay is deductible, and capped at 30% of EBITDA.",
    vat: "Exempt.",
    wht: "15% on interest paid.",
  },
  loan_repayment: {
    spend: "neither",
    treatment: "Repaying principal is not a cost — it clears a liability. Only the interest portion is deductible.",
    vat: "Exempt.",
    wht: "15% on the interest portion.",
  },
  owner_drawings: {
    spend: "neither",
    treatment: "Not a business expense. It is a distribution and must never reduce taxable profit.",
    vat: "Not applicable.",
    wht: "15% withholding if it is formally paid as a dividend.",
  },

  /* ---- Capital spend (capex): written off over time, not in one year ---- */
  equipment_purchase: CAPEX(
    "Cameras, lights and lenses are assets. Claim capital allowances (declining balance) instead of the full cost.",
    "18% input VAT recoverable in the month of purchase on an EFRIS invoice.",
    "6% on purchases of UGX 1,000,000 or more from a local supplier; import duty and 18% VAT apply at the border."
  ),
  computers_software: CAPEX(
    "Computers and long-life software are Class I assets — 40% declining balance.",
    "18% recoverable; imported software carries reverse-charge VAT.",
    "6% locally; 15% on non-resident licence fees (royalties)."
  ),
  vehicle_purchase: CAPEX(
    "Vehicles are capital. Cars other than commercial vehicles have a capped deductible cost.",
    "Input VAT on passenger cars is generally blocked; commercial vehicles are recoverable.",
    "6% on the local purchase; duty and VAT at import."
  ),
  furniture_fittings: CAPEX(
    "Furniture and office fittings are capital — written off over their life.",
    "18% recoverable on an EFRIS invoice.",
    "6% on purchases of UGX 1,000,000 or more."
  ),
  building_improvement: CAPEX(
    "Improving premises is capital. Industrial buildings get a 5% straight-line allowance; ordinary repairs do not.",
    "18% recoverable if the works are invoiced by a registered contractor.",
    "6% on contractor payments of UGX 1,000,000 or more."
  ),
  other: OPEX(
    "Only deductible if it is clearly for the business. If it is an asset lasting over a year, log it as capital instead.",
    "Depends on the supply.",
    "6% if the payment is UGX 1,000,000 or more."
  ),

  /* ---- Money in ---- */
  client_payment: {
    spend: "neither",
    income: "taxable",
    treatment: "Business income, taxed at the 30% corporation rate on profit.",
    vat: "Charge 18% output VAT and raise an EFRIS invoice once we are VAT-registered.",
    wht: "The client may withhold 6% — claim it back as a tax credit, so keep the certificate.",
  },
  event_sales: {
    spend: "neither",
    income: "taxable",
    treatment: "Taxable business income.",
    vat: "Ticket sales carry 18% output VAT.",
    wht: "Not usually withheld.",
  },
  project_fee: {
    spend: "neither",
    income: "taxable",
    treatment: "Taxable business income.",
    vat: "18% output VAT on an EFRIS invoice.",
    wht: "Clients who are designated agents will withhold 6%.",
  },
  refund: {
    spend: "neither",
    income: "not_taxable",
    treatment: "Getting our own money back — not income. Reverse the original expense instead.",
    vat: "Adjust the input VAT already claimed with a credit note.",
    wht: "Not applicable.",
  },
  loan_in: {
    spend: "neither",
    income: "not_taxable",
    treatment: "Borrowed money is a liability, not income. Never counts as revenue.",
    vat: "Exempt.",
    wht: "Not applicable.",
  },
  transfer: {
    spend: "neither",
    income: "neither",
    treatment: "Moving our own money between wallets. No effect on profit or tax.",
    vat: "Not applicable.",
    wht: "Not applicable.",
  },
};

const FALLBACK: CategoryRule = {
  spend: "opex",
  treatment: "Treated as a running cost. Confirm with the accountant if it is unusual.",
  vat: "Depends on the supply.",
  wht: "6% if the payment is UGX 1,000,000 or more and we are a designated agent.",
};

export function taxRule(category?: string | null): CategoryRule {
  if (!category) return FALLBACK;
  return CATEGORY_TAX[category] ?? FALLBACK;
}

/** Capital, running cost or neither — for a money-out entry. */
export function spendKind(category?: string | null): SpendKind {
  return taxRule(category).spend;
}

/** Categories grouped for the picker. */
export const CAPEX_CATEGORIES = EXPENSE_CATEGORIES.filter((c) => taxRule(c).spend === "capex");
export const OPEX_CATEGORIES = EXPENSE_CATEGORIES.filter((c) => taxRule(c).spend === "opex");
export const NON_COST_CATEGORIES = EXPENSE_CATEGORIES.filter((c) => taxRule(c).spend === "neither");

export const TAX_DISCLAIMER =
  "General guidance under Ugandan law (Income Tax Act Cap 340, VAT Act Cap 349 and current URA practice). It is not tax advice — confirm anything unusual with the accountant before filing.";

export const TAX_HEADLINES: { title: string; body: string }[] = [
  {
    title: "Capital versus running cost",
    body: "A running cost is used up within the year and comes off profit in full. A capital item lasts longer than a year — it is written off over time through capital allowances (roughly 40% a year declining balance for computers, 30–35% for most plant and equipment, 20% for other machinery, and 5% straight line for industrial buildings). Logging a camera as a running cost overstates the deduction and is the mistake URA looks for first.",
  },
  {
    title: "What is taxable income",
    body: "Client fees, retainers, project fees and ticket sales are taxable business income; company profit is taxed at 30%. Money that is not income: loans received, refunds of our own spending, and transfers between our own wallets.",
  },
  {
    title: "What is never deductible",
    body: "Owner drawings and dividends, income tax itself, fines and penalties, repayment of loan principal, and any spending without a receipt or invoice in the company's name.",
  },
  {
    title: "VAT",
    body: "Registration is required once turnover passes UGX 150 million in a year (or UGX 37.5 million in a quarter). Once registered we charge 18% on our invoices, claim 18% back on purchases backed by EFRIS invoices, and self-account for reverse-charge VAT on imported services such as Meta, Google and software subscriptions. Returns are due by the 15th of the following month.",
  },
  {
    title: "Withholding tax",
    body: "A designated withholding agent withholds 6% on payments of UGX 1,000,000 or more for goods and services, 15% on payments to non-residents, interest and dividends, and rental tax on rent. What clients withhold from us is a credit against our own tax, so always collect the certificate.",
  },
  {
    title: "Payroll",
    body: "Salaries are only deductible if PAYE has been operated. PAYE follows the graduated scale, NSSF is 10% employer plus 5% employee, and Local Service Tax is deducted once a year. All are due by the 15th of the following month.",
  },
];

/**
 * Ugandan filing maths, read straight off the cashbook.
 *
 * Everything here follows the Income Tax Act (Cap 340), the VAT Act (Cap 349)
 * and current URA practice. It prepares the numbers a person then files —
 * it is not tax advice and it does not submit anything.
 */

import { CATEGORY_TAX, catLabel, taxRule } from "@/lib/finance";

export const VAT_RATE = 0.18;
export const COMPANY_TAX_RATE = 0.3;
export const VAT_REG_TURNOVER = 150_000_000;
export const WHT_THRESHOLD = 1_000_000;

export type CashRow = {
  id: string;
  direction: string;
  amount_ugx: number;
  entry_date: string;
  category: string;
  counterparty_name: string;
  counterparty_kind: string;
  reference: string | null;
  note: string | null;
  attachment_path: string | null;
};

/** How VAT behaves for each category. */
export type VatKind = "standard" | "exempt" | "zero" | "reverse_charge" | "outside";

export const VAT_KIND_LABEL: Record<VatKind, string> = {
  standard: "Standard rated 18%",
  exempt: "Exempt",
  zero: "Zero rated",
  reverse_charge: "Imported service — reverse charge",
  outside: "Outside VAT",
};

const VAT_BY_CATEGORY: Record<string, VatKind> = {
  // money in
  client_payment: "standard",
  retainer: "standard",
  project_fee: "standard",
  event_sales: "standard",
  refund: "outside",
  loan_in: "outside",
  transfer: "outside",
  // money out
  general: "standard",
  production: "standard",
  talent: "standard",
  equipment: "standard",
  equipment_purchase: "standard",
  computers_software: "standard",
  vehicle_purchase: "standard",
  furniture_fittings: "standard",
  building_improvement: "standard",
  marketing: "standard",
  legal: "standard",
  utilities: "standard",
  rent: "standard",
  subscriptions: "reverse_charge",
  transport: "exempt",
  salaries: "outside",
  bank_charges: "exempt",
  taxes_paid: "outside",
  loan: "outside",
  loan_repayment: "outside",
  owner_drawings: "outside",
  other: "standard",
};

export function vatKind(category?: string | null): VatKind {
  return VAT_BY_CATEGORY[category ?? ""] ?? "standard";
}

/** VAT inside a gross amount (Uganda prices are quoted VAT inclusive). */
export function vatInside(gross: number) {
  return Math.round((gross * VAT_RATE) / (1 + VAT_RATE));
}

/** Input VAT is only claimable with an invoice on file. */
function hasInvoice(r: CashRow) {
  return !!r.attachment_path;
}

export type VatBucket = { label: string; gross: number; vat: number; rows: CashRow[]; hint: string };

export type VatReturn = {
  sales: VatBucket;
  exemptSales: VatBucket;
  purchases: VatBucket;
  blockedPurchases: VatBucket;
  imported: VatBucket;
  outputVat: number;
  inputVat: number;
  reverseCharge: number;
  net: number;
  dueOn: string;
};

/** The month's VAT position. */
export function buildVatReturn(rows: CashRow[], monthISO: string): VatReturn {
  const bucket = (label: string, hint: string): VatBucket => ({ label, gross: 0, vat: 0, rows: [], hint });

  const sales = bucket("Standard rated sales", "Client fees, retainers, project fees and ticket sales.");
  const exemptSales = bucket("Exempt or outside VAT", "Loans in, refunds and wallet transfers — no VAT.");
  const purchases = bucket("Purchases with input VAT", "Backed by an invoice or receipt on file.");
  const blockedPurchases = bucket("Purchases with no invoice on file", "Input VAT cannot be claimed on these.");
  const imported = bucket("Imported services", "Google, Meta and software — self-account for VAT.");

  rows.forEach((r) => {
    const kind = vatKind(r.category);
    if (r.direction === "in") {
      if (kind === "standard") {
        sales.gross += r.amount_ugx;
        sales.vat += vatInside(r.amount_ugx);
        sales.rows.push(r);
      } else {
        exemptSales.gross += r.amount_ugx;
        exemptSales.rows.push(r);
      }
      return;
    }
    if (kind === "reverse_charge") {
      imported.gross += r.amount_ugx;
      imported.vat += Math.round(r.amount_ugx * VAT_RATE);
      imported.rows.push(r);
      return;
    }
    if (kind !== "standard") return;
    if (hasInvoice(r)) {
      purchases.gross += r.amount_ugx;
      purchases.vat += vatInside(r.amount_ugx);
      purchases.rows.push(r);
    } else {
      blockedPurchases.gross += r.amount_ugx;
      blockedPurchases.rows.push(r);
    }
  });

  const outputVat = sales.vat;
  const inputVat = purchases.vat;
  const reverseCharge = imported.vat;
  const [y, m] = monthISO.slice(0, 7).split("-").map(Number);
  const next = new Date(y, m, 15);
  const dueOn = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-15`;

  return {
    sales,
    exemptSales,
    purchases,
    blockedPurchases,
    imported,
    outputVat,
    inputVat,
    reverseCharge,
    net: outputVat + reverseCharge - inputVat,
    dueOn,
  };
}

/* ------------------------------------------------------------------ *
 * Annual income tax
 * ------------------------------------------------------------------ */

/** Capital allowance rates URA applies, by category. */
export const CAPITAL_ALLOWANCE: Record<string, { rate: number; basis: string }> = {
  computers_software: { rate: 0.4, basis: "40% declining balance — computers and data handling equipment" },
  equipment_purchase: { rate: 0.35, basis: "35% declining balance — plant and equipment" },
  vehicle_purchase: { rate: 0.35, basis: "35% declining balance — commercial vehicles" },
  furniture_fittings: { rate: 0.2, basis: "20% declining balance — furniture, fittings and other machinery" },
  building_improvement: { rate: 0.05, basis: "5% straight line — industrial buildings and improvements" },
};

export type Line = { category: string; label: string; amount: number; rows: CashRow[]; why?: string };

export type AnnualPack = {
  year: string;
  income: Line[];
  incomeTotal: number;
  deductible: Line[];
  deductibleTotal: number;
  disallowed: Line[];
  disallowedTotal: number;
  capital: (Line & { rate: number; allowance: number; basis: string })[];
  capitalTotal: number;
  allowanceTotal: number;
  profit: number;
  tax: number;
  turnoverFlag: boolean;
  whtSuffered: number;
};

const DISALLOWED_WHY: Record<string, string> = {
  owner_drawings: "Owner drawings are a share of profit, never a business cost.",
  loan_repayment: "Repaying loan principal is not a cost — only the interest would be.",
  taxes_paid: "Income tax itself is not deductible.",
  loan: "Money lent out is an asset, not spending.",
};

export function buildAnnualPack(rows: CashRow[], year: string, whtSuffered = 0): AnnualPack {
  const group = new Map<string, { amount: number; rows: CashRow[] }>();
  const add = (key: string, r: CashRow) => {
    const g = group.get(key) ?? { amount: 0, rows: [] };
    g.amount += r.amount_ugx;
    g.rows.push(r);
    group.set(key, g);
  };

  const income: Line[] = [];
  const deductible: Line[] = [];
  const disallowed: Line[] = [];
  const capital: AnnualPack["capital"] = [];

  rows.forEach((r) => add(`${r.direction}:${r.category}`, r));

  group.forEach((g, key) => {
    const [dir, category] = key.split(":");
    const rule = taxRule(category);
    const line: Line = { category, label: catLabel(category), amount: g.amount, rows: g.rows };
    if (dir === "in") {
      if (rule.income === "taxable") income.push(line);
      return;
    }
    if (rule.spend === "capex") {
      const ca = CAPITAL_ALLOWANCE[category] ?? { rate: 0.2, basis: "20% declining balance" };
      capital.push({ ...line, rate: ca.rate, basis: ca.basis, allowance: Math.round(g.amount * ca.rate) });
      return;
    }
    if (rule.spend === "neither") {
      disallowed.push({ ...line, why: DISALLOWED_WHY[category] ?? "Not a business cost." });
      return;
    }
    deductible.push(line);
  });

  const sum = (l: { amount: number }[]) => l.reduce((t, x) => t + x.amount, 0);
  const incomeTotal = sum(income);
  const deductibleTotal = sum(deductible);
  const disallowedTotal = sum(disallowed);
  const capitalTotal = sum(capital);
  const allowanceTotal = capital.reduce((t, c) => t + c.allowance, 0);
  const profit = incomeTotal - deductibleTotal - allowanceTotal;

  const by = (a: Line, b: Line) => b.amount - a.amount;
  income.sort(by);
  deductible.sort(by);
  disallowed.sort(by);
  capital.sort(by);

  return {
    year,
    income,
    incomeTotal,
    deductible,
    deductibleTotal,
    disallowed,
    disallowedTotal,
    capital,
    capitalTotal,
    allowanceTotal,
    profit,
    tax: Math.max(0, Math.round(profit * COMPANY_TAX_RATE)),
    turnoverFlag: incomeTotal >= VAT_REG_TURNOVER,
    whtSuffered,
  };
}

/** Payments in the period that a withholding agent should have withheld 6% on. */
export function whtCandidates(rows: CashRow[]) {
  return rows
    .filter((r) => r.direction === "out" && r.amount_ugx >= WHT_THRESHOLD && vatKind(r.category) !== "outside")
    .map((r) => ({ row: r, withhold: Math.round(r.amount_ugx * 0.06) }))
    .sort((a, b) => b.row.amount_ugx - a.row.amount_ugx);
}

/* ------------------------------------------------------------------ *
 * The guide — what is taxed, what is not, and when it is due
 * ------------------------------------------------------------------ */

export type GuideItem = { title: string; body: string; points?: string[] };

export const FILING_GUIDE: GuideItem[] = [
  {
    title: "What counts as our income",
    body: "Everything we earn from the work is taxable business income and company profit is taxed at 30%.",
    points: [
      "Taxable: client fees, retainers, project fees, event and ticket sales, and anything a client pays us for a service.",
      "Not income: loans received, refunds of our own spending, money moved between our own wallets, and a client's deposit that we are only holding.",
    ],
  },
  {
    title: "Running cost or capital item",
    body: "A running cost is used up within the year and comes off profit in full. A capital item lasts longer and is written off over several years through capital allowances.",
    points: [
      "Computers and software: 40% a year, declining balance.",
      "Cameras, lights, plant and commercial vehicles: 35% a year, declining balance.",
      "Furniture, fittings and other machinery: 20% a year.",
      "Buildings and improvements: 5% a year, straight line.",
      "Logging a camera as a running cost overstates the deduction — that is the first thing URA looks for.",
    ],
  },
  {
    title: "What is never deductible",
    body: "These come out of profit after tax, so keep them out of the cost lines.",
    points: [
      "Owner drawings and dividends.",
      "Income tax itself, and any fine or penalty.",
      "Repayment of loan principal — only interest is a cost.",
      "Any spending with no receipt or invoice in the company's name.",
      "Personal trips, personal airtime and personal shopping run through a company wallet.",
    ],
  },
  {
    title: "VAT",
    body: "Registration becomes compulsory once turnover passes UGX 150 million in a year, or UGX 37.5 million in a quarter.",
    points: [
      "Once registered we charge 18% on our invoices and claim 18% back on purchases backed by a proper EFRIS invoice.",
      "No invoice on file means no input VAT claim — this page lists those separately so nothing is claimed by mistake.",
      "Imported services such as Google Workspace, Meta ads and software subscriptions carry reverse-charge VAT: we account for the 18% ourselves.",
      "Passenger transport, bank charges and residential rent are exempt — no VAT either way.",
      "The return and the money are due by the 15th of the following month.",
    ],
  },
  {
    title: "Withholding tax",
    body: "A designated withholding agent holds back part of a payment and sends it to URA.",
    points: [
      "6% on payments of UGX 1,000,000 or more for goods and services.",
      "15% on payments to non-residents, and on interest and dividends.",
      "Rental payments carry rental withholding tax.",
      "What a client withholds from us is a credit against our own tax — always collect the certificate, or we lose the money.",
    ],
  },
  {
    title: "Payroll — PAYE, NSSF and LST",
    body: "Salaries are only deductible if PAYE has actually been operated on them.",
    points: [
      "PAYE follows the graduated monthly scale and is due by the 15th of the following month.",
      "NSSF is 10% from the company plus 5% from the employee, also due by the 15th.",
      "Local Service Tax is deducted once a year over the first few months.",
      "A freelancer who works only for us, on our terms and our hours, can be treated as an employee by URA.",
    ],
  },
  {
    title: "Records URA expects",
    body: "The filing is only as strong as the paperwork behind it.",
    points: [
      "An invoice or receipt in the company's name for every payment out.",
      "The transaction ID for every mobile money and bank movement — this system now makes it compulsory.",
      "Withholding tax certificates for anything withheld from us.",
      "Keep everything for six years.",
    ],
  },
];

export const FILING_DISCLAIMER =
  "Prepared from our own cashbook under the Income Tax Act (Cap 340), the VAT Act (Cap 349) and current URA practice. Have the accountant review it before it is filed — this system does not submit anything to URA.";

/** Every category with its treatment, for the reference table. */
export const CATEGORY_REFERENCE = Object.entries(CATEGORY_TAX).map(([cat, rule]) => ({
  category: cat,
  label: catLabel(cat),
  spend: rule.spend,
  income: rule.income,
  vat: rule.vat,
  wht: rule.wht,
  treatment: rule.treatment,
  vatKind: vatKind(cat),
}));

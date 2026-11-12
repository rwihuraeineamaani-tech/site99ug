import { spendKind } from "@/lib/finance";

/** One cashbook line, as the statements need it. */
export type StatementEntry = {
  id: string;
  direction: "in" | "out" | string;
  amount_ugx: number;
  category: string;
  reverses_id?: string | null;
  transfer_group_id?: string | null;
};

/** Money in that is not earned: borrowed, put in by owners, refunds, or our own money moving. */
const NOT_REVENUE_IN = new Set(["loan_in", "owner_capital", "refund", "transfer"]);
/** Money out that is not a cost of running the business. */
const FINANCING_OUT = new Set(["loan", "loan_repayment", "owner_drawings"]);

export type Statements = {
  revenue: number;
  runningCosts: number;
  taxPaid: number;
  profit: number;
  capitalSpend: number;
  refunds: number;
  loansIn: number;
  ownerCapital: number;
  loanRepayments: number;
  moneyLent: number;
  drawings: number;
  operating: number;
  investing: number;
  financing: number;
  netCash: number;
  costsByCategory: Record<string, number>;
  revenueByCategory: Record<string, number>;
};

/** Drops reversed lines and their reversals, and transfers between our own accounts. */
export function liveEntries<T extends StatementEntry>(rows: T[]): T[] {
  const reversed = new Set(rows.filter((r) => r.reverses_id).map((r) => r.reverses_id as string));
  return rows.filter((r) => !r.reverses_id && !reversed.has(r.id) && !r.transfer_group_id && r.category !== "transfer");
}

export function buildStatements(rows: StatementEntry[]): Statements {
  const s: Statements = {
    revenue: 0, runningCosts: 0, taxPaid: 0, profit: 0, capitalSpend: 0, refunds: 0, loansIn: 0,
    ownerCapital: 0, loanRepayments: 0, moneyLent: 0, drawings: 0, operating: 0, investing: 0,
    financing: 0, netCash: 0, costsByCategory: {}, revenueByCategory: {},
  };
  for (const r of liveEntries(rows)) {
    const a = Number(r.amount_ugx) || 0;
    if (r.direction === "in") {
      if (r.category === "loan_in") s.loansIn += a;
      else if (r.category === "owner_capital") s.ownerCapital += a;
      else if (r.category === "refund") s.refunds += a;
      else if (!NOT_REVENUE_IN.has(r.category)) {
        s.revenue += a;
        s.revenueByCategory[r.category] = (s.revenueByCategory[r.category] ?? 0) + a;
      }
    } else {
      if (r.category === "loan_repayment") s.loanRepayments += a;
      else if (r.category === "loan") s.moneyLent += a;
      else if (r.category === "owner_drawings") s.drawings += a;
      else if (r.category === "taxes_paid") s.taxPaid += a;
      else if (!FINANCING_OUT.has(r.category) && spendKind(r.category) === "capex") s.capitalSpend += a;
      else {
        s.runningCosts += a;
        s.costsByCategory[r.category] = (s.costsByCategory[r.category] ?? 0) + a;
      }
    }
  }
  s.profit = s.revenue - s.runningCosts;
  s.operating = s.revenue + s.refunds - s.runningCosts - s.taxPaid;
  s.investing = -s.capitalSpend;
  s.financing = s.loansIn + s.ownerCapital - s.loanRepayments - s.moneyLent - s.drawings;
  s.netCash = s.operating + s.investing + s.financing;
  return s;
}

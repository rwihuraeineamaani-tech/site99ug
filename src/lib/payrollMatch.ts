/** Pairs each old payroll run with the cashbook lines that paid it, and says what is missing. */
export type PayLine = { full_name: string; amount_ugx: number; charges_ugx: number; with_charges_ugx: number };
export type CashLine = { id: string; entry_date: string; direction: string; amount_ugx: number; counterparty_name: string; doc_number: string | null; category: string };
export type RunCheck = {
  amount: number;
  charges: number;
  withCharges: number;
  found: (CashLine & { swapped: boolean })[];
  foundTotal: number;
  /** Money the sheet says went out that no cashbook line covers (people only, not charges). */
  missing: number;
  chargesMissing: boolean;
};

const swap = (iso: string) => `${iso.slice(0, 4)}-${iso.slice(8, 10)}-${iso.slice(5, 7)}`;
const words = (s: string) => s.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2);

export function checkRun(lines: PayLine[], runDate: string | null, cash: CashLine[]): RunCheck {
  const amount = lines.reduce((s, l) => s + l.amount_ugx, 0);
  const charges = lines.reduce((s, l) => s + l.charges_ugx, 0);
  const withCharges = amount + charges;
  const outs = cash.filter((c) => c.direction === "out" && c.category !== "mobile_money_charges" && c.category !== "bank_charges");
  const dateOk = (c: CashLine) => !runDate || c.entry_date === runDate || swap(c.entry_date) === runDate;
  const names = new Set(lines.flatMap((l) => words(l.full_name)));
  const named = (c: CashLine) => words(c.counterparty_name).some((w) => names.has(w));
  const mentions = (c: CashLine) => named(c) || /team|payroll|salar/i.test(c.counterparty_name);

  // One line for the whole run, then lines naming people in the run.
  let found = outs.filter((c) => (c.amount_ugx === amount || c.amount_ugx === withCharges) && dateOk(c) && (c.category === "salaries" || mentions(c)));
  if (!found.length) found = outs.filter((c) => dateOk(c) && named(c) && c.amount_ugx <= withCharges);
  const foundTotal = found.reduce((s, c) => s + c.amount_ugx, 0);
  return {
    amount,
    charges,
    withCharges,
    found: found.map((c) => ({ ...c, swapped: !!runDate && c.entry_date !== runDate && swap(c.entry_date) === runDate })),
    foundTotal,
    missing: Math.max(0, amount - Math.min(foundTotal, amount)),
    chargesMissing: charges > 0 && foundTotal < withCharges,
  };
}

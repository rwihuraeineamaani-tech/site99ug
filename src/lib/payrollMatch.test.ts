import { describe, expect, it } from "vitest";
import { checkRun, type CashLine } from "./payrollMatch";

const team = Array.from({ length: 11 }, (_, i) => ({ full_name: `Person ${i}`, amount_ugx: i === 0 ? 60000 : 90000, charges_ugx: 1000, with_charges_ugx: 0 }));
const cash: CashLine[] = [
  { id: "a", entry_date: "2026-03-11", direction: "out", amount_ugx: 960000, counterparty_name: "Team", doc_number: "S9926EXPA124", category: "salaries" },
  { id: "b", entry_date: "2026-03-11", direction: "out", amount_ugx: 500000, counterparty_name: "Ryan and Anud", doc_number: "S9926EXPA125", category: "salaries" },
];

describe("checkRun", () => {
  it("finds the team payroll line with day and month swapped and flags missing charges", () => {
    const r = checkRun(team, "2026-11-03", cash);
    expect(r.amount).toBe(960000);
    expect(r.charges).toBe(11000);
    expect(r.found.map((f) => f.id)).toEqual(["a"]);
    expect(r.found[0].swapped).toBe(true);
    expect(r.missing).toBe(0);
    expect(r.chargesMissing).toBe(true);
  });
  it("shows half of Ryan and Anud's 1,000,000 is not in the cashbook", () => {
    const r = checkRun(
      [
        { full_name: "Ryan Christian Bwankika", amount_ugx: 500000, charges_ugx: 0, with_charges_ugx: 500000 },
        { full_name: "Anud Abdulkadir", amount_ugx: 500000, charges_ugx: 0, with_charges_ugx: 500000 },
      ],
      null,
      cash,
    );
    expect(r.found.map((f) => f.id)).toEqual(["b"]);
    expect(r.missing).toBe(500000);
  });
});

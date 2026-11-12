import { describe, expect, it } from "vitest";
import { buildStatements } from "./statements";

const e = (id: string, direction: string, amount_ugx: number, category: string, extra = {}) => ({ id, direction, amount_ugx, category, ...extra });

describe("financial statements", () => {
  it("never counts a loan received as revenue", () => {
    const s = buildStatements([e("1", "in", 40000, "loan_in"), e("2", "in", 300000, "client_payment")]);
    expect(s.revenue).toBe(300000);
    expect(s.loansIn).toBe(40000);
  });

  it("never counts owner capital as revenue", () => {
    const s = buildStatements([e("1", "in", 230000, "owner_capital")]);
    expect(s.revenue).toBe(0);
    expect(s.financing).toBe(230000);
  });

  it("leaves transfers between our own accounts out of income and spending", () => {
    const s = buildStatements([
      e("1", "out", 2000000, "transfer", { transfer_group_id: "g" }),
      e("2", "in", 2000000, "transfer", { transfer_group_id: "g" }),
    ]);
    expect(s.revenue).toBe(0);
    expect(s.runningCosts).toBe(0);
    expect(s.netCash).toBe(0);
  });

  it("counts transfer charges as a running cost", () => {
    const s = buildStatements([e("1", "out", 1000, "mobile_money_charges")]);
    expect(s.runningCosts).toBe(1000);
    expect(s.profit).toBe(-1000);
  });

  it("drops a reversed entry and its reversal", () => {
    const s = buildStatements([e("1", "out", 150000, "salaries"), e("2", "in", 150000, "salaries", { reverses_id: "1" })]);
    expect(s.runningCosts).toBe(0);
    expect(s.revenue).toBe(0);
  });

  it("keeps equipment purchases out of profit as capital spend", () => {
    const s = buildStatements([e("1", "in", 1000000, "client_payment"), e("2", "out", 775000, "equipment_purchase")]);
    expect(s.profit).toBe(1000000);
    expect(s.capitalSpend).toBe(775000);
    expect(s.netCash).toBe(225000);
  });
});

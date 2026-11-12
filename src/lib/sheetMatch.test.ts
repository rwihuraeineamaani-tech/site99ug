import { describe, expect, it } from "vitest";
import { matchSheetToApp } from "./sheetMatch";

const s = (id: string, entry_date: string, direction: "in" | "out", amount: number) => ({ id, entry_date, direction, amount, description: id, system_id: id });
const a = (id: string, entry_date: string, direction: string, amount_ugx: number) => ({ id, entry_date, direction, amount_ugx, counterparty_name: id, doc_number: id });

describe("old sheet vs app", () => {
  it("matches the same amount and direction a few days apart", () => {
    const r = matchSheetToApp([s("salama", "2026-11-01", "in", 1000000)], [a("x", "2026-11-02", "in", 1000000)]);
    expect(r.matched).toHaveLength(1);
    expect(r.matched[0].dateNote).toContain("Date differs");
  });

  it("spots a day and month swap", () => {
    const r = matchSheetToApp([s("team", "2026-11-03", "out", 960000)], [a("y", "2026-03-11", "out", 960000)]);
    expect(r.matched[0].dateNote).toContain("swapped");
  });

  it("lists sheet rows missing from the app and app rows missing from the sheet", () => {
    const r = matchSheetToApp([s("payroll", "2026-11-04", "out", 2000000)], [a("mogas", "2026-10-16", "in", 2000000)]);
    expect(r.sheetOnly.map((x) => x.id)).toEqual(["payroll"]);
    expect(r.appOnly.map((x) => x.id)).toEqual(["mogas"]);
  });
});

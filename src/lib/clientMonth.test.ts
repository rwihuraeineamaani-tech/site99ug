import { describe, expect, it } from "vitest";
import { change, prevMonth } from "./clientMonth";
describe("client month", () => {
  it("compares with last month as a percentage", () => { expect(change(150, 100)).toBe(50); expect(change(5, 0)).toBeNull(); });
  it("steps back across a year", () => { expect(prevMonth("2026-01-01")).toBe("2025-12-01"); });
});

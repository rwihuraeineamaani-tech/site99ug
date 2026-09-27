import { describe, expect, it } from "vitest";
import { accuracy, estimateImpact, estimateReturn, learnRates } from "./forecast";

describe("forecast", () => {
  it("estimates reach and cost with defaults", () => {
    const o = estimateImpact({ talent: [{ name: "A", followers: 100000, fee: 1000000 }], platforms: ["instagram"], posts: 1, extraBudget: 0 });
    expect(o.reach).toBe(30000);
    expect(o.engagements).toBe(1050);
    expect(o.cpm).toBe(33333);
    expect(o.source).toBe("standard defaults");
  });
  it("uses learned rates", () => {
    const o = estimateImpact({ talent: [{ name: "A", followers: 1000, fee: 0 }], platforms: [], posts: 1, extraBudget: 0, learned: { reachRate: 0.5, engagementRate: 0.1 } });
    expect(o.reach).toBe(500);
    expect(o.source).toBe("our history");
  });
  it("gives three return scenarios", () => {
    const s = estimateReturn({ budget: 1000, reach: 10000, clickRate: 0.01, conversionRate: 0.1, orderValue: 100 });
    expect(s[1]).toMatchObject({ clicks: 100, sales: 10, revenue: 1000, roi: 0 });
    expect(s[0].sales).toBeLessThan(s[2].sales);
  });
  it("learns rates only with enough data", () => {
    const r = { impressions: 0, clicks: 0, conversions: 0, revenue_ugx: 0 };
    expect(learnRates([{ ...r, reach: 10, engagements: 1, campaign_id: "a" }], { a: 100 })).toBeNull();
    const l = learnRates([{ ...r, reach: 50, engagements: 5, campaign_id: "a" }, { ...r, reach: 50, engagements: 5, campaign_id: "a" }], { a: 200 });
    expect(l).toEqual({ reachRate: 0.5, engagementRate: 0.1 });
    expect(accuracy(100, 120)).toBeCloseTo(0.2);
  });
});

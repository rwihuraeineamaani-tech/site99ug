import { describe, expect, it } from "vitest";
import { buildMetrics, readNumber, splitCombined, toByPlatform, unsplitLegacy } from "./contentMetrics";

describe("video numbers per platform", () => {
  it("reads short forms like 11.6K and 1,094", () => {
    expect(readNumber("11.6K")).toBe(11600);
    expect(readNumber("1,094")).toBe(1094);
    expect(readNumber("-")).toBeNull();
  });
  it("splits an old combined entry by platform", () => {
    expect(splitCombined("IG,65 TT, 859")).toEqual({ Instagram: "65", TikTok: "859" });
    expect(splitCombined("Ig,1442. Tt,1046")).toEqual({ Instagram: "1442", TikTok: "1046" });
  });
  it("keeps a single-platform video's old numbers under that platform", () => {
    expect(toByPlatform({ views: "1094" }, ["TikTok"]).TikTok.views).toBe("1094");
  });
  it("splits old combined boxes into each platform", () => {
    const by = toByPlatform({ likes: "IG:38, TT:126" }, ["Instagram", "TikTok"]);
    expect(by.Instagram.likes).toBe("38");
    expect(by.TikTok.likes).toBe("126");
  });
  it("flags multi-platform old numbers that cannot be split", () => {
    expect(unsplitLegacy({ views: "11.6K" }, ["TikTok", "Instagram"])).toEqual({ views: "11.6K" });
  });
  it("saves each platform separately and adds views across platforms", () => {
    const saved = buildMetrics({ TikTok: { views: "7.7K" }, Instagram: { views: "3272" } }, "ok");
    expect(saved.by_platform.TikTok.views).toBe("7.7K");
    expect(saved.views).toBe("10972");
  });
  it("never adds up average watch time", () => {
    const saved = buildMetrics({ TikTok: { avg_watch_time: "14s" }, Instagram: { avg_watch_time: "15s" } }, "");
    expect(saved).not.toHaveProperty("avg_watch_time");
  });
});

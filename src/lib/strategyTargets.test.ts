import { describe, expect, it } from "vitest";
import { METRICS, visibleToClient } from "./strategy";

describe("client visibility of goals and targets", () => {
  it("shows an approved target to the client", () => {
    expect(visibleToClient("approved")).toBe(true);
  });
  it("hides drafts, ones waiting on a founder and ones sent back", () => {
    expect(visibleToClient("draft")).toBe(false);
    expect(visibleToClient("submitted")).toBe(false);
    expect(visibleToClient("changes_requested")).toBe(false);
  });
});

describe("monthly target options", () => {
  it("offers videos and photo posts as separate targets", () => {
    const keys = METRICS.map((m) => m.key);
    expect(keys).toContain("posted_videos");
    expect(keys).toContain("posted_photos");
  });
});

import { goalAim, needsStart } from "./strategy";

describe("starting point", () => {
  it("is not asked for post counts, which always start from zero", () => {
    expect(needsStart("posted_videos")).toBe(false);
    expect(needsStart("posted_photos")).toBe(false);
    expect(needsStart("posted")).toBe(false);
  });
  it("is asked for followers", () => {
    expect(needsStart("followers")).toBe(true);
  });
  it("reads a video count goal as a plain aim", () => {
    expect(goalAim({ metric: "posted_videos", start_value: null, target_value: 12 })).toBe("Aim 12");
  });
});

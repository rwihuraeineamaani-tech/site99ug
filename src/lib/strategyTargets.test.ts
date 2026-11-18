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

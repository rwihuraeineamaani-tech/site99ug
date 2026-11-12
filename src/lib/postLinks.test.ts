import { describe, expect, it } from "vitest";
import { cutLabel, parsePostLink } from "./postLinks";
describe("post links", () => {
  it("reads the platform from a stored link", () => {
    expect(parsePostLink("Instagram: https://instagram.com/p/1")).toEqual({ platform: "Instagram", url: "https://instagram.com/p/1" });
  });
  it("guesses the platform from a bare url", () => {
    expect(parsePostLink("https://www.tiktok.com/@a/video/1").platform).toBe("TikTok");
  });
  it("names the platforms on the watch button", () => {
    expect(cutLabel(["Instagram", "TikTok"])).toBe("Watch the Instagram and TikTok cut (Google Drive)");
  });
});

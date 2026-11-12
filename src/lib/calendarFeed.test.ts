import { describe, expect, it } from "vitest";
import { postCalendarDay } from "./calendarFeed";

describe("postCalendarDay", () => {
  it("puts a posted video on the Kampala day it went live, not its planned day", () => {
    expect(postCalendarDay({ posted_at: "2026-11-04T09:00:00Z", planned_at: "2026-11-10", stage: "Posted" })).toBe("2026-11-04");
  });
  it("uses Kampala time, so a late-night UTC post lands on the next Kampala day", () => {
    expect(postCalendarDay({ posted_at: "2026-11-04T22:30:00Z", planned_at: null, stage: "Posted" })).toBe("2026-11-05");
  });
  it("keeps an unposted video on its planned day", () => {
    expect(postCalendarDay({ posted_at: null, planned_at: "2026-11-20", stage: "Handover" })).toBe("2026-11-20");
  });
});

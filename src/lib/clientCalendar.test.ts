import { describe, it, expect } from "vitest";
import { calStatus } from "./clientCalendar";

const today = "2026-11-20";
describe("client calendar colours", () => {
  it("posted with numbers in is green", () => {
    expect(calStatus({ stage: "Posted", posted_at: "2026-11-01T10:00:00Z", metrics_filled_at: "2026-11-05" }, false, today)).toBe("posted");
  });
  it("posted with numbers overdue after 10 days is red", () => {
    expect(calStatus({ stage: "Posted", posted_at: "2026-11-01T10:00:00Z", metrics_due_at: "2026-11-11" }, false, today)).toBe("numbers_due");
  });
  it("posted but numbers not yet due stays green", () => {
    expect(calStatus({ stage: "Posted", posted_at: "2026-11-15T10:00:00Z", metrics_due_at: "2026-11-25" }, false, today)).toBe("posted");
  });
  it("not yet edited is yellow", () => {
    expect(calStatus({ stage: "Editing" }, true, today)).toBe("not_edited");
  });
  it("review waits on the client only when the client approves content", () => {
    expect(calStatus({ stage: "Review" }, true, today)).toBe("awaiting_client");
    expect(calStatus({ stage: "Review" }, false, today)).toBe("other");
  });
  it("a cancelled post is crossed out, even if it was waiting on the client", () => {
    expect(calStatus({ stage: "Review", cancelled_at: "2026-11-10T10:00:00Z" }, true, today)).toBe("cancelled");
  });
  it("rejected shows as rejected", () => {
    expect(calStatus({ stage: "Rejected" }, true, today)).toBe("rejected");
  });
});

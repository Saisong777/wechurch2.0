import { describe, expect, it } from "vitest";

describe("summarizeCoverage", () => {
  it("counts assigned and confirmed servants while ignoring declined slots", async () => {
    process.env.DATABASE_URL ||= "postgresql://postgres:postgres@127.0.0.1:5432/wechurch_dev";
    const { summarizeCoverage } = await import("./servingScheduleRepository");
    expect(summarizeCoverage(3, [
      { status: "pending" },
      { status: "confirmed" },
      { status: "declined" },
    ])).toEqual({
      requiredCount: 3,
      assignedCount: 2,
      confirmedCount: 1,
      gapCount: 1,
    });
  });

  it("treats done as confirmed and never returns negative gaps", async () => {
    process.env.DATABASE_URL ||= "postgresql://postgres:postgres@127.0.0.1:5432/wechurch_dev";
    const { summarizeCoverage } = await import("./servingScheduleRepository");
    expect(summarizeCoverage(1, [
      { status: "done" },
      { status: "confirmed" },
    ])).toEqual({
      requiredCount: 1,
      assignedCount: 2,
      confirmedCount: 2,
      gapCount: 0,
    });
  });
});

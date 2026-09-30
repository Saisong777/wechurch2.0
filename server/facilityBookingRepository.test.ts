import { describe, expect, it } from "vitest";

describe("timeRangesOverlap", () => {
  it("detects overlapping room bookings", async () => {
    process.env.DATABASE_URL ||= "postgresql://postgres:postgres@127.0.0.1:5432/wechurch_dev";
    const { timeRangesOverlap } = await import("./facilityBookingRepository");
    expect(timeRangesOverlap(
      "2026-07-02T19:00:00",
      "2026-07-02T21:00:00",
      "2026-07-02T20:30:00",
      "2026-07-02T22:00:00",
    )).toBe(true);
  });

  it("allows adjacent bookings without a conflict", async () => {
    process.env.DATABASE_URL ||= "postgresql://postgres:postgres@127.0.0.1:5432/wechurch_dev";
    const { timeRangesOverlap } = await import("./facilityBookingRepository");
    expect(timeRangesOverlap(
      "2026-07-02T19:00:00",
      "2026-07-02T21:00:00",
      "2026-07-02T21:00:00",
      "2026-07-02T22:00:00",
    )).toBe(false);
  });
});

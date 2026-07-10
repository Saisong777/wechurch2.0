import { describe, expect, it } from "vitest";

describe("pastoral journey repository guards", () => {
  it("recognizes missing pastoral schema errors", async () => {
    process.env.DATABASE_URL ||= "postgresql://postgres:postgres@127.0.0.1:5432/wechurch_test";
    const { isPastoralSchemaMissingError } = await import("./pastoralJourneyRepository");

    expect(isPastoralSchemaMissingError({ code: "42P01" })).toBe(true);
    expect(isPastoralSchemaMissingError({ code: "42703" })).toBe(true);
    expect(isPastoralSchemaMissingError({ code: "23505" })).toBe(false);
    expect(isPastoralSchemaMissingError(new Error("network"))).toBe(false);
  });
});

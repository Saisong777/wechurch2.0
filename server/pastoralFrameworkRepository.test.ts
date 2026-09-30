import { describe, expect, it } from "vitest";

describe("mapPastoralStageSlug", () => {
  it("maps legacy pastoral stages to the current Friend/Family/Follow/Firemaker model", async () => {
    process.env.DATABASE_URL ||= "postgresql://postgres:postgres@127.0.0.1:5432/wechurch_dev";
    const { mapPastoralStageSlug } = await import("./pastoralFrameworkRepository");
    expect(mapPastoralStageSlug("newcomer")).toBe("friend");
    expect(mapPastoralStageSlug("frame")).toBe("friend");
    expect(mapPastoralStageSlug("member")).toBe("family");
    expect(mapPastoralStageSlug("care")).toBe("follow");
    expect(mapPastoralStageSlug("leader")).toBe("firemaker");
  });

  it("keeps current stage slugs stable", async () => {
    process.env.DATABASE_URL ||= "postgresql://postgres:postgres@127.0.0.1:5432/wechurch_dev";
    const { mapPastoralStageSlug } = await import("./pastoralFrameworkRepository");
    expect(mapPastoralStageSlug("friend")).toBe("friend");
    expect(mapPastoralStageSlug("family")).toBe("family");
    expect(mapPastoralStageSlug("follow")).toBe("follow");
    expect(mapPastoralStageSlug("firemaker")).toBe("firemaker");
  });
});

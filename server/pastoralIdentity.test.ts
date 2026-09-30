import { describe, expect, it } from "vitest";
import {
  buildPersonSeed,
  getIdentityMatchKey,
  normalizeIdentityEmail,
  scoreIdentityConfidence,
} from "./pastoralIdentity";

describe("pastoral identity helpers", () => {
  it("uses normalized email as the strongest person match key", () => {
    expect(normalizeIdentityEmail("  Sai@Example.COM ")).toBe("sai@example.com");
    expect(getIdentityMatchKey({
      sourceType: "participant",
      sourceId: "participant-1",
      email: "Sai@Example.COM",
    })).toBe("email:sai@example.com");
  });

  it("falls back to source id when email is missing", () => {
    expect(getIdentityMatchKey({
      sourceType: "care_contact",
      sourceId: "care-1",
      name: "新朋友",
    })).toBe("care_contact:care-1");
  });

  it("builds a conservative person seed from existing records", () => {
    const seed = buildPersonSeed({
      sourceType: "potential_member",
      sourceId: "pm-1",
      email: " friend@example.com ",
      name: "小明",
      church: "iM 行動教會",
    });

    expect(seed).toEqual({
      displayName: "小明",
      primaryEmail: "friend@example.com",
      church: "iM 行動教會",
      pastoralStage: "friend",
      pastoralStatus: "active",
    });
    expect(scoreIdentityConfidence({ sourceType: "potential_member", sourceId: "pm-1", email: "friend@example.com" })).toBe(100);
  });

  it("maps source type and status into a pastoral stage", () => {
    expect(buildPersonSeed({
      sourceType: "user",
      sourceId: "user-1",
      email: "member@example.com",
    }).pastoralStage).toBe("family");

    expect(buildPersonSeed({
      sourceType: "participant",
      sourceId: "participant-1",
      email: "new@example.com",
    }).pastoralStage).toBe("friend");

    expect(buildPersonSeed({
      sourceType: "potential_member",
      sourceId: "pm-1",
      status: "declined",
      name: "暫停互動",
    })).toMatchObject({
      pastoralStage: "inactive",
      pastoralStatus: "inactive",
    });
  });
});

import { describe, expect, it } from "vitest";
import {
  parseAuthenticatedPrayerBody,
  parseDevotionalNotePatch,
  prayerCommentBodySchema,
  prayerPatchSchema,
} from "./securityPolicies";

describe("security policy parsers", () => {
  it("uses the authenticated session user for prayer creation", () => {
    const parsed = parseAuthenticatedPrayerBody({
      userId: "00000000-0000-0000-0000-000000000999",
      content: "請為新朋友禱告",
      category: "supplication",
    }, "00000000-0000-0000-0000-000000000001");

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.userId).toBe("00000000-0000-0000-0000-000000000001");
  });

  it("rejects empty prayer content", () => {
    const parsed = parseAuthenticatedPrayerBody({
      content: "   ",
      category: "supplication",
    }, "00000000-0000-0000-0000-000000000001");

    expect(parsed.success).toBe(false);
  });

  it("only accepts explicit prayer status fields for updates", () => {
    const parsed = prayerPatchSchema.safeParse({
      userId: "00000000-0000-0000-0000-000000000999",
      isAnswered: true,
      isPinned: false,
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).toEqual({ isAnswered: true, isPinned: false });
  });

  it("uses the authenticated user for prayer comments", () => {
    const parsed = prayerCommentBodySchema.safeParse({
      userId: "00000000-0000-0000-0000-000000000999",
      content: "阿們",
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).toEqual({ content: "阿們" });
  });

  it("strips userId from devotional note patches", () => {
    const parsed = parseDevotionalNotePatch({
      userId: "00000000-0000-0000-0000-000000000999",
      notes: "更新後的筆記",
      hidden: true,
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).toEqual({ notes: "更新後的筆記", hidden: true });
  });
});

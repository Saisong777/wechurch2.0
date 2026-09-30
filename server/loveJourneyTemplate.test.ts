import { describe, expect, it } from "vitest";
import {
  LOVE_JOURNEY_TEMPLATE_SLUG,
  buildLoveJourneyTemplateSeed,
} from "./loveJourneyTemplate";

describe("love journey template seed", () => {
  it("defines a 28-day new believer journey", () => {
    const seed = buildLoveJourneyTemplateSeed();

    expect(seed.template.slug).toBe(LOVE_JOURNEY_TEMPLATE_SLUG);
    expect(seed.template.durationDays).toBe(28);
    expect(seed.days).toHaveLength(28);
    expect(seed.days[0].title).toBe("愛的天父");
    expect(seed.days[0].scriptureReference).toContain("約翰一書 4:8");
    expect(seed.days[0].bodyMarkdown).toContain("## 今日信息");
    expect(seed.days[0].bodyMarkdown).not.toContain("## 校稿備註");
    expect(seed.days[27].title).toContain("差派");
  });

  it("marks pastoral milestones for mentor follow-up", () => {
    const seed = buildLoveJourneyTemplateSeed();
    const milestoneKeys = seed.milestones.map((milestone) => milestone.milestoneKey);

    expect(milestoneKeys).toContain("baptism_invitation");
    expect(milestoneKeys).toContain("communion_teaching");
    expect(milestoneKeys).toContain("testimony_draft");
    expect(milestoneKeys).toContain("commissioning");
  });
});

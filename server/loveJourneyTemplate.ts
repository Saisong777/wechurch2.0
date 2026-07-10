import { LOVE_JOURNEY_DAYS } from "./generated/loveJourneyTemplate.generated";

export const LOVE_JOURNEY_TEMPLATE_SLUG = "love-journey-28";

export const LOVE_JOURNEY_TEMPLATE = {
  slug: LOVE_JOURNEY_TEMPLATE_SLUG,
  name: "愛的旅程 28 天",
  description: "慕道、初信與一對一陪伴使用的 28 天信仰旅程。",
  category: "new-believer-journey",
  durationDays: 28,
  isActive: true,
};

export const LOVE_JOURNEY_MILESTONES = {
  baptism_invitation: "受洗與委身邀請",
  week_1_discussion: "第一週討論",
  week_2_discussion: "第二週討論",
  communion_teaching: "主餐與教會生活",
  week_3_discussion: "第三週討論",
  testimony_draft: "見證草稿",
  commissioning: "立志與差派",
} as const;

export function buildLoveJourneyTemplateSeed() {
  return {
    template: LOVE_JOURNEY_TEMPLATE,
    days: LOVE_JOURNEY_DAYS,
    milestones: LOVE_JOURNEY_DAYS
      .filter((day) => day.milestoneKey)
      .map((day) => ({
        milestoneKey: day.milestoneKey!,
        title: LOVE_JOURNEY_MILESTONES[day.milestoneKey! as keyof typeof LOVE_JOURNEY_MILESTONES],
        dayNumber: day.dayNumber,
      })),
  };
}

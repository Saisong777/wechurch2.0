import { expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

it('ships no model SDK, generation prompt or active AI entry point', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  expect(pkg.dependencies.openai).toBeUndefined();
  expect(pkg.dependencies['@google/generative-ai']).toBeUndefined();
  expect(existsSync('server/prompts/devotional-analysis.ts')).toBe(false);
  const routes = readFileSync('server/routes.ts', 'utf8');
  expect(routes).not.toMatch(/getGeminiClient|getOpenAIClient|generateContent|generateContentStream|runWithAiRetry/);
  expect(readFileSync('src/pages/ReadingPlansPage.tsx', 'utf8')).not.toMatch(/DevotionalAnalysis|AI 整合分析/);
  expect(readFileSync('server/observability.ts', 'utf8')).not.toMatch(/ai_usage_events|scoreAiReportQuality|getProductGrowthBrief/);
});

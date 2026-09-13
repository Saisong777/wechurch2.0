import { describe, expect, it } from 'vitest';
import { composeDevotionShare, createDevotionShareDraft } from './devotionShareDraft';

const note = { id: 'note', titlePhrase: '標題', verseReference: '以賽亞書 43', verseText: '經文原文',
  heartbeatVerse: '心動經文原文', observation: '看見原文', coreInsightCategory: '["GOD_ATTRIBUTE","PROMISE"]',
  coreInsightNote: '{"GOD_ATTRIBUTE":"認識神原文","PROMISE":"應許原文"}',
  scholarsNote: '研讀原文', actionPlan: '回應原文', coolDownNote: '反思原文' };

describe('devotion share sections', () => {
  it('includes every saved note part and every insight without silently selecting private fields', () => {
    const draft = createDevotionShareDraft(note);
    expect(draft.sections).toHaveLength(8);
    expect(draft.sections!.map(section => section.text)).toEqual(['經文原文', '心動經文原文', '看見原文', '認識神原文', '應許原文', '研讀原文', '回應原文', '反思原文']);
    expect(draft.body).toBe('認識神原文\n應許原文');
    const texts = Object.fromEntries(draft.sections!.map(section => [section.key, section.text]));
    const selected = composeDevotionShare(draft.sections!, ['observation', 'actionPlan'], texts);
    expect(selected).toBe('看見\n看見原文\n\n回應\n回應原文');
    expect(selected).not.toContain('反思原文');
    const full = composeDevotionShare(draft.sections!, draft.sections!.map(section => section.key), texts);
    for (const section of draft.sections!) expect(full).toContain(section.text);
  });
  it('preserves old plain-text insights and omits empty fields or null JSON', () => {
    expect(createDevotionShareDraft({ ...note, coreInsightCategory: null, coreInsightNote: '舊領受全文' }).sections)
      .toContainEqual({ key: 'insight:legacy', label: '領受', text: '舊領受全文' });
    const draft = createDevotionShareDraft({ ...note, coreInsightNote: 'null', actionPlan: ' ', observation: null });
    expect(draft.sections!.some(section => section.key.startsWith('insight:'))).toBe(false);
    expect(draft.sections!.some(section => ['observation', 'actionPlan'].includes(section.key))).toBe(false);
    expect(composeDevotionShare(draft.sections!, [], {})).toBe('');
  });
});

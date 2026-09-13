import type { DevotionShareDraft, DevotionShareSection } from '@shared/devotionWall';
import type { LocalDevotionalNote } from './localDevotionalNotes';
import { INSIGHT_CATEGORIES, parseCategories, parseNotes } from '@/types/spiritual-fitness';

export function createDevotionShareDraft(note: Pick<LocalDevotionalNote,
  'id' | 'titlePhrase' | 'verseReference' | 'verseText' | 'heartbeatVerse' | 'observation' |
  'coreInsightCategory' | 'coreInsightNote' | 'scholarsNote' | 'actionPlan' | 'coolDownNote'>): DevotionShareDraft {
  const sections: DevotionShareSection[] = [];
  const add = (key: string, label: string, text: string | null | undefined) => {
    if (typeof text === 'string' && text.trim()) sections.push({ key, label, text });
  };
  add('verseText', '經文', note.verseText);
  add('heartbeatVerse', '心動經文', note.heartbeatVerse);
  add('observation', '看見', note.observation);
  const insights = Object.entries(parseNotes(note.coreInsightNote, parseCategories(note.coreInsightCategory)) || {})
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && Boolean(entry[1].trim()));
  if (insights.length) {
    for (const [key, text] of insights) {
      const category = INSIGHT_CATEGORIES.find(item => item.value === key);
      add(`insight:${key}`, insights.length === 1 ? '領受' : `領受・${category?.label || '其他'}`, text);
    }
  }
  add('scholarsNote', '研讀筆記', note.scholarsNote);
  add('actionPlan', '回應', note.actionPlan);
  add('coolDownNote', '安靜反思', note.coolDownNote);
  return { sourceId: note.id, title: note.titlePhrase || '今日靈修心得', reference: note.verseReference,
    body: sections.filter(section => section.key.startsWith('insight:')).map(section => section.text).join('\n'), sections };
}

export function composeDevotionShare(sections: DevotionShareSection[], selected: string[], texts: Record<string, string>) {
  return sections.filter(section => selected.includes(section.key) && texts[section.key]?.trim())
    .map(section => `${section.label}\n${texts[section.key].trim()}`).join('\n\n');
}

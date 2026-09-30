import type { DailyDevotionBrief } from './dailyDevotion';

type Verse = { verse: number; text: string };
type ReadChapter = (bookName: string, chapter: number) => Promise<Verse[]>;

// Adapt the schedule's single-chapter notation to the existing Bible chapter store.
export function parseDevotionPassage(reference: string) {
  const normalized = reference.normalize('NFKC').trim().replace(/[–—~～至]/g, '-');
  const match = normalized.match(/^([^\d:]+?)\s*(\d{1,3})(?:\s*:\s*(\d{1,3}|全|全章)(?:\s*-\s*(\d{1,3}|全|全章))?)?$/);
  if (!match) return null;
  if (/全/.test(match[3] || '') && match[4]) return null;
  const chapter = Number(match[2]);
  const start = !match[3] || /全/.test(match[3]) ? 1 : Number(match[3]);
  const end = !match[3] || /全/.test(match[3]) || /全/.test(match[4] || '') ? null : Number(match[4] || match[3]);
  if (chapter < 1 || chapter > 150 || start < 1 || start > 176 || (end !== null && (end < start || end > 176))) return null;
  return { bookName: match[1].trim(), chapter, start, end };
}

export async function withDevotionScripture(brief: DailyDevotionBrief, readChapter: ReadChapter): Promise<DailyDevotionBrief> {
  if (brief.sourceStatus === 'unpublished') return brief;
  if (brief.scriptureText?.trim() || brief.previewVerses.length) return brief;
  const passage = parseDevotionPassage(brief.scriptureReference);
  if (!passage) return { ...brief, scriptureStatus: 'unavailable' };
  try {
    const chapter = await readChapter(passage.bookName, passage.chapter);
    const end = passage.end ?? Math.max(0, ...chapter.map(row => row.verse));
    const selected = chapter.filter(row => row.verse >= passage.start && row.verse <= end).sort((a, b) => a.verse - b.verse);
    // Never present an incomplete range as the complete passage.
    if (!selected.length || selected.length !== end - passage.start + 1 || selected.some((row, index) => row.verse !== passage.start + index || !row.text.trim())) return { ...brief, scriptureStatus: 'unavailable' };
    return { ...brief, previewVerses: selected.map(({ verse, text }) => ({ verse, text })), scriptureStatus: 'ready' };
  } catch (error) {
    console.error('[church-reading] Bible passage unavailable', error instanceof Error ? error.message : 'Unknown error');
    return { ...brief, scriptureStatus: 'unavailable' };
  }
}

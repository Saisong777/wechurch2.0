import { describe, expect, it, vi } from 'vitest';
import { parseDevotionPassage, withDevotionScripture } from './devotionScripture';
import type { DailyDevotionBrief } from './dailyDevotion';

const brief: DailyDevotionBrief = { id: 'day', date: '2026-09-12', planName: '課表', dayNumber: 43, scriptureReference: '以賽亞書 43:1-全', devotionalTitle: '原標題', devotionalText: '原短文', previewVerses: [], sourceStatus: 'church-schedule' };
const rows = Array.from({ length: 28 }, (_, i) => ({ verse: i + 1, text: `來源經文 ${i + 1}` }));

describe('schedule scripture lookup', () => {
  it('recognizes a whole chapter, verse range, single verse, and full-width notation', () => {
    expect(parseDevotionPassage('以賽亞書 43:1-全')).toEqual({ bookName: '以賽亞書', chapter: 43, start: 1, end: null });
    expect(parseDevotionPassage('以賽亞書４３：１－全章')).toEqual(parseDevotionPassage(brief.scriptureReference));
    expect(parseDevotionPassage('詩篇 23')).toEqual({ bookName: '詩篇', chapter: 23, start: 1, end: null });
    expect(parseDevotionPassage('約翰福音 3:16-18')).toEqual({ bookName: '約翰福音', chapter: 3, start: 16, end: 18 });
    expect(parseDevotionPassage('約翰福音 3:16')?.end).toBe(16);
    for (const input of ['以賽亞書 0:1', '詩篇 151:1', '以賽亞書 43:9-1', '以賽亞書 43:0-全', '以賽亞書 43:全-5', '以賽亞書 43:1-44:2', '以賽亞書 43:1;約翰福音 3:16']) expect(parseDevotionPassage(input)).toBeNull();
  });
  it('retrieves all 28 verses from the existing Bible store without modifying the devotion', async () => {
    const read = vi.fn().mockResolvedValue(rows);
    const result = await withDevotionScripture(brief, read);
    expect(read).toHaveBeenCalledExactlyOnceWith('以賽亞書', 43);
    expect(result.previewVerses).toEqual(rows);
    expect(result.devotionalText).toBe(brief.devotionalText);
    expect(brief.previewVerses).toEqual([]);
    expect(result.scriptureStatus).toBe('ready');
  });
  it('respects range bounds and does not duplicate existing supplied scripture', async () => {
    const read = vi.fn().mockResolvedValue(rows);
    expect((await withDevotionScripture({ ...brief, scriptureReference: '以賽亞書 43:16-18' }, read)).previewVerses).toEqual(rows.slice(15, 18));
    read.mockClear();
    const supplied = { ...brief, scriptureText: '已提供的經文原文' };
    expect(await withDevotionScripture(supplied, read)).toBe(supplied);
    expect(await withDevotionScripture({ ...brief, sourceStatus: 'unpublished' }, read)).not.toHaveProperty('scriptureStatus');
    expect(read).not.toHaveBeenCalled();
  });
  it('does not invent verses when data is missing, incomplete, or unavailable', async () => {
    for (const data of [[], rows.filter(r => r.verse !== 5), rows.map(r => r.verse === 5 ? { ...r, text: '' } : r)]) {
      const result = await withDevotionScripture(brief, vi.fn().mockResolvedValue(data));
      expect(result.scriptureStatus).toBe('unavailable');
      expect(result.previewVerses).toEqual([]);
      expect(result.devotionalText).toBe(brief.devotionalText);
    }
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try { expect((await withDevotionScripture(brief, vi.fn().mockRejectedValue(new Error('offline')))).scriptureStatus).toBe('unavailable'); }
    finally { log.mockRestore(); }
  });
});

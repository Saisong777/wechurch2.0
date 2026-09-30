import { describe, expect, it } from 'vitest';
import { serializeCsv } from './csv-export';
import { exportStudyResponsesAsCSV, exportSubmissionsAsCSV } from './api-helpers';
import type { StudySubmission } from '@/types/bible-study';

describe('spreadsheet-safe CSV', () => {
  it.each(['=1+1', '+SUM(A1)', '-1+1', '@SUM(A1)', ' \t=1', '\u0000=1', '\r=1', '\n=1', '\ttext', '\ufeff=1'])('neutralizes %j', value => {
    expect(serializeCsv([[value]])).toBe(`"'${value}"`);
  });
  it('quotes delimiters, embedded quotes and line breaks without losing text', () => {
    expect(serializeCsv([['name', 'note'], ['A,"B"', 'first\r\nsecond'], [null, 'A&B < C']]))
      .toBe('"name","note"\r\n"A,""B""","first\r\nsecond"\r\n"","A&B < C"');
  });
  it('protects every submission text column and the legacy response exporter', () => {
    const submission = {
      groupNumber: 1, name: '=1', email: '+2', bibleVerse: '-3', theme: '@4', movingVerse: '=5',
      factsDiscovered: '=6', traditionalExegesis: '=7', inspirationFromGod: '=8', applicationInLife: '=9',
      others: '=10', submittedAt: new Date('2026-01-01T00:00:00Z'),
    } as StudySubmission;
    const data = exportSubmissionsAsCSV([submission]).split('\r\n')[1];
    for (const value of Object.values(submission).filter(v => typeof v === 'string')) expect(data).toContain(`"'${value}"`);
    expect(exportStudyResponsesAsCSV([{ userId: '=1', response: '"quoted",\n=2', createdAt: '@3' }]))
      .toBe('"User ID","Response","Created At"\r\n"\'=1","""quoted"",\n=2","\'@3"');
  });
});

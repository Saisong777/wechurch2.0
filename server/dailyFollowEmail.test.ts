import { beforeEach, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import { careContacts, prayers, type User } from '@shared/schema';

const mocks = vi.hoisted(() => ({ select: vi.fn(), sendEmail: vi.fn(), getPrayers: vi.fn() }));
vi.mock('./db', () => ({ db: { select: mocks.select } }));
vi.mock('./resend', () => ({ sendEmail: mocks.sendEmail }));
vi.mock('./storage', () => ({ storage: { getPrayers: mocks.getPrayers, getBibleVerses: vi.fn(), getDevotionalNoteByVerseReference: vi.fn().mockResolvedValue(undefined) } }));
vi.mock('./churchDevotionRepository', () => ({ getManagedChurchDevotion: vi.fn().mockResolvedValue({ entry: null }) }));
vi.mock('./churchDevotionPublic', () => ({ managedDevotionBrief: vi.fn(() => ({})) }));
vi.mock('./devotionScripture', () => ({ withDevotionScripture: vi.fn().mockResolvedValue({ scriptureReference: 'John 1:1', dayNumber: 1, previewVerses: [], devotionalTitle: 'Reading', devotionalText: 'Text' }) }));
import { buildDailyFollowEmail } from './dailyFollowEmail';

const dialect = new PgDialect();
beforeEach(() => vi.clearAllMocks());

it('selects only open unanswered prayers, pinned first and newest first, with a database limit of three', async () => {
  const rows = [
    { content: 'CLOSED_PRIVATE', closedAt: new Date(), isAnswered: false, isPinned: true, createdAt: new Date('2026-01-06') },
    { content: 'ANSWERED_PRIVATE', closedAt: null, isAnswered: true, isPinned: true, createdAt: new Date('2026-01-05') },
    { content: 'OPEN_PINNED', closedAt: null, isAnswered: false, isPinned: true, createdAt: new Date('2026-01-01') },
    ...[4, 3, 2, 1].map(day => ({ content: `OPEN_${day}`, closedAt: null, isAnswered: false, isPinned: false, createdAt: new Date(`2026-01-0${day}`) })),
  ];
  mocks.select.mockImplementation(() => ({ from: (table: unknown) => ({ where: (condition: Parameters<PgDialect['sqlToQuery']>[0]) => ({ orderBy: (...order: Parameters<PgDialect['sqlToQuery']>[0][]) => ({ limit: async (limit: number) => {
    if (table === careContacts) return [];
    expect(table).toBe(prayers);
    const query = dialect.sqlToQuery(condition);
    expect(query.sql).toBe('("prayers"."closed_at" is null and "prayers"."is_answered" = $1)');
    expect(query.params).toEqual([false]);
    expect(order.map(value => dialect.sqlToQuery(value).sql)).toEqual(['"prayers"."is_pinned" desc', '"prayers"."created_at" desc']);
    expect(limit).toBe(3);
    return rows.filter(row => row.closedAt === null && !row.isAnswered)
      .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
  } }) }) }) }));
  const email = await buildDailyFollowEmail({ id: 'test-user', displayName: 'Reader', email: 'reader@example.test' } as User, new Date('2026-01-01'));
  for (const output of [email.html, email.text]) {
    expect(output).not.toMatch(/CLOSED_PRIVATE|ANSWERED_PRIVATE|OPEN_2|OPEN_1/);
    expect(output.indexOf('OPEN_PINNED')).toBeLessThan(output.indexOf('OPEN_4'));
    expect(output.indexOf('OPEN_4')).toBeLessThan(output.indexOf('OPEN_3'));
  }
  expect(email.context.prayerCount).toBe(3);
  expect(mocks.getPrayers).not.toHaveBeenCalled();
  expect(mocks.sendEmail).not.toHaveBeenCalled();
});

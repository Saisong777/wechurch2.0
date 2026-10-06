import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import { careContacts, prayers, type User } from '@shared/schema';

const mocks = vi.hoisted(() => ({ select: vi.fn(), insert: vi.fn(), sendEmail: vi.fn(), getPrayers: vi.fn() }));
vi.mock('./db', () => ({ db: { select: mocks.select, insert: mocks.insert } }));
vi.mock('./resend', () => ({ sendEmail: mocks.sendEmail }));
vi.mock('./storage', () => ({ storage: { getPrayers: mocks.getPrayers, getBibleVerses: vi.fn(), getDevotionalNoteByVerseReference: vi.fn().mockResolvedValue(undefined) } }));
vi.mock('./churchDevotionRepository', () => ({ getManagedChurchDevotion: vi.fn().mockResolvedValue({ entry: null }) }));
vi.mock('./churchDevotionPublic', () => ({ managedDevotionBrief: vi.fn(() => ({})) }));
vi.mock('./devotionScripture', () => ({ withDevotionScripture: vi.fn().mockResolvedValue({ scriptureReference: 'John 1:1', dayNumber: 1, previewVerses: [], devotionalTitle: 'Reading', devotionalText: 'Text' }) }));
import { buildDailyFollowEmail, sendDailyFollowEmail } from './dailyFollowEmail';

const dialect = new PgDialect();
beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllEnvs());

function emptyReading() {
  mocks.select.mockImplementation(() => ({ from: () => ({ where: () => ({ orderBy: () => ({ limit: async () => [] }) }) }) }));
}
const reader = { id: 'test-user',church:'IM 行動教會', displayName: '<Reader>', email: 'reader@example.test' } as User;

it('keeps all preview links on B including subscription management', async () => {
  emptyReading();
  vi.stubEnv('APP_ENV', 'staging');
  vi.stubEnv('PUBLIC_BASE_URL', 'https://b.example.test');
  const email = await buildDailyFollowEmail(reader);
  expect(email.html).toContain('https://b.example.test/me');
  expect(email.text).toContain('https://b.example.test/me');
  expect(email.html).not.toContain('https://wechurch.online');
  expect(email.html).not.toContain('<Reader>');
});

it('manual test does not consume a scheduled daily email or create an opt-in', async () => {
  emptyReading();
  mocks.sendEmail.mockResolvedValue({ data: { id: 'accepted' } });
  await sendDailyFollowEmail(reader);
  expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
  expect(mocks.sendEmail.mock.calls[0][0].idempotencyKey).toBeUndefined();
  expect(mocks.insert).not.toHaveBeenCalled();
});

it('updates scheduled date only after provider acceptance, without changing opt-in', async () => {
  emptyReading();
  const update = vi.fn().mockResolvedValue(undefined);
  mocks.insert.mockReturnValue({ values: () => ({ onConflictDoUpdate: update }) });
  mocks.sendEmail.mockResolvedValue({ data: { id: 'accepted' } });
  const date = new Date('2026-09-28T23:00:00Z');
  await sendDailyFollowEmail(reader, date, 'Asia/Taipei');
  expect(mocks.sendEmail.mock.calls[0][0].idempotencyKey).toBe('daily/test-user/2026-09-29');
  expect(update.mock.calls[0][0].set).toEqual({ lastDailyFollowSentAt: date, updatedAt: date });
  mocks.insert.mockClear();
  mocks.sendEmail.mockRejectedValueOnce(new Error('EMAIL_SEND_UNCONFIRMED'));
  await expect(sendDailyFollowEmail(reader, date, 'Asia/Taipei')).rejects.toThrow('EMAIL_SEND_UNCONFIRMED');
  expect(mocks.insert).not.toHaveBeenCalled();
});

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
    expect(query.sql).toBe('("prayers"."church" = $1 and "prayers"."closed_at" is null and "prayers"."is_answered" = $2)');
    expect(query.params).toEqual(['IM 行動教會',false]);
    expect(order.map(value => dialect.sqlToQuery(value).sql)).toEqual(['"prayers"."is_pinned" desc', '"prayers"."created_at" desc']);
    expect(limit).toBe(3);
    return rows.filter(row => row.closedAt === null && !row.isAnswered)
      .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
  } }) }) }) }));
  const email = await buildDailyFollowEmail({ id: 'test-user',church:'IM 行動教會', displayName: 'Reader', email: 'reader@example.test' } as User, new Date('2026-01-01'));
  for (const output of [email.html, email.text]) {
    expect(output).not.toMatch(/CLOSED_PRIVATE|ANSWERED_PRIVATE|OPEN_2|OPEN_1/);
    expect(output.indexOf('OPEN_PINNED')).toBeLessThan(output.indexOf('OPEN_4'));
    expect(output.indexOf('OPEN_4')).toBeLessThan(output.indexOf('OPEN_3'));
  }
  expect(email.context.prayerCount).toBe(3);
  expect(mocks.getPrayers).not.toHaveBeenCalled();
  expect(mocks.sendEmail).not.toHaveBeenCalled();
});

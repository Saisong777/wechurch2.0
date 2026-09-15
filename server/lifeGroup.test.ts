import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { careInput, careUpdateInput, commentInput, groupCreateInput, shareInput } from '../shared/lifeGroup';

describe('small group sharing contracts', () => {
  const post = { kind: 'note', title: '領受', body: '願意公開的節錄', consent: true };
  it('requires explicit sharing consent', () => {
    expect(shareInput.safeParse({ ...post, consent: false }).success).toBe(false);
    expect(shareInput.safeParse({ ...post, consent: undefined }).success).toBe(false);
    expect(shareInput.parse(post).sourceId).toBe(null);
  });
  it('rejects arbitrary source identifiers and empty content', () => {
    expect(shareInput.safeParse({ ...post, sourceId: 'private-file' }).success).toBe(false);
    expect(shareInput.safeParse({ ...post, body: '  ' }).success).toBe(false);
    expect(shareInput.safeParse({ ...post, body: 'a'.repeat(12001) }).success).toBe(false);
    expect(shareInput.parse({ ...post, sourceId: randomUUID() }).body).toBe(post.body);
  });
  it('keeps prayer shares separate from private response fields', () => {
    const data = shareInput.parse({ ...post, kind: 'prayer', privateResponse: 'PRIVATE', authorId: randomUUID(), groupId: randomUUID() });
    expect(data).not.toHaveProperty('privateResponse');
    expect(data).not.toHaveProperty('authorId');
    expect(data).not.toHaveProperty('groupId');
  });
  it('requires consent for shared care and validates dates and assignees', () => {
    const care = { name: '匿名朋友', need: '接送協助', consent: true };
    expect(careInput.safeParse({ ...care, consent: false }).success).toBe(false);
    expect(careInput.safeParse({ ...care, dueDate: '2026-02-29' }).success).toBe(false);
    expect(careInput.safeParse({ ...care, responsibleId: 'stranger' }).success).toBe(false);
    expect(careInput.parse(care).dueDate).toBe(null);
  });
  it('requires a version and a written care update', () => {
    const progress = { body: '已聯絡', status: 'following', nextAction: '', responsibleId: null, dueDate: null, version: 1 };
    expect(careUpdateInput.safeParse(progress).success).toBe(true);
    expect(careUpdateInput.safeParse({ ...progress, version: 0 }).success).toBe(false);
    expect(careUpdateInput.safeParse({ ...progress, body: '' }).success).toBe(false);
    expect(careUpdateInput.safeParse({ ...progress, status: 'healed' }).success).toBe(false);
  });
  it('bounds group names and comments', () => {
    expect(groupCreateInput.safeParse({ name: ' ' }).success).toBe(false);
    expect(commentInput.safeParse({ body: 'a'.repeat(4001) }).success).toBe(false);
    expect(commentInput.parse({ body: ' 平安 ' }).body).toBe('平安');
  });
});

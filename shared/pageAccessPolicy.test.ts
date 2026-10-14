import { describe, expect, it } from 'vitest';
import { canonicalPagePath, loginForPage, pageRequiresAuthentication, safePageReturn } from './pageAccessPolicy';

describe('shared page authentication policy', () => {
  it.each(['/me','/ME','/%6de','/me/','/me//','/me/activity','/%6de/sharing','/admin/crm/person/id','/WORK/settings','/notebook','/user/notebook','/learn/%6dy-notes','/learn/reading-plans/123/read','/support','/care','/grace-record','/share'])('protects personal/staff destinations %s', path => expect(pageRequiresAuthentication(path)).toBe(true));
  it.each(['/','/user','/user/study','/help','/sitemap','/login','/reset-password','/feedback','/groups','/groups/a','/bible','/learn/bible','/learn/church-reading','/play','/icebreaker','/grouper','/cards','/prayer-wall','/walls','/devotion-wall','/prayer-meeting','/meant-for-public'])('preserves public tools and invitation destinations %s', path => expect(pageRequiresAuthentication(path)).toBe(false));
  it.each(['//other.test','/me%2factivity','/me%5cactivity','/%256de','/%','/me%00','/me%20','/me\\activity'])('rejects ambiguous page paths %s', path => { expect(canonicalPagePath(path)).toBeNull(); expect(pageRequiresAuthentication(path)).toBe(true); });
  it.each(['https://other.test','//other.test','/LOGIN','/%6cogin','/foo/../api/logout','/API/logout','/reset-password/','/me%2factivity'])('rejects external, logout and looping returns %s', path => expect(safePageReturn(path)).toBe('/'));
  it('preserves internal query and invitation fragment without making an open redirect', () => {
    const value='/groups?from=sitemap#invite=sample';
    expect(safePageReturn(value)).toBe(value);
    expect(new URL(loginForPage(value),'https://example.test').searchParams.get('returnTo')).toBe(value);
  });
});

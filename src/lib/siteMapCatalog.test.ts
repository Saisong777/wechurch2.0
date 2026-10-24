import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import type { MyAccess } from '@shared/accessControl';
import { canDiscoverSiteMapEntry, matchingSiteMapSections, siteMapSections, type SiteMapViewer } from './siteMapCatalog';

const member: SiteMapViewer = { signedIn: true, isAdmin: false, isLeader: false, pastoralAvailable: false };
const access: MyAccess = { permissions: [], grants: [], canManageAccess: false, canEnterCrm: false, canEnterAdmin: false };
const visibleHrefs = (viewer: SiteMapViewer) => matchingSiteMapSections(viewer, '').flatMap(section => section.entries.map(entry => entry.href));

it('uses only real local canonical routes and excludes retired, token and record-specific destinations', () => {
  const app = readFileSync(new URL('../AppRoutes.tsx', import.meta.url), 'utf8');
  const entries = siteMapSections.flatMap(section => section.entries);
  expect(new Set(entries.map(entry => entry.href)).size).toBe(entries.length);
  for (const entry of entries) {
    expect(entry.href).toMatch(/^\/(?!\/)/);
    expect(entry.href).not.toContain('\\');
    expect(app).toContain(`path="${entry.href.split('?')[0]}"`);
    expect(entry.href).not.toMatch(/\/user|\/notebook|\/reset-password|:/);
    expect(entry.description.length).toBeGreaterThan(5);
  }
});

it('keeps the ordinary catalog visible to guests and members without staff links', () => {
  const guest = { ...member, signedIn: false, isAdmin: true, isLeader: true, access: { ...access, canEnterAdmin: true }, pastoralAvailable: true };
  expect(visibleHrefs(guest)).toContain('/learn/church-reading');
  expect(visibleHrefs(guest)).not.toContain('/admin');
  expect(visibleHrefs(member)).not.toContain('/work');
  expect(visibleHrefs(member)).not.toContain('/groups?manage=1');
});

it('matches the existing role and capability rules separately for each staff destination', () => {
  expect(visibleHrefs({ ...member, isLeader: true })).toEqual(expect.arrayContaining(['/admin', '/admin/crm', '/work']));
  expect(visibleHrefs({ ...member, isLeader: true })).not.toContain('/admin/access');
  const delegated = { ...member, access: { ...access, canEnterAdmin: true, permissions: ['devotions.manage'] as MyAccess['permissions'] } };
  expect(visibleHrefs(delegated)).toEqual(expect.arrayContaining(['/admin', '/work', '/admin/church-devotions']));
  expect(visibleHrefs(delegated)).not.toContain('/admin/crm');
  expect(visibleHrefs(delegated)).not.toContain('/admin/feedback');
  expect(visibleHrefs({ ...member, access: { ...access, canManageGroups: true } })).toContain('/groups?manage=1');
  expect(visibleHrefs({ ...member, access: { ...access, canEnterCrm: true } })).toContain('/admin/crm');
  expect(visibleHrefs({ ...member, pastoralAvailable: true })).toContain('/work');
  const admin = { ...member, isAdmin: true, isLeader: true };
  expect(siteMapSections.flatMap(section => section.entries).every(entry => canDiscoverSiteMapEntry(entry, admin))).toBe(true);
});

it('searches function names, descriptions and category text without revealing hidden staff destinations', () => {
  expect(matchingSiteMapSections(member, '  預讀 明天  ').flatMap(section => section.entries.map(entry => entry.href))).toEqual(['/learn/church-reading']);
  expect(matchingSiteMapSections(member, '聚會小工具')[0].entries).toHaveLength(6);
  expect(matchingSiteMapSections(member, '課表管理')).toEqual([]);
  expect(matchingSiteMapSections(member, '不存在的功能')).toEqual([]);
});

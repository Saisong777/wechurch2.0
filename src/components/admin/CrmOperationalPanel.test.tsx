// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CrmOperationalPanel } from './CrmOperationalPanel';
vi.mock('@/components/support/SupportPanel', () => ({ SupportPanel: () => null }));
afterEach(cleanup);
const defaults = { loading: false, error: false, retry: vi.fn(), manageMembers: vi.fn() };
it('does not generate sample groups for an empty database', () => {
  render(<MemoryRouter><CrmOperationalPanel {...defaults} view="groups" groups={[]} /></MemoryRouter>);
  expect(screen.getByText('目前沒有可管理的小家。')).toBeTruthy();
  expect(screen.queryAllByRole('listitem')).toHaveLength(0);
});
it('renders only supplied real group names and membership counts', () => {
  render(<MemoryRouter><CrmOperationalPanel {...defaults} view="groups" groups={[{id:'actual',name:'真實小家',church:'iM',leaderName:'組長',memberCount:3}]} /></MemoryRouter>);
  expect(screen.getAllByRole('listitem')).toHaveLength(1);
  expect(screen.getByText('真實小家')).toBeTruthy();expect(screen.getByText('3 位帳號成員')).toBeTruthy();
});

it('keeps two supplied life-group leaders on the same footing in CRM',()=>{render(<MemoryRouter><CrmOperationalPanel {...defaults} view="groups" groups={[{id:'actual',name:'共同負責小家',church:'iM',leaderName:'領袖甲',coLeaderName:'領袖乙',memberCount:3}]} /></MemoryRouter>);expect(screen.getByText('iM · 小家長：領袖甲、領袖乙')).toBeVisible();expect(screen.queryByText(/副小家長|主要小家長/)).toBeNull();});

it('keeps unlinked roster records distinct from registered member counts',()=>{
  render(<MemoryRouter><CrmOperationalPanel {...defaults} view="groups" groups={[{id:'actual',name:'測試小家',church:'iM',leaderName:'領袖甲',memberCount:2,unlinkedMemberCount:3}]} /></MemoryRouter>);
  expect(screen.getByText('2 位帳號成員')).toBeVisible();
  expect(screen.getByText('· 3 筆名錄待連帳號')).toBeVisible();
  expect(screen.queryByText('5 位成員')).toBeNull();
});

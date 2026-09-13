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
  expect(screen.getByText('目前沒有可管理的小組。')).toBeTruthy();
  expect(screen.queryAllByRole('listitem')).toHaveLength(0);
});
it('renders only supplied real group names and membership counts', () => {
  render(<MemoryRouter><CrmOperationalPanel {...defaults} view="groups" groups={[{id:'actual',name:'真實小組',church:'iM',leaderName:'組長',memberCount:3}]} /></MemoryRouter>);
  expect(screen.getAllByRole('listitem')).toHaveLength(1);
  expect(screen.getByText('真實小組')).toBeTruthy();expect(screen.getByText('3 位成員')).toBeTruthy();
});

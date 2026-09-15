// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { FeaturePortalPage } from './FeaturePortalPage';
import { appNavItems, isNavItemActive } from '@/lib/navigation';
vi.mock('@/components/layout/Header', () => ({ Header: ({ title }: { title: string }) => <h1>{title}</h1> }));
afterEach(cleanup);

it('keeps all feature actions once, without explanatory cards', () => {
  const actions = ['bible', 'notes', 'timeline'].map(id => ({ id, title: id, subtitle: 'Unnecessary explanation', href: `/${id}`, icon: BookOpen, tone: '', iconTone: '', testId: `link-${id}` }));
  render(<MemoryRouter><FeaturePortalPage title="Bible" subtitle="" actions={actions} /></MemoryRouter>);
  expect(screen.getAllByRole('link')).toHaveLength(3);
  for (const action of actions) expect(screen.getByTestId(action.testId)).toHaveAttribute('href', action.href);
  expect(screen.queryByText('Unnecessary explanation')).toBeNull();
});
it('separates personal prayer, public walls and groups in the main navigation', () => {
  expect(appNavItems.map(item => item.href)).toEqual(['/', '/learn', '/share', '/walls', '/groups']);
  expect(appNavItems.some(item => isNavItemActive('/user', item))).toBe(false);
  expect(isNavItemActive('/learn/bible', appNavItems[1])).toBe(true);
});

it.each(['/walls', '/prayer-wall', '/devotion-wall'])('marks only the walls unit active for %s', path => {
  expect(appNavItems.filter(item => isNavItemActive(path, item)).map(item => item.id)).toEqual(['walls']);
});

it.each(['/share', '/grace-record'])('marks personal prayer active for %s', path => {
  expect(appNavItems.filter(item => isNavItemActive(path, item)).map(item => item.id)).toEqual(['share']);
});

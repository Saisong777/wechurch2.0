// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { CastleContentPresentationContext } from '@/contexts/CastleContentPresentationContext';
import WePlayPage from './WePlayPage';
import DiscipleQuizPage from './DiscipleQuizPage';
const flags = vi.hoisted(() => ({disabled: [] as string[], loading: false, error: null as string | null}));
vi.mock('@/hooks/useFeatureToggles', () => ({useFeatureToggles: () => ({...flags, isFeatureEnabled: (key: string) => !flags.disabled.includes(key), getDisabledMessage: () => '未開放'})}));
vi.mock('@/components/layout/Header', () => ({Header: () => null}));
vi.mock('@/components/play/DiscipleQuiz', () => ({default: () => <p>真實測驗元件入口</p>}));
vi.mock('@/components/product/FeaturePortalPage', () => ({FeaturePortalPage: ({actions}: {actions: Array<{id:string;title:string;href:string}>}) => <nav>{actions.map(action => <a key={action.id} href={action.href}>{action.title}</a>)}</nav>}));
beforeEach(() => {flags.disabled = []; flags.loading = false; flags.error = null;});
afterEach(cleanup);
function show(castle = false) { return render(<MemoryRouter><CastleContentPresentationContext.Provider value={castle}><WePlayPage/></CastleContentPresentationContext.Provider></MemoryRouter>); }
it('renders only the personality activity inside the castle, without a tool browser', () => {show(true); expect(screen.getByText('真實測驗元件入口')).toBeTruthy(); expect(screen.queryByRole('navigation')).toBeNull(); expect(screen.queryByRole('link', {name: '抽破冰題'})).toBeNull();});
it('preserves all four existing tools in traditional mode', () => {show(); expect(screen.getAllByRole('link')).toHaveLength(4); expect(screen.getByRole('link', {name: '十二門徒人格'}).getAttribute('href')).toBe('/play/disciple-quiz');});
it.each(['we_play', 'disciple_quiz'])('does not expose the quiz when %s is disabled', key => {flags.disabled = [key]; show(true); expect(screen.queryByText('真實測驗元件入口')).toBeNull();});
it('also gates the direct quiz route and fails closed during loading or errors', () => {
  flags.loading = true; const view = render(<MemoryRouter><DiscipleQuizPage/></MemoryRouter>); expect(screen.queryByText('真實測驗元件入口')).toBeNull();
  flags.loading = false; flags.error = 'offline'; view.rerender(<MemoryRouter><DiscipleQuizPage/></MemoryRouter>); expect(screen.queryByText('真實測驗元件入口')).toBeNull();
});

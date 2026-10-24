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
it('opens an activity pavilion before entering the quiz', () => {show(true); expect(screen.getByRole('heading',{name:'相聚小亭'})).toBeTruthy(); expect(document.activeElement).toBe(screen.getByRole('heading',{name:'相聚小亭'})); expect(screen.getByRole('link',{name:'十二門徒人格'}).getAttribute('href')).toBe('/play/disciple-quiz'); expect(screen.queryByText('真實測驗元件入口')).toBeNull(); expect(screen.queryByRole('link', {name: '抽破冰題'})).toBeNull();});
it('preserves all four existing tools in traditional mode', () => {show(); expect(screen.getAllByRole('link')).toHaveLength(4); expect(screen.getByRole('link', {name: '十二門徒人格'}).getAttribute('href')).toBe('/play/disciple-quiz');});
it('keeps the pavilion when only its current activity is disabled', () => {flags.disabled=['disciple_quiz'];show(true);expect(screen.getByRole('heading',{name:'相聚小亭'})).toBeTruthy();expect(screen.queryByRole('link',{name:'十二門徒人格'})).toBeNull();expect(screen.getByRole('status').textContent).toContain('活動準備中');});
it.each(['disabled','loading','error'])('fails closed for the pavilion during %s',state=>{flags.disabled=state==='disabled'?['we_play']:[];flags.loading=state==='loading';flags.error=state==='error'?'offline':null;show(true);expect(screen.queryByRole('heading',{name:'相聚小亭'})).toBeNull();expect(screen.queryByRole('link',{name:'十二門徒人格'})).toBeNull();});
it('focuses the pavilion heading after flags finish loading',()=>{flags.loading=true;const v=show(true);flags.loading=false;v.rerender(<MemoryRouter><CastleContentPresentationContext.Provider value><WePlayPage/></CastleContentPresentationContext.Provider></MemoryRouter>);expect(document.activeElement).toBe(screen.getByRole('heading',{name:'相聚小亭'}));});
it('offers a castle-only return to activities on the quiz route',()=>{const v=render(<MemoryRouter><CastleContentPresentationContext.Provider value><DiscipleQuizPage/></CastleContentPresentationContext.Provider></MemoryRouter>);expect(screen.getByRole('link',{name:'返回相聚小亭'}).getAttribute('href')).toBe('/play');v.unmount();render(<MemoryRouter><DiscipleQuizPage/></MemoryRouter>);expect(screen.queryByRole('link',{name:'返回相聚小亭'})).toBeNull();});
it('also gates the direct quiz route and fails closed during loading or errors', () => {
  flags.loading = true; const view = render(<MemoryRouter><DiscipleQuizPage/></MemoryRouter>); expect(screen.queryByText('真實測驗元件入口')).toBeNull();
  flags.loading = false; flags.error = 'offline'; view.rerender(<MemoryRouter><DiscipleQuizPage/></MemoryRouter>); expect(screen.queryByText('真實測驗元件入口')).toBeNull();
});

import {CastleContentPresentationContext} from '@/contexts/CastleContentPresentationContext';
// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import LoginPage from './LoginPage';
import { loginForPage } from '@shared/pageAccessPolicy';
const auth = vi.hoisted(() => ({ user: null as null | {id:string}, loading: false, signUp: vi.fn(async () => ({})), signIn: vi.fn(async () => ({})) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
afterEach(() => { cleanup(); auth.user = null; vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
it('explains Google account conflicts without exposing provider details', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ staging: true, google: true, emailRegistration: false }) })));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/login?error=google_link_required']}><LoginPage /></MemoryRouter></QueryClientProvider>);
  expect(await screen.findByRole('alert')).toHaveTextContent('避免建立重複帳號');
  client.clear();
});

it('restores query and the fragment inherited from a direct protected-page server redirect', async () => {
  auth.user = { id: 'member' };
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ google: true, emailRegistration: false }) })));
  function ReturnedPage() { const location = useLocation(); return <p>{location.pathname + location.search + location.hash}</p>; }
  // HTTP requests contain no fragment; browsers inherit #recent on a 302.
  const redirect = loginForPage('/me/activity?tab=notes') + '#recent';
  render(<MemoryRouter initialEntries={[redirect]}><Routes><Route path="/login" element={<LoginPage />} /><Route path="/me/activity" element={<ReturnedPage />} /></Routes></MemoryRouter>);
  expect(await screen.findByText('/me/activity?tab=notes#recent')).toBeVisible();
});
it('opens signup from an invitation and leaves email available without LINE', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: url === '/api/auth/options', json: async () => ({ staging: true, google: false, emailRegistration: true }) })));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/login?mode=signup&returnTo=%2Fgroups']}><LoginPage /></MemoryRouter></QueryClientProvider>);
  expect(await screen.findByText('建立新帳戶')).toBeTruthy();
  expect(screen.getByTestId('input-password')).toHaveAttribute('minlength', '8');
  expect(screen.getByTestId('button-submit')).toHaveTextContent('註冊');
  fireEvent.click(screen.getByRole('button', { name: /^已有帳號$/ }));
  expect(screen.getByTestId('button-submit')).toHaveTextContent('登入');
  expect(screen.queryByRole('button', { name: '使用 LINE 登入' })).toBeNull();
  client.clear();
});
it('offers one Google entry for B registration and login without a password form', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ staging: true, google: true, emailRegistration: false }) })));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/login?mode=signup']}><LoginPage /></MemoryRouter></QueryClientProvider>);
  expect(await screen.findByRole('button', { name: '使用 Google 帳號繼續' })).toBeEnabled();
  expect(screen.getByText(/登入後，可以保存讀經記錄與筆記/)).toBeVisible();
  expect(screen.getByRole('link',{name:'先看看使用說明'})).toHaveAttribute('href','/help');
  expect(screen.queryByTestId('input-password')).toBeNull();
  expect(screen.queryByRole('group', { name: '帳號操作' })).toBeNull();
  expect(screen.queryByTestId('button-submit')).toBeNull();
  client.clear();
});
it('does not expose a misleading registration form when configuration fails', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}><MemoryRouter><LoginPage /></MemoryRouter></QueryClientProvider>);
  expect(await screen.findByRole('alert')).toHaveTextContent('暫時無法載入登入方式');
  expect(screen.queryByTestId('input-password')).toBeNull();
  client.clear();
});

it('returns from login to feedback even when local storage is disabled', async () => {
  auth.user = {id:'member'};
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('Storage unavailable'); });
  vi.stubGlobal('fetch', vi.fn(async () => ({ok:true,json:async () => ({google:true,emailRegistration:false})})));
  render(<MemoryRouter initialEntries={['/login?returnTo=%2Ffeedback']}><Routes><Route path="/login" element={<LoginPage />} /><Route path="/feedback" element={<p>回到意見草稿</p>} /></Routes></MemoryRouter>);
  expect(await screen.findByText('回到意見草稿')).toBeVisible();
});

it('presents only the original login actions in castle content, retaining configuration errors',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({staging:true,google:true,emailRegistration:false})})));
 const view=render(<MemoryRouter initialEntries={['/login?error=google_login_failed&returnTo=%2Fgroups']}><CastleContentPresentationContext.Provider value><LoginPage/></CastleContentPresentationContext.Provider></MemoryRouter>);
 expect(await screen.findByRole('button',{name:'使用 Google 帳號繼續'})).toBeEnabled();expect(screen.getByRole('alert')).toHaveTextContent('Google 登入未完成');expect(screen.queryByText('WeChurch')).toBeNull();expect(screen.queryByTestId('text-bible-verse')).toBeNull();expect(screen.queryByText('Powered by Christ')).toBeNull();expect(view.container.querySelector('.castle-login-content')).toBeTruthy();expect(view.container.querySelector('.login-brand-lockup')).toBeNull();
});
it('keeps the original email operation and return target in castle presentation',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({staging:true,google:false,emailRegistration:true})})));
 const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});
 const content=()=> <QueryClientProvider client={client}><MemoryRouter initialEntries={['/login?returnTo=%2Fgroups%3Fview%3Dnote#recent']}><CastleContentPresentationContext.Provider value><Routes><Route path="/login" element={<LoginPage/>}/><Route path="/groups" element={<Returned/>}/></Routes></CastleContentPresentationContext.Provider></MemoryRouter></QueryClientProvider>;
 const view=render(content());
 function Returned(){const location=useLocation();return <p>{location.pathname+location.search+location.hash}</p>;}
 fireEvent.change(await screen.findByTestId('input-email'),{target:{value:'member@example.test'}});fireEvent.change(screen.getByTestId('input-password'),{target:{value:'test-password'}});fireEvent.click(screen.getByTestId('button-submit'));expect(auth.signIn).toHaveBeenCalledWith('member@example.test','test-password');
 auth.user={id:'member'};view.rerender(content());expect(await screen.findByText('/groups?view=note#recent')).toBeTruthy();client.clear();
});

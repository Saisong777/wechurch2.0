// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { PageAccessBoundary } from './PageAccessBoundary';
const auth=vi.hoisted(()=>({user:null as null | {id:string},loading:false}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>auth}));
vi.mock('@/components/PageLoader',()=>({PageLoader:()=> <p role="status">checking session</p>}));
afterEach(()=>{cleanup();auth.user=null;auth.loading=false;});
function Destination(){const location=useLocation();return <p data-testid="destination">{location.pathname+location.search}</p>;}
function mount(path:string){const mounted=vi.fn();function Protected(){mounted();return <p>private content</p>;}
 render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/login" element={<Destination/>}/><Route path="*" element={<PageAccessBoundary><Protected/></PageAccessBoundary>}/></Routes></MemoryRouter>);return mounted;}
it('redirects before mounting the private page and retains query/hash',()=>{const mounted=mount('/me/activity?tab=notes#recent');expect(mounted).not.toHaveBeenCalled();const destination=screen.getByTestId('destination').textContent!;expect(new URL(destination,'https://example.test').searchParams.get('returnTo')).toBe('/me/activity?tab=notes#recent');});
it('waits for session resolution without rendering a protected page',()=>{auth.loading=true;const mounted=mount('/me');expect(mounted).not.toHaveBeenCalled();expect(screen.getByRole('status')).toHaveTextContent('checking session');});
it('lets the existing role gate handle a signed-in member instead of sending them back to login',()=>{auth.user={id:'member'};const mounted=mount('/admin');expect(mounted).toHaveBeenCalled();expect(screen.getByText('private content')).toBeVisible();});
it.each(['/groups#invite=sample','/feedback','/sitemap','/bible'])('preserves the public route %s while anonymous',path=>{const mounted=mount(path);expect(mounted).toHaveBeenCalled();});

// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';import {cleanup,render,screen,fireEvent,waitFor,act} from '@testing-library/react';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {MemoryRouter} from 'react-router-dom';import React from 'react';
import {ChurchLoginInbox} from '@/components/notifications/ChurchLoginInbox';
import type {ChurchLoginInbox as Inbox} from '@shared/churchOnboarding';
import {churchScopeKey,setChurchScope,subscribeChurchScope} from '@/lib/churchFetch';
const actor=vi.hoisted(()=>({user:{id:'synthetic-admin'},loading:false}));const state=vi.hoisted(()=>({selected:'IM 行動教會'}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>actor}));
vi.mock('@/contexts/ChurchContext',async()=>{const React=await import('react');const church=await import('@/lib/churchFetch');return {useChurchContext:()=>({identity:state.selected,loading:false,data:{selectedChurch:state.selected,isSystemAdmin:true}}),useChurchScopeKey:()=>React.useSyncExternalStore(church.subscribeChurchScope,church.churchScopeKey,church.churchScopeKey)};});
const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
afterEach(()=>{cleanup();client.clear();setChurchScope(null,false);vi.unstubAllGlobals();});
it('keeps scope caches isolated when a previous church write fails after switching away',async()=>{
 state.selected='IM 行動教會';setChurchScope({actorId:actor.user.id,actorChurch:'IM 行動教會',selectedChurch:state.selected,isSystemAdmin:true});const oldScope=churchScopeKey();let rejectPatch:(r:Response)=>void=()=>{};let patchStarted=false;
 const name=(s:string)=>s==='火樂'?'合成火樂人':'合成iM人';const rid='10000000-0000-4000-8000-000000000001';
 vi.stubGlobal('fetch',vi.fn(async(input,init)=>{const scope=decodeURIComponent(new Headers(init?.headers).get('X-WeChurch-Church')||'');const counts={canManage:true,scopeChurch:scope,unhandledArrivals:1,unassignedArrivals:0,unassignedUnreadDigestDays:0,unreadDigestDays:0,total:1};if(init?.method==='PATCH'){patchStarted=true;return await new Promise<Response>(r=>rejectPatch=r);}if(String(input).includes('/me/'))return new Response(JSON.stringify(counts));return new Response(JSON.stringify({canManage:true,scopeChurch:scope,scope:'church',arrivals:[{id:rid,userId:rid,name:name(scope),church:scope,currentChurch:scope,reason:'initial_choice',status:'pending',version:1,createdAt:'2026-10-06T00:00:00Z',updatedAt:'2026-10-06T00:00:00Z'}],nextCursor:null,days:[],today:'2026-10-06',counts}));}));
 const tree=()=> <QueryClientProvider client={client}><MemoryRouter><ChurchLoginInbox/></MemoryRouter></QueryClientProvider>;const view=render(tree());await screen.findByText('合成iM人');fireEvent.click(screen.getByRole('button',{name:'標記已關懷：合成iM人'}));await waitFor(()=>expect(patchStarted).toBe(true));
 await act(async()=>{state.selected='火樂';setChurchScope({actorId:actor.user.id,actorChurch:'IM 行動教會',selectedChurch:state.selected,isSystemAdmin:true});view.rerender(tree());});await screen.findByText('合成火樂人');
 await act(async()=>{rejectPatch(new Response('{"error":"synthetic failed write"}',{status:503}));});
 await waitFor(()=>expect(client.getMutationCache().getAll().some(m=>m.state.status==='error')).toBe(true));
 const old=client.getQueryData<Inbox>(['/api/admin/church-login-inbox',actor.user.id,oldScope,'church',null]);expect(old?.arrivals[0]?.name).toBe('合成iM人');
 await act(async()=>{state.selected='IM 行動教會';setChurchScope({actorId:actor.user.id,actorChurch:'IM 行動教會',selectedChurch:state.selected,isSystemAdmin:true});view.rerender(tree());});
 expect(await screen.findByText('合成iM人')).toBeVisible();expect(screen.queryByText('合成火樂人')).toBeNull();
});

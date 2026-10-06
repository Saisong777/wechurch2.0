// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {PendingChurchAffiliations} from './PendingChurchAffiliations';
const state=vi.hoisted(()=>({admin:true,refreshAuth:vi.fn()}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'owner'},refreshAuth:state.refreshAuth})}));
vi.mock('@/contexts/ChurchContext',()=>({useChurchContext:()=>({identity:'verified',data:{isSystemAdmin:state.admin,allowedOptions:[{id:'火樂',name:'火樂'}]}})}));
let client:QueryClient;let fail=false;let calls:Array<{church:string;expectedChurch:null}>=[];
beforeEach(()=>{state.admin=true;state.refreshAuth.mockReset();fail=false;calls=[];client=new QueryClient({defaultOptions:{queries:{retry:false}}});vi.spyOn(window,'confirm').mockReturnValue(true);vi.stubGlobal('fetch',vi.fn(async(_url:string,o?:RequestInit)=>{if(o?.method==='PATCH'){calls.push(JSON.parse(String(o.body)));return new Response('{}',{status:fail?409:200});}return new Response(JSON.stringify({users:[{id:'owner',displayName:null,email:'synthetic@example.test',church:null}]}));}));});
afterEach(()=>{cleanup();client.clear();vi.restoreAllMocks();vi.unstubAllGlobals();});
function mount(){render(<QueryClientProvider client={client}><PendingChurchAffiliations/></QueryClientProvider>);}
it('approves only the church with expected null, preserves profile fields and refreshes own auth',async()=>{mount();fireEvent.change(await screen.findByRole('combobox'),{target:{value:'火樂'}});await waitFor(()=>expect(state.refreshAuth).toHaveBeenCalledOnce());expect(calls).toEqual([{church:'火樂',expectedChurch:null}]);});
it('does not approve after cancellation and hides the control from a non-admin',async()=>{vi.mocked(window.confirm).mockReturnValue(false);mount();fireEvent.change(await screen.findByRole('combobox'),{target:{value:'火樂'}});expect(calls).toEqual([]);cleanup();state.admin=false;mount();expect(screen.queryByRole('combobox')).toBeNull();});
it('reports a concurrent approval and re-fetches current members without claiming success',async()=>{fail=true;mount();fireEvent.change(await screen.findByRole('combobox'),{target:{value:'火樂'}});expect(await screen.findByRole('alert')).toHaveTextContent('會員歸屬已被其他管理者更新');expect(state.refreshAuth).not.toHaveBeenCalled();expect(calls).toHaveLength(1);expect(vi.mocked(fetch).mock.calls.filter(([,o])=>!o?.method)).toHaveLength(2);});

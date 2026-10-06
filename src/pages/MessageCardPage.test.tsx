// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {MessageCardPage} from './MessageCardPage';
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:null,loading:false})}));
vi.mock('@/components/layout/Header',()=>({Header:()=>null}));
vi.mock('@/components/user/QRCodeScanner',()=>({QRCodeScanner:()=>null}));
vi.mock('@/components/ui/feature-gate',()=>({FeatureGate:({children}:{children:React.ReactNode})=>children}));
vi.mock('@/lib/retry-utils',()=>({staggeredStart:async()=>{},withRetry:async(action:()=>Promise<unknown>)=>action()}));
vi.mock('sonner',()=>({toast:{error:vi.fn(),success:vi.fn()}}));
let sent:Record<string,unknown>|null=null;
beforeEach(()=>{sent=null;localStorage.clear();vi.stubGlobal('fetch',vi.fn(async(url:string,o?:RequestInit)=>{if(url==='/api/potential-members'){sent=JSON.parse(String(o?.body));return new Response('{"success":true}');}if(url==='/api/message-card-downloads')return new Response('{}',{status:404});return new Response(JSON.stringify({id:'fixture',title:'邀請图片',shortCode:'A123',church:'火樂',imagePath:'fixture.png',createdAt:'2026-10-06'}));}));vi.spyOn(console,'warn').mockImplementation(()=>{});});
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();});
it('shows the card church, requires explicit consent, and sends only code-bound voluntary contact fields',async()=>{
 render(<MemoryRouter initialEntries={['/message-card?code=A123']}><MessageCardPage/></MemoryRouter>);const name=await screen.findByLabelText('姓名 Name');expect(screen.getByText(/這份圖片由 火樂 提供/)).toBeVisible();fireEvent.change(name,{target:{value:'Synthetic'}});fireEvent.change(screen.getByLabelText('電子郵件 Email'),{target:{value:'synthetic@example.test'}});expect(screen.getByRole('button',{name:'繼續下載 Continue'})).toBeDisabled();expect(sent).toBeNull();fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'繼續下載 Continue'}));await waitFor(()=>expect(sent).toEqual({name:'Synthetic',email:'synthetic@example.test',shortCode:'A123',consent:true}));expect(sent).not.toHaveProperty('church');expect(sent).not.toHaveProperty('userId');expect(screen.queryByLabelText(/教會/)).toBeNull();
});

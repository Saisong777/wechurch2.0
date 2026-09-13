// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter,createMemoryRouter,RouterProvider} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MentoringPanel} from './MentoringPanel';
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'mentor'},loading:false})}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();});
const contract={id:'contract',learnerName:'測試學員',mentorName:'測試陪伴者',courseName:'測試課程',status:'active',isLearner:false,version:2,cadenceDays:14,agreement:'陪伴約定'};
const detail=()=>({contract,progress:[],feedback:[]});
function show(path='/work/mentoring?contract=contract'){
  const cache=new QueryClient({defaultOptions:{queries:{retry:false}}});
  render(<QueryClientProvider client={cache}><MemoryRouter initialEntries={[path]}><MentoringPanel mode="mentor"/></MemoryRouter></QueryClientProvider>);
}
it('locks editing while saving and preserves the response after failure',async()=>{
  let finish!:(r:Response)=>void;
  vi.stubGlobal('fetch',vi.fn(async(path:string,init?:RequestInit)=>init?.method==='PUT'?new Promise<Response>(r=>{finish=r;}):new Response(JSON.stringify(path.endsWith('/contract')?detail():{contracts:[contract]}))));
  show();const input=await screen.findByLabelText('給對方的回應');fireEvent.change(input,{target:{value:'保留回應'}});fireEvent.click(screen.getByRole('button',{name:'送出回應'}));
  await waitFor(()=>expect(input).toBeDisabled());finish(new Response(JSON.stringify({error:'資料已更新'}),{status:409}));
  expect(await screen.findByRole('alert')).toHaveTextContent('資料已更新');expect(input).toHaveValue('保留回應');expect(input).not.toBeDisabled();
});
it('returns to the list after the mentor ends the contract',async()=>{
  vi.spyOn(window,'confirm').mockReturnValue(true);let ended=false;
  vi.stubGlobal('fetch',vi.fn(async(path:string,init?:RequestInit)=>{
    if(init?.method==='PATCH'){ended=true;return new Response('{}');}
    return new Response(JSON.stringify(path.endsWith('/closures')?[]:path.endsWith('/contract')?detail():{contracts:ended?[]:[contract]}));
  }));
  show();fireEvent.click(await screen.findByRole('button',{name:'結束陪伴或準備交接'}));expect(await screen.findByText('目前沒有陪伴關係。')).toBeInTheDocument();
});
it('allows a former mentor to terminate without learner details',async()=>{
  vi.spyOn(window,'confirm').mockReturnValue(true);let sent:unknown;
  vi.stubGlobal('fetch',vi.fn(async(path:string,init?:RequestInit)=>{
    if(init?.method==='PATCH'){sent=JSON.parse(init.body as string);return new Response('{}');}
    return new Response(JSON.stringify(path.endsWith('/closures')?(sent?[]:[{id:'contract',status:'active',version:7}]):{contracts:[]}));
  }));
  show('/work/mentoring');fireEvent.click(await screen.findByRole('button',{name:'結束陪伴'}));await waitFor(()=>expect(sent).toEqual({version:7,action:'end',consent:true}));expect(screen.queryByText('測試學員')).not.toBeInTheDocument();
});
it('opens a successfully submitted invitation through the real route blocker',async()=>{
  let created=false;
  vi.stubGlobal('fetch',vi.fn(async(path:string,init?:RequestInit)=>{
    if(init?.method==='PUT'){created=true;return new Response(JSON.stringify({id:'contract'}));}
    return new Response(JSON.stringify(path.endsWith('/targets')?[{groupId:'group',mentorId:'mentor',groupName:'測試小組',mentorName:'測試陪伴者'}]:path.endsWith('/contract')?{...detail(),contract:{...contract,isLearner:true,status:'pending'}}:{contracts:created?[contract]:[]}));
  }));
  const router=createMemoryRouter([{path:'/me/mentoring',element:<MentoringPanel mode="learner"/>}],{initialEntries:['/me/mentoring?journey=journey']});
  render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><RouterProvider router={router}/></QueryClientProvider>);
  await waitFor(()=>expect(screen.getByRole('button',{name:'邀請陪伴者'})).toBeEnabled());fireEvent.click(screen.getByRole('button',{name:'邀請陪伴者'}));
  fireEvent.change(await screen.findByRole('combobox',{name:'陪伴者'}),{target:{value:'group:mentor'}});
  fireEvent.change(screen.getByRole('textbox'),{target:{value:'約定'}});fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button',{name:'送出邀請'}));
  expect(await screen.findByRole('button',{name:'取消邀請'})).toBeInTheDocument();expect(router.state.location.search).toContain('contract=contract');
});

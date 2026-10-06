// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {churchFetch,setChurchScope} from './churchFetch';
const im={actorId:'actor',actorChurch:'IM 行動教會',selectedChurch:'IM 行動教會',isSystemAdmin:true};
beforeEach(()=>{setChurchScope(im);vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({items:[]}))));});
afterEach(()=>{setChurchScope(null,false);vi.unstubAllGlobals();vi.restoreAllMocks();});
it('scopes both reads and writes while preserving credentials, body and caller headers',async()=>{
 await churchFetch('/api/prayers',{credentials:'include'});await churchFetch('/api/life-groups/management/group',{method:'PATCH',headers:{'Content-Type':'application/json'},body:'{"version":3}'});
 const calls=vi.mocked(fetch).mock.calls;expect(new Headers(calls[0][1]?.headers).get('X-WeChurch-Church')).toBe(encodeURIComponent('IM 行動教會'));
 expect(new Headers(calls[1][1]?.headers).get('Content-Type')).toBe('application/json');expect(calls[1][1]).toMatchObject({method:'PATCH',body:'{"version":3}'});
});
it('does not put a church header on OAuth, private notebooks or foreign APIs',async()=>{
 for(const path of ['/api/auth/user','/api/auth/google','/api/devotional-notes','https://other.example/api/prayers'])await churchFetch(path);
 for(const call of vi.mocked(fetch).mock.calls)expect(call[1]?.headers).toBeUndefined();
});
it('blocks mismatched or all-church requests before making a request',async()=>{
 expect((await churchFetch('/api/prayers?church=火樂')).status).toBe(403);
 expect((await churchFetch('/api/users?church=all')).status).toBe(403);
 expect((await churchFetch('/api/prayers?church=IM%20行動教會',{headers:{'X-WeChurch-Church':encodeURIComponent('火樂')}})).status).toBe(403);expect(fetch).not.toHaveBeenCalled();
});
it('keeps null-affiliation personal notebooks and owner plans available while blocking church walls',async()=>{
 setChurchScope({...im,actorChurch:null,selectedChurch:null,isSystemAdmin:false});
 expect(await(await churchFetch('/api/prayers')).json()).toMatchObject({code:'CHURCH_APPROVAL_REQUIRED'});
 await churchFetch('/api/devotional-notes');await churchFetch('/api/user-reading-plans');expect(fetch).toHaveBeenCalledTimes(2);
});
it('aborts old inflight scope requests and rejects a late response',async()=>{
 let resolve!:(response:Response)=>void;vi.mocked(fetch).mockImplementation(()=>new Promise(done=>{resolve=done;}));
 const old=churchFetch('/api/prayers');const signal=vi.mocked(fetch).mock.calls[0][1]!.signal!;
 setChurchScope({...im,selectedChurch:'火樂'});expect(signal.aborted).toBe(true);resolve(new Response('{}'));await expect(old).rejects.toMatchObject({name:'AbortError'});
});
it('rejects body data that arrives after a verified church switch',async()=>{
 let resolve!:(data:unknown)=>void;const response=new Response('{}');vi.spyOn(response,'json').mockImplementation(()=>new Promise(done=>{resolve=done;}));vi.mocked(fetch).mockResolvedValue(response);
 const old=await churchFetch('/api/devotion-wall');const body=old.json();setChurchScope({...im,selectedChurch:'桃園WeChurch'});resolve({items:['old-church']});await expect(body).rejects.toMatchObject({name:'AbortError'});
});

it('keeps verified-room guest capabilities working without assigning a church and still blocks deck browsing or creation',async()=>{
 setChurchScope(null);for(const path of ['/api/sessions/by-code/ABC123','/api/sessions/fixture/participants','/api/icebreaker/games/ROOM123','/api/icebreaker/cards/current?gameId=room-uuid','/api/message-cards/image/image.png','/api/message-cards/ABC123'])await churchFetch(path);
 expect(fetch).toHaveBeenCalledTimes(6);for(const call of vi.mocked(fetch).mock.calls)expect(call[1]?.headers).toBeUndefined();
 expect((await churchFetch('/api/card-questions')).status).toBe(503);expect((await churchFetch('/api/icebreaker/games',{method:'POST',body:'{}'})).status).toBe(503);expect(fetch).toHaveBeenCalledTimes(6);
});
it('sends verified selected church on material lists and existing-session manager actions',async()=>{
 setChurchScope({...im,selectedChurch:'火樂'});for(const path of ['/api/message-cards/all','/api/card-questions','/api/sessions','/api/sessions/session-id'])await churchFetch(path,{method:path.endsWith('session-id')?'PATCH':'GET'});
 for(const call of vi.mocked(fetch).mock.calls)expect(new Headers(call[1]?.headers).get('X-WeChurch-Church')).toBe(encodeURIComponent('火樂'));
});

it('allows only explicit consenting invitation intake and leaves management listings gated',async()=>{
 setChurchScope(null);const options={method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Synthetic',email:'synthetic@example.test',shortCode:'A123',consent:true})};await churchFetch('/api/potential-members',options);expect(fetch).toHaveBeenCalledOnce();expect(vi.mocked(fetch).mock.calls[0][1]?.headers).toEqual(options.headers);
 for(const extra of [{church:'火樂'},{userId:'fake-user'},{consent:false}])expect((await churchFetch('/api/potential-members',{...options,body:JSON.stringify({...JSON.parse(options.body),...extra})})).status).toBe(503);expect((await churchFetch('/api/potential-members')).status).toBe(503);expect(fetch).toHaveBeenCalledOnce();
});

it.each([['/api/potential-members/member-id','PATCH'],['/api/potential-members/member-id','DELETE'],['/api/user-roles/user-id','PUT'],['/api/users/user-id','PATCH'],['/api/churches/church-id','GET']])('scopes exact management child %s %s with selected church and preserves payload',async(path,method)=>{
 setChurchScope({...im,selectedChurch:'火樂'});const body=method==='GET'?undefined:JSON.stringify({status:'pending'});await churchFetch(path,{method,body,headers:{'Content-Type':'application/json'}});
 const request=vi.mocked(fetch).mock.calls[0][1]!;expect(new Headers(request.headers).get('X-WeChurch-Church')).toBe(encodeURIComponent('火樂'));expect(request).toMatchObject({method,body});
});
it.each(['/api/potential-members/member-id','/api/user-roles/user-id'])('cancels child mutation %s on selected church change and rejects late headers',async path=>{
 let resolve!:(response:Response)=>void;vi.mocked(fetch).mockImplementation(()=>new Promise(done=>{resolve=done;}));setChurchScope({...im,selectedChurch:'火樂'});const old=churchFetch(path,{method:'PATCH',body:'{}'});const signal=vi.mocked(fetch).mock.calls[0][1]!.signal!;setChurchScope({...im,selectedChurch:'桃園WeChurch'});expect(signal.aborted).toBe(true);resolve(new Response('{}'));await expect(old).rejects.toMatchObject({name:'AbortError'});
});
it('rejects a management child body that arrives after actor changes',async()=>{
 let resolve!:(data:unknown)=>void;const response=new Response('{}');vi.spyOn(response,'json').mockImplementation(()=>new Promise(done=>{resolve=done;}));vi.mocked(fetch).mockResolvedValue(response);setChurchScope({...im,selectedChurch:'火樂'});const old=await churchFetch('/api/potential-members/member-id',{method:'DELETE'});const body=old.json();setChurchScope({...im,actorId:'new-actor',selectedChurch:'火樂'});resolve({ok:true});await expect(body).rejects.toMatchObject({name:'AbortError'});
});
it('keeps invitation intake root-only and refuses guest management child writes',async()=>{
 setChurchScope(null);const body=JSON.stringify({name:'Synthetic',email:'synthetic@example.test',shortCode:'A123',consent:true});for(const path of ['/api/potential-members/id','/api/user-roles/id','/api/users/id','/api/churches/id'])expect((await churchFetch(path,{method:'POST',body})).status).toBe(503);expect(fetch).not.toHaveBeenCalled();await churchFetch('/api/potential-members',{method:'POST',body});expect(fetch).toHaveBeenCalledOnce();
});
it('preserves unassigned private own profile/avatar and owner plans while blocking management children',async()=>{
 setChurchScope({...im,actorChurch:null,selectedChurch:null,isSystemAdmin:false});for(const path of ['/api/users/actor/profile','/api/users/actor/avatar','/api/user-reading-plans/plan/progress','/api/devotional-notes'])await churchFetch(path);expect(fetch).toHaveBeenCalledTimes(4);expect((await churchFetch('/api/potential-members/id',{method:'PATCH',body:'{}'})).status).toBe(403);expect((await churchFetch('/api/user-roles/id',{method:'PUT',body:'{}'})).status).toBe(403);
});

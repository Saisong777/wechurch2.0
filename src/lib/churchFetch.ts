export type VerifiedChurchScope = { actorId: string; actorChurch: string | null; selectedChurch: string | null; isSystemAdmin: boolean };
let enforced = false;
let scope: VerifiedChurchScope | null = null;
let epoch = 0;
const requests = new Set<AbortController>();
const listeners = new Set<() => void>();
export function churchScopeKey() { return scope ? JSON.stringify([scope.actorId,scope.actorChurch,scope.selectedChurch]) : 'church-pending'; }
export function subscribeChurchScope(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function setChurchScope(next: VerifiedChurchScope | null, active = true) {
  epoch++; requests.forEach(controller => controller.abort()); requests.clear(); scope = next; enforced = active;
  listeners.forEach(listener => listener());
}
// Explicit same-origin tenant routes only. Auth/OAuth, Bible and private notebook requests stay unchanged.
export function isChurchApi(path: string, method = 'GET') {
  return /^\/api\/(?:me\/church-onboarding|me\/church-login-summary|admin\/church-login-inbox|prayers|prayer-sharing|devotion-wall|life-groups|families|church-reading|admin\/church-devotions|admin\/church-affiliations|crm|access-control|care-visits|feedback|admin\/feedback|notifications|reading-plans|user-reading-plans|user-reading-progress|support|mentoring)(?:\/|$)/.test(path)
    || /^\/api\/(?:message-cards|message-card-downloads|card-questions|icebreaker\/cards)(?:\/|$)/.test(path)
    || path === '/api/sessions' || (path === '/api/icebreaker/games' && method === 'POST')
    || /^\/api\/(?:users|user-roles|potential-members|churches)(?:\/|$)/.test(path);
}
function aborted() { return new DOMException('教會已切換，舊請求已取消。','AbortError'); }
function denied(status: number, code: string, error: string) { return new Response(JSON.stringify({code,error}),{status,headers:{'Content-Type':'application/json'}}); }
export async function churchFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (!enforced) return globalThis.fetch(input,init);
  const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
  const method=(init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const capabilityPath=/^\/api\/(?:sessions\/.+|icebreaker\/(?:games\/.+|session-game))$/.test(url.pathname);
  const publicAsset=method==='GET' && /^\/api\/message-cards\/image\/[^/]+$/.test(url.pathname);
  const invitedCard=method==='GET' && /^\/api\/message-cards\/(?!all$|upload$|image$)[^/]+$/.test(url.pathname);
  const unsupportedLegacyDownload=method==='POST' && url.pathname==='/api/message-card-downloads';
  let invitedIntake=false;
  if(method==='POST' && url.pathname==='/api/potential-members' && typeof init?.body==='string'){
    try{const body=JSON.parse(init.body);invitedIntake=body.consent===true && typeof body.shortCode==='string' && /^[A-Z0-9]{4}$/.test(body.shortCode) && typeof body.name==='string' && typeof body.email==='string' && Object.keys(body).every(key=>['email','name','gender','shortCode','consent'].includes(key));}catch{/* Not an invitation intake; normal verified scope still applies. */}
  }
  const roomCard=method==='GET' && /^\/api\/icebreaker\/cards\/[^/]+$/.test(url.pathname) && url.searchParams.has('gameId');
  if (url.origin !== window.location.origin || publicAsset || invitedCard || unsupportedLegacyDownload || invitedIntake || roomCard || (!isChurchApi(url.pathname,method) && !capabilityPath)) return globalThis.fetch(input,init);
  // Existing browser/participant invitation capabilities retain their original server checks.
  // Verified members supply selected scope for manager actions; guests never receive an invented church.
  if(capabilityPath && !scope?.selectedChurch)return globalThis.fetch(input,init);
  const current = scope;
  if (!current) return denied(503,'CHURCH_CONTEXT_PENDING','正在確認教會歸屬，請稍後重試。');
  const personalOwnerRoute = /^\/api\/(?:me\/church-onboarding|me\/church-login-summary|admin\/church-login-inbox|support|mentoring|user-reading-plans|user-reading-progress)(?:\/|$)/.test(url.pathname) || /^\/api\/users\/[^/]+\/(?:profile|avatar)$/.test(url.pathname);
  if (!current.selectedChurch && !personalOwnerRoute) return denied(403,'CHURCH_APPROVAL_REQUIRED','教會歸屬等待管理者核定；個人筆記與聖經仍可使用。');
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  let requestedHeader: string|null = null;
  try { const value=headers.get('X-WeChurch-Church'); requestedHeader=value===null?null:decodeURIComponent(value); } catch { return denied(400,'INVALID_CHURCH_SCOPE','教會範圍格式無法確認。'); }
  const requestedQuery = url.searchParams.get('church');
  if (requestedHeader && requestedQuery && requestedHeader !== requestedQuery) return denied(403,'CHURCH_SCOPE_MISMATCH','教會範圍不一致，請重新確認目前教會。');
  const requested = requestedHeader || requestedQuery;
  if (requested && requested !== current.selectedChurch) return denied(403,'CHURCH_SCOPE_MISMATCH','請先切換目前教會，再讀取或修改此教會資料。');
  if (current.selectedChurch) headers.set('X-WeChurch-Church',encodeURIComponent(current.selectedChurch));
  const controller = new AbortController(); const generation = epoch;
  const originalSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
  const cancel = () => controller.abort();
  if (originalSignal?.aborted) controller.abort(); else originalSignal?.addEventListener('abort',cancel,{once:true});
  requests.add(controller);
  try {
    const response = await globalThis.fetch(input,{...init,headers,signal:controller.signal});
    if (generation !== epoch || controller.signal.aborted) throw aborted();
    // A switch during body decoding must also reject a late payload, not only a late response header.
    return new Proxy(response,{get(target,property) {
      const value = Reflect.get(target,property,target);
      if (['json','text','blob','arrayBuffer','formData'].includes(String(property))) return async (...args: unknown[]) => {
        const data = await value.apply(target,args);
        if (generation !== epoch || controller.signal.aborted) throw aborted();
        return data;
      };
      return typeof value === 'function' ? value.bind(target) : value;
    }});
  } finally { requests.delete(controller); originalSignal?.removeEventListener('abort',cancel); }
}

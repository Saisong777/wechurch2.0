import { useCallback, useEffect, useRef, useState } from 'react';
import { churchFetch } from '@/lib/churchFetch';
import { castleJoinResponseSchema, castleRosterSchema, type CastleJoin, type CastleRoster } from '@shared/castlePresence';
export type PresenceStatus = 'idle' | 'connecting' | 'ready' | 'joining' | 'joined' | 'disconnected' | 'expired';
export type PresenceView = {
    scope: string | null;
    status: PresenceStatus;
    roster: CastleRoster | null;
    receivedAt: number;
    message: string;
};
const empty = (scope: string | null, status: PresenceStatus = 'idle', message = ''): PresenceView => ({ scope, status, roster: null, receivedAt: 0, message });
export function useCastlePresence(scope: string | null) {
    const [view, setView] = useState<PresenceView>(() => empty(scope));
    const actions = useRef<{
        join: (input: CastleJoin) => void;
        leave: () => void;
        move: (target: number) => void;
        retry: () => void;
    }>();
    useEffect(() => {
        let generation = 0, disposed = false, lease: string | undefined, epoch: string | undefined, serverNow = -Infinity, freshness = 0, joining = false, failures = 0, lastMove = 0, cooldown = 0, pendingMove: number | undefined;
        let pollTimer: ReturnType<typeof setTimeout> | undefined, pollingGeneration: number | undefined;
        const requests = new Set<AbortController>(), timers = new Set<ReturnType<typeof setTimeout>>();
        const later = (fn: () => void, delay: number) => { const timer = setTimeout(() => { timers.delete(timer); fn(); }, delay); timers.add(timer); return timer; };
        const schedulePoll = (delay: number) => { if (pollTimer) {
            clearTimeout(pollTimer);
            timers.delete(pollTimer);
        } pollTimer = later(() => { pollTimer = undefined; void poll(); }, delay); };
        const leaveToken = (token: string | undefined) => { if (token && scope)
            void churchFetch('/api/castle-presence/leave', { method: 'DELETE', headers: { 'X-Castle-Lease': token }, keepalive: true }).catch(() => { }); };
        const clear = (status: PresenceStatus, message = '', release = true) => { generation++; for (const controller of requests)
            controller.abort(); requests.clear(); for (const timer of timers)
            clearTimeout(timer); timers.clear(); const old = lease; lease = undefined; joining = false; pendingMove = undefined; serverNow = -Infinity; if (release)
            leaveToken(old); if (!disposed)
            setView(empty(scope, status, message)); };
        const request = async (path: string, method = 'GET', body?: unknown, token = lease, command?: string) => {
            const own = generation, controller = new AbortController();
            requests.add(controller);
            try {
                const response = await churchFetch(`/api/castle-presence${path}`, { method, signal: controller.signal, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { 'X-Castle-Lease': token } : {}), ...(command ? { 'X-Castle-Command-ID': command } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
                const data = await response.json();
                if (disposed || own !== generation || controller.signal.aborted)
                    throw new DOMException('已取消', 'AbortError');
                if (!response.ok)
                    throw Object.assign(new Error(typeof data?.error === 'string' ? data.error : '城堡連線中斷'), { status: response.status, retryAfter: Math.max(1000, Math.min(60000, Number(response.headers.get('Retry-After') || 2) * 1000)) });
                return data;
            }
            finally {
                requests.delete(controller);
            }
        };
        const accept = (data: unknown, joiningResponse = false) => {
            const roster = joiningResponse ? castleJoinResponseSchema.parse(data) : castleRosterSchema.parse(data);
            if (epoch && epoch !== roster.instanceEpoch) {
                clear('expired', '城堡已重新開啟，請再次加入。');
                epoch = roster.instanceEpoch;
                return false;
            }
            epoch = roster.instanceEpoch;
            if (joiningResponse)
                lease = castleJoinResponseSchema.parse(data).leaseToken;
            if (roster.serverNow < serverNow) {
                if (joiningResponse)
                    setView(previous => ({ ...previous, status: 'joined' }));
                return true;
            }
            serverNow = roster.serverNow;
            failures = 0;
            freshness = performance.now();
            later(() => { if (performance.now() - freshness >= 25000)
                clear('disconnected', '城堡連線已逾時，請重新連線。'); }, 25010);
            if (lease && !roster.avatars.some(a => a.isSelf)) {
                clear('expired', '連線已到期，請再次加入城堡。');
                return false;
            }
            setView({ scope, status: lease ? 'joined' : 'ready', roster, receivedAt: performance.now(), message: '' });
            return true;
        };
        const failed = (error: any) => {
            if (error?.name === 'AbortError' || disposed)
                return;
            if (error?.status === 429) {
                cooldown = performance.now() + error.retryAfter;
                setView(previous => ({ ...previous, status: previous.status === 'joining' ? 'ready' : previous.status, message: '操作稍快，請稍候再試。' }));
                return;
            }
            failures++;
            const forbidden = error?.status === 401 || error?.status === 403;
            clear(forbidden ? 'expired' : 'disconnected', forbidden ? '登入或教會資料已改變，請重新確認。' : error?.status === 409 ? '連線已到期，請再次加入城堡。' : '城堡連線中斷，畫面已清空。');
            if (!forbidden && failures <= 3 && !document.hidden)
                schedulePoll(Math.min(8000, 1000 * 2 ** failures));
        };
        const poll = async () => { if (!scope || disposed || document.hidden || pollingGeneration === generation)
            return; const own = generation; pollingGeneration = own; try {
            accept(await request(''));
            if (own === generation)
                schedulePoll(2000);
        }
        catch (error: any) {
            if (error?.status === 429 && own === generation) {
                failed(error);
                schedulePoll(error.retryAfter);
            }
            else
                failed(error);
        }
        finally {
            if (pollingGeneration === own)
                pollingGeneration = undefined;
        } };
        const heartbeat = async () => { if (!lease || disposed || document.hidden)
            return; const own = generation; try {
            accept(await request('/heartbeat', 'POST', {}));
            if (own === generation && lease)
                later(() => void heartbeat(), 8000);
        }
        catch (error: any) {
            if (error?.status === 429 && own === generation) {
                failed(error);
                later(() => void heartbeat(), error.retryAfter);
            }
            else
                failed(error);
        } };
        let moving = false, moveTimer: ReturnType<typeof setTimeout> | undefined;
        const scheduleMove = (delay: number) => { if (moveTimer) {
            clearTimeout(moveTimer);
            timers.delete(moveTimer);
        } moveTimer = later(() => { moveTimer = undefined; void flushMove(); }, delay); };
        const flushMove = async () => {
            if (moving || pendingMove === undefined || !lease || disposed || document.hidden)
                return;
            const wait = Math.max(lastMove + 1500, cooldown) - performance.now();
            if (wait > 0) {
                scheduleMove(wait);
                return;
            }
            const target = pendingMove;
            pendingMove = undefined;
            moving = true;
            lastMove = performance.now();
            const own = generation;
            try {
                accept(await request('/move', 'POST', { targetNode: target }, lease, crypto.randomUUID()));
            }
            catch (error: any) {
                if (error?.status === 429 && own === generation) {
                    pendingMove = pendingMove ?? target;
                    failed(error);
                }
                else
                    failed(error);
            }
            finally {
                moving = false;
                if (own === generation && pendingMove !== undefined)
                    scheduleMove(Math.max(50, cooldown - performance.now()));
            }
        };
        const retry = () => { if (!scope || document.hidden)
            return; clear('connecting'); failures = 0; epoch = undefined; void poll(); };
        actions.current = { retry, leave: () => { clear('ready'); if (scope && !document.hidden)
                void poll(); }, move: target => { if (!lease || !Number.isInteger(target) || target < 0 || target > 15)
                return; pendingMove = target; void flushMove(); }, join: input => { if (!scope || joining || document.hidden || performance.now() < cooldown)
                return; joining = true; setView(previous => ({ ...previous, status: 'joining', message: '' })); const own = generation; void request('/join', 'POST', input).then(data => { if (accept(data, true) && own === generation && lease) {
                later(() => void heartbeat(), 8000);
                schedulePoll(2000);
            } }).catch(failed).finally(() => { if (own === generation)
                joining = false; }); } };
        const visibility = () => { if (document.hidden)
            clear('idle', '已暫時離開城堡。');
        else
            retry(); };
        document.addEventListener('visibilitychange', visibility);
        setView(empty(scope, scope ? 'connecting' : 'idle'));
        if (scope && !document.hidden)
            void poll();
        return () => { disposed = true; clear('idle'); actions.current = undefined; document.removeEventListener('visibilitychange', visibility); };
    }, [scope]);
    return { view: view.scope === scope ? view : empty(scope, scope ? 'connecting' : 'idle'), join: useCallback((input: CastleJoin) => actions.current?.join(input), []), leave: useCallback(() => actions.current?.leave(), []), move: useCallback((target: number) => actions.current?.move(target), []), retry: useCallback(() => actions.current?.retry(), []) };
}

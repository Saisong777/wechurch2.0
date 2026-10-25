import { useCallback, useEffect, useRef, useState } from 'react';
import { churchFetch } from '@/lib/churchFetch';
import { castleCompatibleJoinSchema, castleCompatibleRosterSchema, type CastleRosterV2 } from '@shared/castlePresence';
import { castleProfileResponseSchema } from '@shared/castleAvatar';
export type PresenceStatus = 'idle' | 'connecting' | 'ready' | 'joining' | 'joined' | 'disconnected' | 'expired';
export type PresenceView = {
    scope: string | null;
    status: PresenceStatus;
    roster: CastleRosterV2 | null;
    receivedAt: number;
    message: string;
};
const empty = (scope: string | null, status: PresenceStatus = 'idle', message = ''): PresenceView => ({ scope, status, roster: null, receivedAt: 0, message });
type NetworkError = Error & {
    status?: number;
    retryAfter?: number;
};
export function useCastlePresence(scope: string | null) {
    const [view, setView] = useState<PresenceView>(() => empty(scope));
    const actions = useRef<{
        join: () => void;
        leave: () => void;
        move: (target: number) => void;
        retry: () => void;
        refresh: () => void;
    }>();
    useEffect(() => {
        let generation = 0, disposed = false, desired = true, authorized = true, lease: string | undefined, epoch: string | undefined, serverNow = -Infinity, freshness = 0, joining = false, failures = 0, lastMove = 0, cooldown = 0, pendingMove: number | undefined, moving = false, polling = false;
        const requests = new Set<AbortController>(), timers = new Set<ReturnType<typeof setTimeout>>();
        let pollTimer: ReturnType<typeof setTimeout> | undefined, moveTimer: ReturnType<typeof setTimeout> | undefined;
        const later = (fn: () => void, delay: number) => {
            const timer = setTimeout(() => {
                timers.delete(timer);
                fn();
            }, delay);
            timers.add(timer);
            return timer;
        };
        const release = (token: string | undefined) => {
            if (token && scope)
                void churchFetch('/api/castle-presence/leave', { method: 'DELETE', headers: { 'X-Castle-Protocol': '2', 'X-Castle-Lease': token }, keepalive: true }).catch(() => {
                });
        };
        function clear(status: PresenceStatus, message = '') {
            generation++;
            requests.forEach(c => c.abort());
            requests.clear();
            timers.forEach(clearTimeout);
            timers.clear();
            pollTimer = moveTimer = undefined;
            const old = lease;
            lease = undefined;
            joining = false;
            polling = false;
            moving = false;
            pendingMove = undefined;
            serverNow = -Infinity;
            release(old);
            if (!disposed)
                setView(empty(scope, status, message));
        }
        async function request(path: string, method = 'GET', body?: unknown, token = lease, command?: string) {
            const own = generation, controller = new AbortController();
            requests.add(controller);
            try {
                const response = await churchFetch(`/api/castle-presence${path}`, { method, signal: controller.signal, headers: { 'X-Castle-Protocol': '2', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { 'X-Castle-Lease': token } : {}), ...(command ? { 'X-Castle-Command-ID': command } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
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
        }
        function schedulePoll(delay: number) {
            if (pollTimer) {
                clearTimeout(pollTimer);
                timers.delete(pollTimer);
            }
            pollTimer = later(() => {
                pollTimer = undefined;
                void poll();
            }, delay);
        }
        function recover(delay: number) {
            if (!scope || disposed || document.hidden || !authorized)
                return;
            if (failures > 3)
                return;
            later(() => {
                if (desired)
                    void enter();
                else
                    void poll();
            }, Math.max(delay, cooldown - performance.now(), 0));
        }
        function disconnect(status: PresenceStatus, message: string) {
            clear(status, message);
            epoch = undefined;
            failures++;
            recover(Math.min(8000, 1000 * 2 ** failures));
        }
        function accept(data: unknown, joiningResponse = false) {
            const roster = joiningResponse ? castleCompatibleJoinSchema.parse(data) : castleCompatibleRosterSchema.parse(data);
            if (epoch && epoch !== roster.instanceEpoch) {
                disconnect('expired', '城堡已重新開啟，正在重新連接。');
                return false;
            }
            epoch = roster.instanceEpoch;
            if (joiningResponse)
                lease = castleCompatibleJoinSchema.parse(data).leaseToken;
            if (roster.serverNow < serverNow) {
                if (joiningResponse)
                    setView(old => ({ ...old, status: 'joined' }));
                return true;
            }
            serverNow = roster.serverNow;
            failures = 0;
            freshness = performance.now();
            const own = generation, stamp = freshness;
            later(() => {
                if (own === generation && stamp === freshness && performance.now() - freshness >= 25000)
                    disconnect('disconnected', '城堡連線已逾時，正在重新連接。');
            }, 25010);
            if (lease && !roster.avatars.some(a => a.isSelf)) {
                disconnect('expired', '連線已到期，正在重新連接。');
                return false;
            }
            setView({ scope, status: lease ? 'joined' : 'ready', roster, receivedAt: performance.now(), message: !desired ? '已離開此分頁；其他分頁的玩偶可能仍在城堡。' : '' });
            return true;
        }
        function failed(value: unknown) {
            const error = value as NetworkError;
            if (error?.name === 'AbortError' || disposed)
                return;
            if (error.status === 429) {
                cooldown = performance.now() + (error.retryAfter || 2000);
                setView(old => ({ ...old, status: old.status === 'joining' ? 'connecting' : old.status, message: '操作稍快，請稍候再試。' }));
                return;
            }
            if (error.status === 401 || error.status === 403) {
                authorized = false;
                clear('expired', '登入或教會資料已改變，請重新確認。');
                return;
            }
            disconnect(error.status === 409 ? 'expired' : 'disconnected', error.status === 409 ? '連線已到期，正在重新連接。' : '城堡連線中斷，畫面已清空。');
        }
        async function poll() {
            if (!scope || disposed || document.hidden || polling)
                return;
            polling = true;
            const own = generation;
            try {
                if (accept(await request('')) && own === generation)
                    schedulePoll(2000);
            }
            catch (error) {
                if (own === generation) {
                    failed(error);
                    if ((error as NetworkError).status === 429)
                        schedulePoll((error as NetworkError).retryAfter || 2000);
                }
            }
            finally {
                if (own === generation)
                    polling = false;
            }
        }
        async function heartbeat() {
            if (!lease || disposed || document.hidden)
                return;
            const own = generation;
            try {
                if (accept(await request('/heartbeat', 'POST', {})) && own === generation && lease)
                    later(() => void heartbeat(), 8000);
            }
            catch (error) {
                if (own === generation) {
                    failed(error);
                    if ((error as NetworkError).status === 429)
                        later(() => void heartbeat(), (error as NetworkError).retryAfter || 2000);
                }
            }
        }
        async function enter() {
            if (!scope || disposed || document.hidden || joining || lease || !desired || !authorized)
                return;
            const delay = cooldown - performance.now();
            if (delay > 0) {
                recover(delay);
                return;
            }
            joining = true;
            const own = generation;
            setView(old => ({ ...old, status: 'joining', message: '' }));
            try {
                castleProfileResponseSchema.parse(await request('/profile'));
                if (!desired || own !== generation)
                    return;
                if (accept(await request('/join', 'POST', {}), true) && own === generation && lease) {
                    later(() => void heartbeat(), 8000);
                    schedulePoll(2000);
                }
            }
            catch (error) {
                if (own === generation) {
                    failed(error);
                    if ((error as NetworkError).status === 429) {
                        failures++;
                        recover((error as NetworkError).retryAfter || 2000);
                    }
                }
            }
            finally {
                if (own === generation)
                    joining = false;
            }
        }
        function scheduleMove(delay: number) {
            if (moveTimer) {
                clearTimeout(moveTimer);
                timers.delete(moveTimer);
            }
            moveTimer = later(() => {
                moveTimer = undefined;
                void flushMove();
            }, delay);
        }
        async function flushMove() {
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
            catch (error) {
                if (own === generation) {
                    if ((error as NetworkError).status === 429)
                        pendingMove = pendingMove ?? target;
                    failed(error);
                }
            }
            finally {
                if (own === generation) {
                    moving = false;
                    if (pendingMove !== undefined)
                        scheduleMove(Math.max(50, cooldown - performance.now()));
                }
            }
        }
        function retry() {
            if (!scope || document.hidden)
                return;
            clear('connecting');
            failures = 0;
            epoch = undefined;
            authorized = true;
            if (desired)
                void enter();
            else
                void poll();
        }
        actions.current = { retry, refresh: () => void poll(), join: () => {
                desired = true;
                retry();
            }, leave: () => {
                desired = false;
                clear('ready', '已離開此分頁；其他分頁的玩偶可能仍在城堡。');
                if (scope && !document.hidden)
                    void poll();
            }, move: target => {
                if (!lease || !Number.isInteger(target) || target < 0 || target > 15)
                    return;
                pendingMove = target;
                void flushMove();
            } };
        const visibility = () => {
            if (document.hidden)
                clear('idle', '已暫時離開城堡。');
            else if (authorized)
                retry();
        };
        document.addEventListener('visibilitychange', visibility);
        setView(empty(scope, scope ? 'connecting' : 'idle'));
        if (scope && !document.hidden)
            void enter();
        return () => {
            disposed = true;
            clear('idle');
            actions.current = undefined;
            document.removeEventListener('visibilitychange', visibility);
        };
    }, [scope]);
    return { view: view.scope === scope ? view : empty(scope, scope ? 'connecting' : 'idle'), join: useCallback(() => actions.current?.join(), []), leave: useCallback(() => actions.current?.leave(), []), move: useCallback((target: number) => actions.current?.move(target), []), retry: useCallback(() => actions.current?.retry(), []), refresh: useCallback(() => actions.current?.refresh(), []) };
}

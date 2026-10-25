import { useCallback, useEffect, useRef, useState } from 'react';
import { churchFetch } from '@/lib/churchFetch';
import { castleProfileResponseSchema, castleProfileSaveSchema, type CastleAvatarProfile, type CastleProfileResponse } from '@shared/castleAvatar';
type ProfileState = {
    scope: string | null;
    data: CastleProfileResponse | null;
    loading: boolean;
    saving: boolean;
    error: string;
    errorCode: string;
    conflict: boolean;
};
const initial = (scope: string | null): ProfileState => ({ scope, data: null, loading: false, saving: false, error: '', errorCode: '', conflict: false });
export function useCastleAvatarProfile(scope: string | null, enabled: boolean) {
    const [state, setState] = useState<ProfileState>(() => initial(scope)), generation = useRef(0), controllers = useRef(new Set<AbortController>()), busy = useRef(false);
    const current = useRef({ scope, enabled });
    current.current = { scope, enabled };
    const request = useCallback(async (method: 'GET' | 'PUT', body?: unknown) => {
        if (!scope || !current.current.enabled)
            return null;
        const own = generation.current, controller = new AbortController();
        controllers.current.add(controller);
        let timedOut = false;
        let rejectAbort!: () => void;
        const cancelled = new Promise<never>((_resolve, reject) => {
            rejectAbort = () => reject(timedOut ? new Error('造型請求已逾時，結果尚未確認，請重新載入帳號造型。') : new DOMException('已取消', 'AbortError'));
            controller.signal.addEventListener('abort', rejectAbort, { once: true });
        });
        const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 20000);
        try {
            const operation = async () => {
                const response = await churchFetch('/api/castle-presence/profile', { method, signal: controller.signal, headers: { 'X-Castle-Protocol': '2', ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
                const data = await response.json();
                if (own !== generation.current || controller.signal.aborted || current.current.scope !== scope || !current.current.enabled) return null;
                if (!response.ok) throw Object.assign(new Error(data?.error || '目前無法讀取造型。'), { status: response.status, code: typeof data?.code === 'string' ? data.code : '' });
                return castleProfileResponseSchema.parse(data);
            };
            return await Promise.race([operation(), cancelled]);
        }
        finally {
            clearTimeout(timeout);
            controller.signal.removeEventListener('abort', rejectAbort);
            controllers.current.delete(controller);
        }
    }, [scope]);
    const load = useCallback(async () => {
        if (!scope || busy.current)
            return null;
        const own = generation.current;
        setState(old => ({ ...old, scope, loading: true, error: '', errorCode: '', conflict: false }));
        try {
            const data = await request('GET');
            if (data && own === generation.current)
                setState({ scope, data, loading: false, saving: false, error: '', errorCode: '', conflict: false });
            return data;
        }
        catch (error) {
            if (own === generation.current)
                setState(old => ({ ...old, loading: false, error: (error as Error).message, errorCode: (error as {code?:string}).code || '', conflict: false }));
            return null;
        }
        finally {
            if (own === generation.current)
                setState(old => ({ ...old, loading: false }));
        }
    }, [scope, request]);
    const invalidate = useCallback(() => {
        generation.current++;
        controllers.current.forEach(c => c.abort());
        controllers.current.clear();
        busy.current = false;
    }, []);
    useEffect(() => {
        invalidate();
        setState(initial(scope));
        if (enabled && scope)
            void load();
        return invalidate;
    }, [scope, enabled, load, invalidate]);
    const save = useCallback(async (profile: CastleAvatarProfile) => {
        if (!scope || busy.current || !current.current.enabled || state.scope !== scope || !state.data || state.errorCode === 'CHURCH_CONTEXT_CHANGED')
            return null;
        const input = castleProfileSaveSchema.safeParse({ expectedRevision: state.data.revision, profile });
        if (!input.success) {
            setState(old => ({ ...old, error: '請檢查暱稱與造型選項。' }));
            return null;
        }
        const own = generation.current;
        busy.current = true;
        setState(old => ({ ...old, saving: true, error: '', errorCode: '', conflict: false }));
        try {
            const data = await request('PUT', input.data);
            if (data && own === generation.current)
                setState({ scope, data, loading: false, saving: false, error: '', errorCode: '', conflict: false });
            return data;
        }
        catch (error) {
            if (own === generation.current) {
                const status = (error as {
                    status?: number;
                    code?: string;
                }).status;
                const code = (error as {code?:string}).code || '';
                setState(old => ({ ...old, saving: false, errorCode: code, error: status ? (error as Error).message : '儲存結果尚未確認，請重新載入帳號造型確認後再試。', conflict: status === 409 && code !== 'CHURCH_CONTEXT_CHANGED' }));
            }
            return null;
        }
        finally {
            if (own === generation.current) {
                busy.current = false;
                setState(old => ({ ...old, saving: false }));
            }
        }
    }, [scope, state.scope, state.data, state.errorCode, request]);
    return { state: state.scope === scope ? state : initial(scope), load, save };
}

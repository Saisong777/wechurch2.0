import { useCallback, useEffect, useRef, useState } from 'react';
import { churchFetch } from '@/lib/churchFetch';
import { castleProfileResponseSchema, castleProfileSaveSchema, type CastleAvatarProfile, type CastleProfileResponse } from '@shared/castleAvatar';
type ProfileState = {
    scope: string | null;
    data: CastleProfileResponse | null;
    loading: boolean;
    saving: boolean;
    error: string;
    conflict: boolean;
};
const initial = (scope: string | null): ProfileState => ({ scope, data: null, loading: false, saving: false, error: '', conflict: false });
export function useCastleAvatarProfile(scope: string | null, enabled: boolean) {
    const [state, setState] = useState<ProfileState>(() => initial(scope)), generation = useRef(0), controllers = useRef(new Set<AbortController>()), busy = useRef(false);
    const current = useRef({ scope, enabled });
    current.current = { scope, enabled };
    const request = useCallback(async (method: 'GET' | 'PUT', body?: unknown) => {
        if (!scope || !current.current.enabled)
            return null;
        const own = generation.current, controller = new AbortController();
        controllers.current.add(controller);
        try {
            const response = await churchFetch('/api/castle-presence/profile', { method, signal: controller.signal, headers: { 'X-Castle-Protocol': '2', ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
            const data = await response.json();
            if (own !== generation.current || controller.signal.aborted || current.current.scope !== scope || !current.current.enabled)
                return null;
            if (!response.ok)
                throw Object.assign(new Error(data?.error || '目前無法讀取造型。'), { status: response.status });
            return castleProfileResponseSchema.parse(data);
        }
        finally {
            controllers.current.delete(controller);
        }
    }, [scope]);
    const load = useCallback(async () => {
        if (!scope || busy.current)
            return null;
        const own = generation.current;
        setState(old => ({ ...old, scope, loading: true, error: '', conflict: false }));
        try {
            const data = await request('GET');
            if (data && own === generation.current)
                setState({ scope, data, loading: false, saving: false, error: '', conflict: false });
            return data;
        }
        catch (error) {
            if (own === generation.current)
                setState(old => ({ ...old, loading: false, error: (error as Error).message, conflict: false }));
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
        if (!scope || busy.current || !current.current.enabled || state.scope !== scope || !state.data)
            return null;
        const input = castleProfileSaveSchema.safeParse({ expectedRevision: state.data.revision, profile });
        if (!input.success) {
            setState(old => ({ ...old, error: '請檢查暱稱與造型選項。' }));
            return null;
        }
        const own = generation.current;
        busy.current = true;
        setState(old => ({ ...old, saving: true, error: '', conflict: false }));
        try {
            const data = await request('PUT', input.data);
            if (data && own === generation.current)
                setState({ scope, data, loading: false, saving: false, error: '', conflict: false });
            return data;
        }
        catch (error) {
            if (own === generation.current) {
                const status = (error as {
                    status?: number;
                }).status;
                setState(old => ({ ...old, saving: false, error: status ? (error as Error).message : '儲存結果尚未確認，請重新載入帳號造型確認後再試。', conflict: status === 409 }));
            }
            return null;
        }
        finally {
            if (own === generation.current) {
                busy.current = false;
                setState(old => ({ ...old, saving: false }));
            }
        }
    }, [scope, state.scope, state.data, request]);
    return { state: state.scope === scope ? state : initial(scope), load, save };
}

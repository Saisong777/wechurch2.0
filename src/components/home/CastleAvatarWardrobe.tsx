import { useEffect, useState, type RefObject } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Shirt, X } from 'lucide-react';
import { Dialog, DialogPortal, DialogOverlay, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useCastleAvatarProfile } from '@/hooks/useCastleAvatarProfile';
import { castleAppearance, type CastleAvatarProfile } from '@shared/castleAvatar';
import CastleAvatarPreview from './castle/CastleAvatarPreview';

const options = {
    genderPresentation: [['neutral', '中性'], ['male', '男生'], ['female', '女生']],
    skinTone: [['light', '淺膚'], ['warm', '暖膚'], ['tan', '麥膚'], ['deep', '深膚']],
    hairStyle: [['short', '短髮'], ['bob', '俐落短鮑伯'], ['long', '長髮'], ['none', '無髮']],
    hairColor: [['black', '墨黑'], ['brown', '深棕'], ['chestnut', '栗棕'], ['silver', '銀灰']],
    outfit: [['casual', '便服'], ['jacket', '外套'], ['skirt', '裙裝']],
    outfitColor: [['jade', '青綠'], ['coral', '珊瑚'], ['sunshine', '日光黃'], ['blue', '湖藍'], ['ivory', '米白'], ['violet', '紫藤']],
} as const;
const labels = {
    genderPresentation: '玩偶性別呈現', skinTone: '膚色', hairStyle: '髮型',
    hairColor: '髮色', outfit: '服裝', outfitColor: '服裝配色',
};

export default function CastleAvatarWardrobe({ scope, open, onOpenChange, onSaved, returnFocus, foreground = false }: {
    scope: string | null;
    open: boolean;
    onOpenChange: (value: boolean) => void;
    onSaved: () => void;
    returnFocus: RefObject<HTMLElement | null>;
    foreground?: boolean;
}) {
    const { state, load, save } = useCastleAvatarProfile(scope, open);
    const [ownedDraft, setOwnedDraft] = useState<{ scope: string | null; profile: CastleAvatarProfile } | null>(null);
    // A changed account cannot display even one frame of another account's draft.
    const draft = ownedDraft?.scope === scope ? ownedDraft.profile : null;
    const setDraft = (profile: CastleAvatarProfile) => setOwnedDraft({ scope, profile });
    useEffect(() => { setOwnedDraft(null); }, [scope, open]);
    useEffect(() => {
        if (state.data) setOwnedDraft(old => old?.scope === scope ? old : { scope, profile: state.data!.profile });
    }, [state.data, scope]);

    const reload = () => void load().then(value => { if (value) setDraft(value.profile); });
    const saveDraft = () => {
        if (!draft) return;
        void save(draft).then(value => {
            if (value) {
                onSaved();
                onOpenChange(false);
            }
        });
    };

    return <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogPortal>
            <DialogOverlay />
            <DialogPrimitive.Content
                className="castle-wardrobe fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2"
                onCloseAutoFocus={event => {
                    event.preventDefault();
                    if (!foreground && returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true });
                }}
            >
                <DialogHeader>
                    <DialogTitle><Shirt size={21} aria-hidden="true" />我的造型</DialogTitle>
                    <DialogDescription>這是你的城堡玩偶。外觀不會更改會員個人資料，髮型與穿著都可自由搭配。</DialogDescription>
                </DialogHeader>
                <div className="castle-wardrobe-scroll">
                    {state.loading && !draft && <p role="status">正在取回帳號造型…</p>}
                    {state.error && <div role="alert">
                        <p>{state.error}</p>
                        <button type="button" disabled={state.loading || state.saving} onClick={reload}>
                            {state.conflict ? '載入另一視窗的新造型' : '重新載入帳號造型'}
                        </button>
                    </div>}
                    {draft && <div className="castle-wardrobe-grid">
                        <div className="castle-wardrobe-display">
                            <CastleAvatarPreview appearance={castleAppearance(draft)} />
                            <p className="castle-wardrobe-name">{draft.alias || '我的玩偶'}</p>
                            <small>拖曳玩偶轉身看看。儲存後，同教會的人會看見你的新造型。</small>
                        </div>
                        <fieldset disabled={state.saving || state.loading}>
                            <label className="castle-wardrobe-alias">城堡暱稱
                                <input value={draft.alias} maxLength={24} autoComplete="off" onChange={event => setDraft({ ...draft, alias: event.target.value })} />
                            </label>
                            {Object.entries(options).map(([key, values]) => <fieldset className="castle-wardrobe-option" key={key}>
                                <legend>{labels[key as keyof typeof labels]}</legend>
                                <div>{values.map(([value, label]) => <button
                                    key={value} type="button"
                                    aria-pressed={draft[key as keyof typeof options] === value}
                                    onClick={() => setDraft({ ...draft, [key]: value })}
                                >
                                    {key === 'outfitColor' && <i className={`castle-look-swatch castle-look-swatch--${value}`} aria-hidden="true" />}{label}
                                </button>)}</div>
                            </fieldset>)}
                        </fieldset>
                    </div>}
                    <p className="castle-wardrobe-help">造型儲存在這個帳號，不是只保留在這台裝置。若送出後連線中斷，請重新載入確認儲存結果。</p>
                </div>
                <footer>
                    <button type="button" onClick={() => onOpenChange(false)}>取消</button>
                    <button type="button" className="castle-primary-link" disabled={!draft || !draft.alias.trim() || state.saving || state.loading} onClick={saveDraft}>
                        {state.saving ? '正在儲存…' : '儲存造型'}
                    </button>
                </footer>
                <DialogPrimitive.Close className="absolute" aria-label="關閉我的造型"><X size={19} aria-hidden="true" /></DialogPrimitive.Close>
            </DialogPrimitive.Content>
        </DialogPortal>
    </Dialog>;
}

import { createContext, useContext, useEffect, useId, useState, type ReactNode } from 'react';
import { ALargeSmall, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export const readingKey = 'wechurch-reading-preferences';
export const textSizes = [
  { value: 'compact', label: '精簡', percent: 100 },
  { value: 'standard', label: '標準', percent: 112.5 },
  { value: 'large', label: '大', percent: 125 },
  { value: 'extra', label: '特大', percent: 150 },
  { value: 'maximum', label: '最大', percent: 225 },
] as const;
type Preferences = { size: typeof textSizes[number]['value']; font: 'sans' | 'serif' };
export const defaultReading: Preferences = { size: 'standard', font: 'sans' };
export function parseReading(value: string | null): Preferences {
  try {
    const saved = JSON.parse(value || 'null');
    return { size: textSizes.some(s => s.value === saved?.size) ? saved.size : defaultReading.size,
      font: saved?.font === 'serif' ? 'serif' : 'sans' };
  } catch { return defaultReading; }
}
const ReadingContext = createContext({ preferences: defaultReading, update: (_: Preferences) => {} });
export const useReadingPreferences = () => useContext(ReadingContext);
export function ReadingPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(() => {
    try { return parseReading(localStorage.getItem(readingKey)); } catch { return defaultReading; }
  });
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.textSize = preferences.size;
    html.dataset.readingFont = preferences.font;
    html.style.fontSize = `${textSizes.find(s => s.value === preferences.size)!.percent}%`;
  }, [preferences]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === readingKey || event.key === null) setPreferences(parseReading(event.newValue));
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const update = (value: Preferences) => {
    setPreferences(value);
    try { localStorage.setItem(readingKey, JSON.stringify(value)); } catch { /* Still works for this visit. */ }
  };
  return <ReadingContext.Provider value={{ preferences, update }}>{children}</ReadingContext.Provider>;
}

export function ReadingPreferencesControl({ inline = false }: { inline?: boolean }) {
  const { preferences, update } = useReadingPreferences();
  const id = useId();
  const fields = <div className="reading-preferences space-y-4">
    <fieldset><legend className="mb-2 font-semibold">全站文字大小</legend>
      <div className="grid grid-cols-2 gap-2">
        {textSizes.map(size => <label key={size.value} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-2 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10">
          <input type="radio" name={`${id}-size`} checked={preferences.size === size.value} onChange={() => update({ ...preferences, size: size.value })} className="shrink-0 accent-primary" />{size.label}
        </label>)}
      </div>
    </fieldset>
    <fieldset><legend className="mb-2 font-semibold">閱讀字型</legend>
      <div className="grid gap-2">
        {([['sans', '清晰黑體'], ['serif', '閱讀宋體']] as const).map(([font, label]) => <label key={font} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-2 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10">
          <input type="radio" name={`${id}-font`} checked={preferences.font === font} onChange={() => update({ ...preferences, font })} className="shrink-0 accent-primary" />{label}
        </label>)}
      </div>
    </fieldset>
    <p className="reading-copy border-y py-3">愛神、愛人，一起走在信仰的路上。</p>
    <Button type="button" variant="ghost" onClick={() => update(defaultReading)}><RotateCcw aria-hidden="true" />恢復預設文字</Button>
  </div>;
  if (inline) return <details className="min-w-0 border-t pt-3"><summary className="flex min-h-11 cursor-pointer items-center gap-2 font-medium"><ALargeSmall aria-hidden="true" className="h-5 w-5 shrink-0" />文字大小與字型</summary>{fields}</details>;
  return <Popover><PopoverTrigger asChild><Button variant="ghost" size="icon" aria-label="文字大小與字型" title="文字大小與字型"><ALargeSmall aria-hidden="true" /></Button></PopoverTrigger>
    <PopoverContent align="end" className="max-w-[calc(100vw-24px)] max-h-[min(80dvh,var(--radix-popover-content-available-height))] overflow-y-auto" aria-label="文字大小與字型">{fields}</PopoverContent>
  </Popover>;
}

import { useId } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { saveGroupReadingFontSize } from './groupReadingFontPreference';
export function GroupReadingFontControl({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const id = useId();
  function change(next: number) {
    onChange(next);
    saveGroupReadingFontSize(next);
  }
  return <div className="reader-font-control">
    <label htmlFor={id} className="shrink-0 text-sm font-medium">字級</label>
    <input id={id} type="range" min="16" max="26" step="1" value={value} aria-valuetext={`閱讀字級 ${value}`} onChange={event => change(Number(event.target.value))} />
    <output htmlFor={id} className="w-6 shrink-0 text-center text-sm tabular-nums">{value}</output>
    <Button variant="ghost" size="icon" aria-label="重設閱讀字級" title="重設閱讀字級" onClick={() => change(20)}><RotateCcw aria-hidden="true" className="h-4 w-4" /></Button>
  </div>;
}

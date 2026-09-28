import { useId, useState } from 'react';
import { Bell, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { careToday } from '@shared/care';

export function CareReminder({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const id = useId();
  function after(days: number) {
    const date = new Date(`${careToday()}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }
  return <div className="min-w-0 space-y-3">
    <Button type="button" variant="ghost" className="min-h-11 max-w-full gap-2 px-0 text-primary hover:bg-transparent" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
      {value ? <Bell aria-hidden="true" className="h-4 w-4 shrink-0" /> : <Plus aria-hidden="true" className="h-4 w-4 shrink-0" />}
      {value ? `${value} 提醒我關心` : '提醒我再關心'}
      {value && <span className="text-xs text-muted-foreground">調整</span>}
    </Button>
    {open && <div id={id} className="space-y-3 border-l-2 border-primary/20 pl-3">
      <p className="text-xs leading-6 text-muted-foreground">到了這一天，會出現在「待關心」清單，提醒你再聯絡。</p>
      <div className="flex flex-wrap gap-2">
        {([[3, '三天後'], [7, '一週後']] as const).map(([days, label]) => <Button key={days} type="button" className="min-h-11" variant={!custom && value === after(days) ? 'secondary' : 'outline'} aria-pressed={!custom && value === after(days)} onClick={() => { onChange(after(days)); setCustom(false); }}>{label}</Button>)}
        <Button type="button" className="min-h-11" variant={custom ? 'secondary' : 'outline'} aria-pressed={custom} onClick={() => setCustom(true)}>選日期</Button>
      </div>
      {custom && <label className="block min-w-0 space-y-2"><span className="text-sm font-medium">提醒日期</span><Input className="min-h-11 w-full min-w-0 max-w-full" type="date" value={value} onChange={e => onChange(e.target.value)} /></label>}
      {value && <Button type="button" variant="ghost" className="min-h-11 px-0 text-muted-foreground" onClick={() => { onChange(''); setOpen(false); setCustom(false); }}>取消提醒</Button>}
    </div>}
  </div>;
}

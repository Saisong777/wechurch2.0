import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const choices = [
  { value: 'light', label: '明亮', icon: Sun },
  { value: 'dark', label: '暗色', icon: Moon },
  { value: 'system', label: '跟隨裝置', icon: Monitor },
];

export function AppearanceControl({ inline = false }: { inline?: boolean }) {
  const { theme = 'light', resolvedTheme, setTheme } = useTheme();
  const selected = choices.find(choice => choice.value === theme) || choices[0];
  const Icon = theme === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun;

  if (inline) return <ToggleGroup type="single" value={selected.value} aria-label="顯示模式"
    onValueChange={value => { if (value) setTheme(value); }}
    className="grid w-full grid-cols-3 gap-1 rounded-md border border-border bg-muted/40 p-1">
    {choices.map(choice => <ToggleGroupItem key={choice.value} value={choice.value}
      className="min-h-11 min-w-0 gap-1 px-1 text-xs sm:text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
      <choice.icon className="h-4 w-4 shrink-0" aria-hidden="true" />{choice.label}
    </ToggleGroupItem>)}
  </ToggleGroup>;

  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0"
        aria-label={`顯示模式：${selected.label}`} title="顯示模式">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuLabel>顯示模式</DropdownMenuLabel>
      <DropdownMenuRadioGroup value={selected.value} onValueChange={setTheme}>
        {choices.map(choice => <DropdownMenuRadioItem key={choice.value} value={choice.value} className="min-h-11 gap-2">
          <choice.icon className="h-4 w-4" aria-hidden="true" />{choice.label}
        </DropdownMenuRadioItem>)}
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>;
}

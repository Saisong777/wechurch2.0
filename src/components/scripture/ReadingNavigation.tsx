import { Link, useLocation } from 'react-router-dom';
import { BookOpen, NotebookPen, Bookmark } from 'lucide-react';
import { useFeatureToggles } from '@/hooks/useFeatureToggles';
import { cn } from '@/lib/utils';

const destinations = [
  { href: '/learn/bible', label: '讀聖經', icon: BookOpen, feature: 'bible_reading' },
  { href: '/learn/church-reading', label: '每日靈修', icon: NotebookPen },
  { href: '/learn/my-notes', label: '我的筆記', icon: Bookmark },
];

export function ReadingNavigation() {
  const location = useLocation();
  const { isFeatureEnabled, loading, error } = useFeatureToggles();
  if (loading || error || !isFeatureEnabled('we_learn')) return null;
  const items = destinations.filter(item => !item.feature || isFeatureEnabled(item.feature));

  return <nav aria-label="讀經與靈修" className="border-b border-border/70 bg-background">
    <div className="mx-auto grid max-w-2xl grid-flow-col auto-cols-fr px-4 sm:px-6">
      {items.map(({ href, label, icon: Icon }) => {
        const active = location.pathname === href || (href === '/learn/bible' && location.pathname === '/bible');
        return <Link key={href}
          to={active ? `${location.pathname}${location.search}${location.hash}` : href}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'flex min-h-12 min-w-0 items-center justify-center gap-2 border-b-2 px-2 py-3 text-center text-base font-medium leading-snug transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
            active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground',
          )}>
          <Icon aria-hidden="true" className="hidden h-5 w-5 shrink-0 sm:block" />
          <span className="min-w-0 break-words">{label}</span>
        </Link>;
      })}
    </div>
  </nav>;
}

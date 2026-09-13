import { NavLink } from 'react-router-dom';
import { BookOpen,HandHeart } from 'lucide-react';
import { useFeatureToggles } from '@/hooks/useFeatureToggles';

export function PublicWallTabs() {
  const { isFeatureEnabled } = useFeatureToggles();
  return <div className="mx-auto mb-5 max-w-5xl"><nav aria-label="分享牆" className="flex flex-wrap gap-x-6 border-b">{[
    {to:'/devotion-wall',label:'今日靈修',Icon:BookOpen,key:'we_learn'},
    {to:'/prayer-wall',label:'代禱',Icon:HandHeart,key:'prayer_wall'},
  ].filter(tab => isFeatureEnabled(tab.key)).map(({to,label,Icon})=><NavLink key={to} to={to} className={({isActive})=>`flex min-h-12 items-center gap-2 border-b-2 px-1 text-sm font-medium ${isActive?'border-primary text-primary':'border-transparent text-muted-foreground'}`}><Icon aria-hidden="true" className="h-4 w-4" />{label}</NavLink>)}</nav></div>;
}

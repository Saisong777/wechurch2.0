import { NavLink } from 'react-router-dom';
import { BookOpen,HandHeart } from 'lucide-react';

export function PublicWallTabs() {
  return <nav aria-label="公開牆" className="mx-auto mb-5 flex max-w-5xl gap-6 border-b">{[
    {to:'/prayer-wall',label:'禱告牆',Icon:HandHeart},{to:'/devotion-wall',label:'今日靈修牆',Icon:BookOpen},
  ].map(({to,label,Icon})=><NavLink key={to} to={to} className={({isActive})=>`flex min-h-12 items-center gap-2 border-b-2 px-1 text-sm font-medium ${isActive?'border-primary text-primary':'border-transparent text-muted-foreground'}`}><Icon className="h-4 w-4" />{label}</NavLink>)}</nav>;
}

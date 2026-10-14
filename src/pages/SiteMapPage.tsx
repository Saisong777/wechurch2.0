import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, LockKeyhole, Search } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useAccessControl } from '@/hooks/useAccessControl';
import { usePastoralAccess } from '@/hooks/usePastoralAccess';
import { safeLoginReturn } from '@/lib/loginReturn';
import { matchingSiteMapSections } from '@/lib/siteMapCatalog';
import { pageRequiresAuthentication } from '@shared/pageAccessPolicy';

export default function SiteMapPage() {
  const { user } = useAuth();
  const role = useUserRole();
  const access = useAccessControl();
  const pastoral = usePastoralAccess();
  const [query, setQuery] = useState('');
  const viewer = {
    signedIn: !!user,
    isAdmin: !role.loading && role.isAdmin,
    isLeader: !role.loading && role.isLeader,
    access: access.isError ? undefined : access.data,
    pastoralAvailable: !pastoral.isError && !!pastoral.data?.available,
  };
  const sections = matchingSiteMapSections(viewer, query);

  return <div className="min-h-screen bg-background">
    <Header title="網站導覽" backTo="/" variant="compact" />
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 [overflow-wrap:anywhere]">
      <header className="max-w-2xl">
        <h1 className="text-2xl font-semibold text-foreground">找到你想用的功能</h1>
        <p className="mt-2 text-base leading-7 text-muted-foreground">按用途找入口，或搜尋功能名稱與用途。</p>
        <div className="mt-5">
          <label htmlFor="sitemap-search" className="text-sm font-medium">搜尋網站功能</label>
          <div className="relative mt-2">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
            <Input id="sitemap-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="例如：筆記、小家、預讀明天" className="min-h-11 pl-10 text-base" />
          </div>
        </div>
        {!user && <p className="mt-3 text-sm leading-6 text-muted-foreground">標示「需登入」的功能會先帶你登入，再回到選擇的頁面。</p>}
      </header>

      {sections.length > 0 && <nav aria-label="網站導覽分類" className="mt-5 flex flex-wrap gap-2 border-b border-border pb-5">
        {sections.map(section => <a key={section.id} href={`#sitemap-${section.id}`} className="inline-flex min-h-11 items-center rounded-md border border-border px-3 py-2 text-sm font-medium text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{section.title}</a>)}
      </nav>}
      {query.trim() && <p role="status" className="mt-4 text-sm text-muted-foreground">{sections.length ? `找到 ${sections.reduce((sum, section) => sum + section.entries.length, 0)} 項功能` : '沒有符合的功能，試試其他名稱或用途。'}</p>}
      {!sections.length ? <Button variant="outline" className="mt-3" onClick={() => setQuery('')}>清除搜尋</Button> : <div className="divide-y divide-border">
        {sections.map(section => {
          const Icon = section.icon;
          return <section key={section.id} aria-labelledby={`sitemap-${section.id}`} className="py-6">
            <h2 id={`sitemap-${section.id}`} tabIndex={-1} className="flex scroll-mt-24 items-center gap-2 rounded-sm text-lg font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-primary" />{section.title}</h2>
            {section.id === 'staff' && <p className="mt-2 text-sm leading-6 text-muted-foreground">依你的職分與目前授權顯示可用入口。</p>}
            <ul className="mt-3 grid gap-x-8 sm:grid-cols-2">
              {section.entries.map(entry => {
                const requiresLogin = pageRequiresAuthentication(entry.href.split('?')[0]);
                const destination = !user && requiresLogin ? `/login?returnTo=${encodeURIComponent(safeLoginReturn(entry.href))}` : entry.href;
                return <li key={entry.href} className="min-w-0 border-b border-border/70 last:border-b-0">
                  <Link to={destination} className="group flex min-h-11 items-start gap-3 rounded-md px-2 py-4 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${entry.title}${!user && requiresLogin ? '，需登入' : ''}`}>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-foreground">
                        <span>{entry.title}</span>
                        {requiresLogin && <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground"><LockKeyhole aria-hidden="true" className="h-3 w-3" />{user ? '會員功能' : '需登入'}</span>}
                        {!requiresLogin && <span className="text-xs font-normal text-muted-foreground">公開入口</span>}
                      </span>
                      <span className="mt-1 block text-sm leading-6 text-muted-foreground">{entry.description}</span>
                    </span>
                    <ArrowRight aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                  </Link>
                </li>;
              })}
            </ul>
          </section>;
        })}
      </div>}
    </main>
  </div>;
}

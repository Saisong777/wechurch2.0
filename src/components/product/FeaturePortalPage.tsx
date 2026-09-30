import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { type LucideIcon, ChevronRight } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { cn } from '@/lib/utils';

export interface FeaturePortalAction {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  icon: LucideIcon;
  tone: string;
  iconTone: string;
  badge?: string;
  testId?: string;
}

interface FeaturePortalPageProps {
  title: string;
  subtitle: string;
  actions: FeaturePortalAction[];
  children?: ReactNode;
}

export function FeaturePortalPage({ title, subtitle, actions, children }: FeaturePortalPageProps) {
  return (
    <div className="min-h-screen bg-background">
      <Header title={title} subtitle={subtitle} variant="compact" />
      <main className="container mx-auto px-4 py-4 md:px-6 md:py-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <nav aria-label={title} className="grid gap-3 sm:grid-cols-2">
            {actions.map(action => (
              <Link key={action.id} to={action.href}
                className="flex min-h-20 items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                data-testid={action.testId || `link-feature-${action.id}`}>
                <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-md', action.tone)}>
                  <action.icon aria-hidden="true" className={cn('h-5 w-5', action.iconTone)} />
                </span>
                <span className="min-w-0 flex-1 break-words font-semibold">{action.title}</span>
                <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </nav>
          {children}
        </div>
      </main>
    </div>
  );
}

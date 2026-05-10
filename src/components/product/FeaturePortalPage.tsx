import React from 'react';
import { Link } from 'react-router-dom';
import { LucideIcon, ChevronRight } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
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

export interface FeaturePortalMoment {
  label: string;
  value: string;
}

interface FeaturePortalPageProps {
  title: string;
  subtitle: string;
  eyebrow: string;
  description: string;
  icon: LucideIcon;
  iconTone: string;
  actions: FeaturePortalAction[];
  moments?: FeaturePortalMoment[];
  children?: React.ReactNode;
}

export const FeaturePortalPage: React.FC<FeaturePortalPageProps> = ({
  title,
  subtitle,
  eyebrow,
  description,
  icon: Icon,
  iconTone,
  actions,
  moments = [],
  children,
}) => {
  const primaryAction = actions[0];
  const secondaryActions = actions.slice(1);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <Header title={title} subtitle={subtitle} variant="compact" />

      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8">
        <div className="mx-auto max-w-4xl space-y-4 sm:space-y-5">
          <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="grid gap-0 md:grid-cols-[1.15fr_0.85fr]">
              <div className="p-5 sm:p-6 md:p-7">
                <div className={cn("mb-4 flex h-12 w-12 items-center justify-center rounded-xl", iconTone)}>
                  <Icon className="h-6 w-6" />
                </div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
                  {eyebrow}
                </p>
                <h1 className="text-2xl font-bold leading-tight text-foreground sm:text-3xl">
                  {title}
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                  {description}
                </p>

                {primaryAction && (
                  <Link
                    to={primaryAction.href}
                    className="mt-5 inline-flex w-full items-center justify-between rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 sm:w-auto sm:min-w-[240px]"
                    data-testid={primaryAction.testId || `link-primary-${primaryAction.id}`}
                  >
                    <span className="flex items-center gap-2">
                      <primaryAction.icon className="h-4 w-4" />
                      {primaryAction.title}
                    </span>
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                )}
              </div>

              <div className="border-t bg-muted/25 p-4 md:border-l md:border-t-0 md:p-5">
                <div className="grid gap-2">
                  {moments.map((moment) => (
                    <div key={moment.label} className="rounded-lg border bg-background/80 px-3 py-2">
                      <p className="text-[11px] font-medium text-muted-foreground">{moment.label}</p>
                      <p className="mt-0.5 text-sm font-semibold text-foreground">{moment.value}</p>
                    </div>
                  ))}
                  {moments.length === 0 && secondaryActions.slice(0, 3).map((action) => (
                    <Link
                      key={action.id}
                      to={action.href}
                      className="rounded-lg border bg-background/80 px-3 py-2 transition hover:border-primary/30"
                    >
                      <p className="text-[11px] font-medium text-muted-foreground">{action.badge || '入口'}</p>
                      <p className="mt-0.5 text-sm font-semibold text-foreground">{action.title}</p>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {secondaryActions.length > 0 && (
            <section className="grid gap-3 sm:grid-cols-2">
              {secondaryActions.map((action) => {
                const ActionIcon = action.icon;
                return (
                  <Link
                    key={action.id}
                    to={action.href}
                    className="group block"
                    data-testid={action.testId || `link-feature-${action.id}`}
                  >
                    <Card className="h-full border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
                      <CardContent className="flex h-full items-center gap-3 p-4 sm:p-5">
                        <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", action.tone)}>
                          <ActionIcon className={cn("h-5 w-5", action.iconTone)} />
                        </div>
                        <div className="min-w-0 flex-1">
                          {action.badge && (
                            <p className="mb-1 text-[11px] font-medium text-primary">{action.badge}</p>
                          )}
                          <h2 className="truncate text-base font-semibold text-foreground">
                            {action.title}
                          </h2>
                          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                            {action.subtitle}
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </section>
          )}

          {children}
        </div>
      </main>
    </div>
  );
};

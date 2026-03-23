import type { ComponentProps, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card } from '../ui/card';
import { cn } from '../ui/utils';

type Tone = 'slate' | 'blue' | 'emerald' | 'amber' | 'rose';

const toneStyles: Record<Tone, string> = {
  slate: 'bg-slate-900 text-white',
  blue: 'bg-blue-50 text-blue-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  rose: 'bg-rose-50 text-rose-700',
};

export function PageStack({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('page-enter space-y-4 sm:space-y-6', className)} {...props} />;
}

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  description: string;
  eyebrow?: string;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function PageHeader({
  icon: Icon,
  title,
  description,
  eyebrow,
  action,
  children,
  className,
}: PageHeaderProps) {
  return (
    <Card className={cn('border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]', className)}>
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm">
              <Icon className="size-5" />
            </div>
            <div className="space-y-1.5">
              {eyebrow && (
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                  {eyebrow}
                </p>
              )}
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl">
                {title}
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-[var(--muted-foreground)] sm:text-base">{description}</p>
            </div>
          </div>

          {action && <div className="flex flex-wrap gap-2 lg:justify-end">{action}</div>}
        </div>

        {children}
      </div>
    </Card>
  );
}

interface SectionCardProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: SectionCardProps) {
  return (
    <Card className={cn('border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]', className)}>
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        {(title || description || action) && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              {title && <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">{title}</h2>}
              {description && <p className="text-sm leading-6 text-[var(--muted-foreground)]">{description}</p>}
            </div>
            {action && <div className="flex flex-wrap gap-2">{action}</div>}
          </div>
        )}
        <div className={cn('space-y-4', contentClassName)}>{children}</div>
      </div>
    </Card>
  );
}

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
  onClick?: () => void;
  className?: string;
}

export function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'blue',
  onClick,
  className,
}: MetricCardProps) {
  const Comp = onClick ? 'button' : 'div';

  return (
    <Comp
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-4 rounded-2xl border border-slate-200/80 bg-white px-4 py-4 text-left shadow-sm transition hover:border-slate-300 hover:shadow-md',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      <div className={cn('flex size-11 shrink-0 items-center justify-center rounded-2xl', toneStyles[tone])}>
        <Icon className="size-5" />
      </div>
      <div className="space-y-1">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-xl font-semibold tracking-tight text-slate-950">{value}</p>
        {hint && <p className="text-sm text-slate-600">{hint}</p>}
      </div>
    </Comp>
  );
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-8 text-center">
      <div className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm">
        <Icon className="size-5" />
      </div>
      <div className="mt-4 space-y-1.5">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="text-sm leading-6 text-slate-600">{description}</p>
      </div>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

interface StatusMessageProps {
  tone?: Tone | 'neutral';
  children: ReactNode;
}

export function StatusMessage({ tone = 'neutral', children }: StatusMessageProps) {
  // Map tones to theme variable classes
  const toneClasses = {
    neutral: 'border-border bg-muted text-muted-foreground',
    blue: 'border-accent bg-accent/20 text-accent-foreground',
    emerald: 'border-primary bg-primary/10 text-primary',
    amber: 'border-ring bg-ring/10 text-ring',
    rose: 'border-destructive bg-destructive/10 text-destructive',
  };
  const classes = toneClasses[tone as keyof typeof toneClasses] || toneClasses.neutral;

  return (
    <div aria-live="polite" className={cn('rounded-2xl border px-4 py-3 text-sm', classes)}>
      {children}
    </div>
  );
}

export function SelectField({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'flex h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground shadow-sm outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/35',
        className,
      )}
      {...props}
    />
  );
}

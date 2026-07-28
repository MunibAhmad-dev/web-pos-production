import { Card as ShadCard } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function Card({ children, className = '' }) {
  return <ShadCard className={cn('gap-0 py-0 shadow-sm', className)}>{children}</ShadCard>;
}

export function CardHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-center justify-between px-5 pt-5">
      <div>
        <h3 className="font-heading text-sm font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

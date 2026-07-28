import { Badge as ShadBadge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const tones = {
  gray: 'bg-muted text-muted-foreground',
  blue: 'bg-brand-blue/10 text-brand-blue',
  green: 'bg-brand-green/10 text-brand-green',
  orange: 'bg-brand-orange/10 text-brand-orange',
  red: 'bg-brand-red/10 text-brand-red',
  purple: 'bg-brand-purple/10 text-brand-purple',
};

export default function Badge({ children, tone = 'gray', className }) {
  return <ShadBadge className={cn('rounded-full border-transparent font-medium', tones[tone], className)}>{children}</ShadBadge>;
}

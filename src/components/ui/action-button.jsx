import { Button as ShadButton } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const variantMap = {
  primary: 'default',
  secondary: 'secondary',
  danger: 'destructive',
  ghost: 'ghost',
  outlineDanger: 'outline',
};

const sizeMap = { sm: 'sm', md: 'default' };

const extraClass = {
  outlineDanger: 'border-destructive/30 text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20',
};

export default function Button({ variant = 'primary', size = 'md', className, ...props }) {
  return (
    <ShadButton
      variant={variantMap[variant] || 'default'}
      size={sizeMap[size] || 'default'}
      className={cn(extraClass[variant], className)}
      {...props}
    />
  );
}

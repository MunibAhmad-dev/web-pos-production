import { Children, isValidElement, useId } from 'react';
import { Label } from '@/components/ui/label';
import { Input as ShadInput } from '@/components/ui/input';
import { Textarea as ShadTextarea } from '@/components/ui/textarea';
import {
  Select as ShadSelect,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const EMPTY_SENTINEL = '__empty__';

export function Input({ label, error, className, id, ...props }) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <div className="flex flex-col gap-1.5 text-left">
      {label && <Label htmlFor={inputId}>{label}</Label>}
      <ShadInput id={inputId} className={cn(className)} {...props} />
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

export function Textarea({ label, error, className, id, ...props }) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <div className="flex flex-col gap-1.5 text-left">
      {label && <Label htmlFor={inputId}>{label}</Label>}
      <ShadTextarea id={inputId} className={cn(className)} {...props} />
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

export function Select({ label, error, className, value, onChange, disabled, children, placeholder, ...props }) {
  const options = Children.toArray(children)
    .filter(isValidElement)
    .map((child) => ({
      value: child.props.value === '' || child.props.value === undefined ? EMPTY_SENTINEL : String(child.props.value),
      label: child.props.children,
      disabled: child.props.disabled,
    }));

  const currentValue = value === '' || value === undefined || value === null ? EMPTY_SENTINEL : String(value);
  const currentLabel = options.find((opt) => opt.value === currentValue)?.label;

  const handleValueChange = (val) => {
    onChange?.({ target: { value: val === EMPTY_SENTINEL ? '' : val } });
  };

  return (
    <div className="flex flex-col gap-1.5 text-left">
      {label && <Label>{label}</Label>}
      <ShadSelect value={currentValue} onValueChange={handleValueChange} disabled={disabled} {...props}>
        <SelectTrigger className={cn('w-full', className)}>
          <SelectValue placeholder={placeholder}>{currentLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </ShadSelect>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

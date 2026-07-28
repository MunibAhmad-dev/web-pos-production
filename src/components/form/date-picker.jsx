import { useState } from 'react';
import { CalendarIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export function DatePicker({ label, value, onChange, placeholder = 'Pick a date', className, disabled }) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseISO(value) : undefined;

  const handleSelect = (date) => {
    onChange?.({ target: { value: date ? format(date, 'yyyy-MM-dd') : '' } });
    setOpen(false);
  };

  return (
    <div className="flex flex-col gap-1.5 text-left">
      {label && <Label>{label}</Label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              className={cn('w-full justify-start font-normal', !selected && 'text-muted-foreground', className)}
            >
              <CalendarIcon size={15} />
              {selected ? format(selected, 'dd MMM yyyy') : placeholder}
            </Button>
          }
        />
        <PopoverContent className="w-auto p-0">
          <Calendar mode="single" selected={selected} onSelect={handleSelect} autoFocus />
        </PopoverContent>
      </Popover>
    </div>
  );
}

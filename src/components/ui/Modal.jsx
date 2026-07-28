import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const widthClasses = {
  'max-w-sm': 'max-w-sm sm:max-w-sm',
  'max-w-md': 'max-w-md sm:max-w-md',
  'max-w-lg': 'max-w-lg sm:max-w-lg',
  'max-w-xl': 'max-w-xl sm:max-w-xl',
  'max-w-2xl': 'max-w-2xl sm:max-w-2xl',
};

export default function Modal({ open, onClose, title, children, footer, width = 'max-w-lg' }) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose?.()}>
      <DialogContent className={cn('w-full gap-5 p-5', widthClasses[width] || width)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[65vh] overflow-y-auto px-0.5">{children}</div>
        {footer && <DialogFooter className="-mx-5 -mb-5 px-5 py-4">{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}

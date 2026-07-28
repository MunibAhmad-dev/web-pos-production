import { Search } from 'lucide-react';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { cn } from '@/lib/utils';

export default function SearchInput({ className, ...props }) {
  return (
    <InputGroup className={cn('h-9', className)}>
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput {...props} />
    </InputGroup>
  );
}

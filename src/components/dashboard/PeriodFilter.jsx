import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DatePicker } from '@/components/form/date-picker';

const options = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'year', label: 'This Year' },
  { key: 'custom', label: 'Custom' },
];

export default function PeriodFilter({ period, onChange, from, to, onFromChange, onToChange }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tabs value={period} onValueChange={onChange}>
        <TabsList>
          {options.map((opt) => (
            <TabsTrigger key={opt.key} value={opt.key}>
              {opt.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {period === 'custom' && (
        <div className="flex items-center gap-2">
          <DatePicker value={from} onChange={(e) => onFromChange(e.target.value)} className="w-36" />
          <span className="text-muted-foreground">to</span>
          <DatePicker value={to} onChange={(e) => onToChange(e.target.value)} className="w-36" />
        </div>
      )}
    </div>
  );
}

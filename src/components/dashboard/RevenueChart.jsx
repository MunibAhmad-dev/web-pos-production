import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Card, CardHeader } from '@/components/ui/panel';
import { formatCurrency, formatDate } from '../../utils/format';

export default function RevenueChart({ data, total, currency }) {
  return (
    <Card className="flex-1">
      <CardHeader
        title="Revenue Overview"
        subtitle="Daily sales trend for selected period"
        action={
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Period Total</p>
            <p className="text-lg font-semibold text-brand-purple">{formatCurrency(total, currency)}</p>
          </div>
        }
      />
      <div className="h-72 px-2 py-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-brand-purple)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--color-brand-purple)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
            <XAxis
              dataKey="date"
              tickFormatter={(d) => formatDate(d)}
              tick={{ fontSize: 11, fill: 'var(--color-muted)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => `${currency} ${v / 1000}k`}
              tick={{ fontSize: 11, fill: 'var(--color-muted)' }}
              axisLine={false}
              tickLine={false}
              width={70}
            />
            <Tooltip
              formatter={(value) => formatCurrency(value, currency)}
              labelFormatter={(d) => formatDate(d)}
              contentStyle={{ borderRadius: 12, border: '1px solid var(--color-border)', fontSize: 12 }}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke="var(--color-brand-purple)"
              strokeWidth={2}
              fill="url(#revenueFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

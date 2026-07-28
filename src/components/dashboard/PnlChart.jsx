import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Card, CardHeader } from '@/components/ui/panel';
import { formatCurrency, formatDate } from '../../utils/format';

const stat = (label, value, currency, tone) => (
  <div className={`rounded-xl border border-border px-3 py-2 text-center`}>
    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className={`text-sm font-semibold ${tone}`}>{formatCurrency(value, currency)}</p>
  </div>
);

export default function PnlChart({ series, totals, currency }) {
  return (
    <Card>
      <CardHeader title="Profit & Loss — Last 30 Days" subtitle="Revenue · COGS · Expenses · Gross & Net Profit" />
      <div className="flex flex-wrap gap-2 px-5 pt-4">
        {stat('Revenue', totals.revenue, currency, 'text-brand-blue')}
        {stat('COGS', totals.cogs, currency, 'text-brand-orange')}
        {stat('Expenses', totals.expenses, currency, 'text-brand-red')}
        {stat('Gross', totals.gross, currency, 'text-brand-green')}
        {stat('Net', totals.net, currency, 'text-brand-purple')}
      </div>
      <div className="h-72 px-2 py-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
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
            <Line type="monotone" dataKey="revenue" stroke="var(--color-brand-blue)" strokeWidth={2} dot={false} />
            <Line
              type="monotone"
              dataKey="cogs"
              stroke="var(--color-brand-orange)"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

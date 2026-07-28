import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/panel';
import Badge from '@/components/ui/status-badge';

export default function StockSummaryCard({ totalItems, lowStockCount }) {
  const healthy = Math.max(totalItems - lowStockCount, 0);
  const data = healthy > 0 ? [{ name: 'Healthy', value: healthy }, { name: 'Low Stock', value: lowStockCount }] : [{ name: 'Low Stock', value: lowStockCount || 1 }];
  const pct = totalItems > 0 ? Math.round((lowStockCount / totalItems) * 100) : 0;

  return (
    <Card className="w-full lg:w-96">
      <CardHeader
        title="Stock Summary"
        subtitle="Inventory health overview"
        action={lowStockCount > 0 ? <Badge tone="orange">{lowStockCount} low stock</Badge> : <Badge tone="green">Healthy</Badge>}
      />
      <div className="relative mx-auto h-48 w-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={62} outerRadius={82} startAngle={90} endAngle={-270}>
              {data.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={entry.name === 'Low Stock' ? 'var(--color-brand-orange)' : 'var(--color-muted)'}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-2xl font-semibold text-ink">{totalItems}</p>
          <p className="text-xs text-muted-foreground">Total Items</p>
        </div>
      </div>

      <div className="px-5 pb-5">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-brand-orange" /> Low Stock
          </span>
          <span className="font-medium text-ink">
            {lowStockCount} · {pct}%
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-canvas">
          <div className="h-full bg-brand-orange" style={{ width: `${pct}%` }} />
        </div>
        <Link
          to="/inventory"
          className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-brand-blue hover:underline"
        >
          View Stock Report <ArrowRight size={13} />
        </Link>
      </div>
    </Card>
  );
}

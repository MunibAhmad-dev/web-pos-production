const toneStyles = {
  blue: { bg: 'bg-brand-blue/10', text: 'text-brand-blue', bar: 'bg-brand-blue' },
  green: { bg: 'bg-brand-green/10', text: 'text-brand-green', bar: 'bg-brand-green' },
  purple: { bg: 'bg-brand-purple/10', text: 'text-brand-purple', bar: 'bg-brand-purple' },
  orange: { bg: 'bg-brand-orange/10', text: 'text-brand-orange', bar: 'bg-brand-orange' },
  red: { bg: 'bg-brand-red/10', text: 'text-brand-red', bar: 'bg-brand-red' },
};

export default function KpiCard({ icon: Icon, label, value, sublabel, tone = 'blue' }) {
  const t = toneStyles[tone];
  return (
    <div className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm ring-1 ring-foreground/5 transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="p-5">
        <div
          className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-105 ${t.bg} ${t.text}`}
        >
          <Icon size={18} />
        </div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
        {sublabel && <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p>}
      </div>
      <div className={`h-1 w-full ${t.bar} opacity-70`} />
    </div>
  );
}

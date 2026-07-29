import { Wind } from 'lucide-react';

export default function ManufacturingComingSoon({ title }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-24 gap-4 text-muted-foreground">
      <div className="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center">
        <Wind size={26} className="text-violet-600" />
      </div>
      <p className="text-lg font-semibold text-foreground">{title}</p>
      <p className="text-sm">This page is coming soon — being built step by step.</p>
    </div>
  );
}

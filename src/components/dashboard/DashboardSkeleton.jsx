import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-80" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <Skeleton className="mb-4 h-10 w-10 rounded-xl" />
            <Skeleton className="mb-2 h-3 w-24" />
            <Skeleton className="mb-1 h-7 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <Skeleton className="h-96 flex-1 rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl lg:w-96" />
      </div>

      <Skeleton className="h-80 rounded-2xl" />
    </div>
  );
}

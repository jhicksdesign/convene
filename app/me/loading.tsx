import { Skeleton } from "@/components/common/skeleton";

export default function MeLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-28 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-3">
          <Skeleton className="h-7 w-44" />
          <div className="flex flex-wrap gap-2">
            {[120, 96, 140, 88].map((w, i) => (
              <Skeleton key={i} className="h-9 rounded-full" style={{ width: w }} />
            ))}
          </div>
        </div>
        <Skeleton className="h-40 rounded-xl lg:col-span-2" />
      </div>
    </div>
  );
}

import { Skeleton } from "@/components/common/skeleton";

export default function GroupsLoading() {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-6">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-5 w-32" />
            </div>
            <Skeleton className="mt-3 h-3 w-20" />
            <Skeleton className="mt-3 h-3 w-full" />
          </div>
        ))}
      </div>
    </section>
  );
}

import { Skeleton } from "@/components/common/skeleton";

/* Mirrors the calendar layout — filter chips, the segmented view switcher,
   the month title, and a 7-column grid — so the swap to live content lands
   without a jump. All blocks sweep in sync via the shared .skeleton class. */
export default function CalendarLoading() {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {[64, 88, 72, 96, 56, 80].map((w, i) => (
          <Skeleton key={i} className="h-6 rounded-full" style={{ width: w }} />
        ))}
      </div>
      <Skeleton className="h-9 w-48 rounded-lg" />
      <div className="space-y-3">
        <Skeleton className="h-7 w-44" />
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border bg-border">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={`h-${i}`} className="h-7 rounded-none" />
          ))}
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={`c-${i}`} className="min-h-28 rounded-none" />
          ))}
        </div>
      </div>
    </section>
  );
}

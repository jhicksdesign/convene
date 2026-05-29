import { Skeleton } from "@/components/common/skeleton";

/* Mirrors the group page: the full-bleed colored hero band, then the
   upcoming-events list. The hero uses the same negative margin + min-height
   as the real header so there's no shift. */
export default function GroupLoading() {
  return (
    <section className="space-y-6">
      <Skeleton className="-mx-4 -mt-6 min-h-36 rounded-none sm:min-h-44 md:rounded-b-2xl" />
      <div className="space-y-3">
        <Skeleton className="h-7 w-48" />
        <div className="overflow-hidden rounded-xl border bg-card">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`flex items-center gap-3 py-3 pl-5 pr-3 ${i > 0 ? "border-t border-border" : ""}`}>
              <Skeleton className="h-10 w-14 shrink-0 rounded" />
              <Skeleton className="h-4 w-28 shrink-0" />
              <Skeleton className="h-4 w-40" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

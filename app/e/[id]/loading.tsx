import { Skeleton } from "@/components/common/skeleton";

/* Mirrors the event-detail layout: the full-bleed poster hero, the meta
   block, and the body. The hero matches EventPoster's min-height + bleed so
   there's no jump when the real poster paints. */
export default function EventLoading() {
  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <Skeleton className="-mx-4 min-h-[19rem] rounded-none sm:mx-0 sm:min-h-[23rem] sm:rounded-2xl" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="flex gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
      <Skeleton className="h-24 w-full rounded-md" />
      <Skeleton className="h-10 w-56 rounded-md" />
    </section>
  );
}

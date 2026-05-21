export default function Loading() {
  return (
    <section className="animate-pulse space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-9 w-32 rounded bg-muted" />
        <div className="h-9 w-28 rounded bg-muted" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 rounded-xl border bg-card p-6">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-muted" />
              <div className="h-5 w-32 rounded bg-muted" />
            </div>
            <div className="mt-3 h-3 w-20 rounded bg-muted" />
            <div className="mt-3 h-3 w-full rounded bg-muted" />
          </div>
        ))}
      </div>
    </section>
  );
}

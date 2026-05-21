export default function Loading() {
  return (
    <section className="animate-pulse space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-6 w-20 rounded-full bg-muted" />
        ))}
      </div>
      <div className="h-9 w-64 rounded-md bg-muted" />
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border bg-border">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={`h-${i}`} className="h-7 bg-muted" />
        ))}
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={`c-${i}`} className="h-24 bg-background p-1">
            <div className="h-3 w-4 rounded bg-muted" />
          </div>
        ))}
      </div>
    </section>
  );
}

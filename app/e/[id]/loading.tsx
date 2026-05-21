export default function Loading() {
  return (
    <section className="mx-auto max-w-3xl animate-pulse space-y-6">
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="h-3 w-3 rounded-full bg-muted" />
          <div className="h-4 w-24 rounded bg-muted" />
        </div>
        <div className="h-9 w-3/4 rounded bg-muted" />
        <div className="h-4 w-1/2 rounded bg-muted" />
        <div className="h-4 w-1/3 rounded bg-muted" />
      </div>
      <div className="h-32 rounded-md bg-muted" />
      <div className="h-20 rounded-md bg-muted" />
    </section>
  );
}

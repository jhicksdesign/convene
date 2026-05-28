import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

// Renders when forbidden() is invoked anywhere in the app (e.g. an anonymous
// viewer hits an event whose scope isn't PUBLIC, or a member tries to load a
// VOUCHED event without enough vouches). Kept gentle — this isn't a corporate
// access wall, it's a community-membrane edge.
export default function Forbidden() {
  return (
    <section className="relative -mx-4 -my-6 flex min-h-[calc(100vh-3.5rem)] items-center justify-center overflow-hidden px-4 py-16">
      <div aria-hidden="true" className="hero-atmosphere pointer-events-none fixed inset-0 -z-10" />

      <div className="relative max-w-lg text-center">
        <p
          aria-hidden="true"
          className="font-display text-5xl leading-none text-muted-foreground/70"
          style={{ fontVariationSettings: '"opsz" 96, "SOFT" 80' }}
        >
          ✶
        </p>
        <h1
          className="mt-6 font-display text-5xl font-medium leading-[1.05] tracking-tight sm:text-6xl"
          style={{ fontVariationSettings: '"opsz" 120, "SOFT" 30' }}
        >
          Not yours to see
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
          This event or group isn’t public. If you’re part of the community that
          posted it, signing in might let you see it.
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
          <Link href="/login">
            <Button size="lg" className="gap-1.5">
              Sign in <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </Link>
          <Link href="/calendar">
            <Button size="lg" variant="outline">Back to the calendar</Button>
          </Link>
        </div>

        <p className="mt-6 font-mono text-xs text-muted-foreground">
          <Link href="/" className="transition-colors hover:text-foreground">
            Or wander Eventide from the start →
          </Link>
        </p>
      </div>
    </section>
  );
}

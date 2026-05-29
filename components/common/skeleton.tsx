import { cn } from "@/lib/utils";

/* A single shimmering placeholder block. Compose several to mirror the
   shape of the page that's loading. The `.skeleton` class (globals.css)
   carries the warm sweep + reduced-motion fallback. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton rounded-md", className)} {...props} />;
}

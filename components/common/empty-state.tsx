import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  icon: LucideIcon;
  title: string;
  description?: string;
  cta?: { label: string; href: string };
}

export function EmptyState({ icon: Icon, title, description, cta }: Props) {
  return (
    <div className="rounded-xl border border-dashed border-secondary bg-card/40 px-6 py-12 text-center">
      <div
        className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15"
        aria-hidden="true"
      >
        <Icon className="h-6 w-6" strokeWidth={1.5} />
      </div>
      <h3 className="font-display text-xl font-medium tracking-tight">{title}</h3>
      {description && (
        <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">{description}</p>
      )}
      {cta && (
        <Link href={cta.href} className="mt-5 inline-block">
          <Button size="sm">{cta.label}</Button>
        </Link>
      )}
    </div>
  );
}

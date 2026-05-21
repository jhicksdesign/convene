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
    <div className="rounded-md border border-dashed bg-muted/30 px-6 py-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-background text-muted-foreground">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-base font-medium">{title}</h3>
      {description && (
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      )}
      {cta && (
        <Link href={cta.href} className="mt-4 inline-block">
          <Button size="sm">{cta.label}</Button>
        </Link>
      )}
    </div>
  );
}

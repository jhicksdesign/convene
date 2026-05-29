import Link from "next/link";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";

interface Props {
  slug: string;
  name: string;
  color: string;
  description?: string | null;
  memberCount: number;
}

export function GroupCard({ slug, name, color, description, memberCount }: Props) {
  return (
    <Link href={`/g/${slug}`} className="group block h-full">
      <Card
        className="relative h-full overflow-hidden border-l-4 transition-all duration-150 group-hover:-translate-y-px"
        style={{ borderLeftColor: color }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
          style={{ background: `linear-gradient(110deg, ${color}10, transparent 60%)` }}
        />
        <CardHeader>
          <h3
            className="font-display text-xl font-medium leading-tight tracking-tight"
            style={{ fontVariationSettings: '"opsz" 36, "SOFT" 60' }}
          >
            {name}
          </h3>
          <CardDescription>
            {memberCount} member{memberCount === 1 ? "" : "s"}
          </CardDescription>
        </CardHeader>
        {description && (
          <CardContent className="text-sm text-muted-foreground">{description}</CardContent>
        )}
      </Card>
    </Link>
  );
}

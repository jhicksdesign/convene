import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface Props {
  slug: string;
  name: string;
  color: string;
  description?: string | null;
  memberCount: number;
}

export function GroupCard({ slug, name, color, description, memberCount }: Props) {
  return (
    <Link href={`/g/${slug}`} className="block transition-opacity hover:opacity-90">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
            <CardTitle>{name}</CardTitle>
          </div>
          <CardDescription>{memberCount} member{memberCount === 1 ? "" : "s"}</CardDescription>
        </CardHeader>
        {description && <CardContent className="text-sm text-muted-foreground">{description}</CardContent>}
      </Card>
    </Link>
  );
}

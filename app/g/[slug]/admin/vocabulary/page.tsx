import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-helpers";
import { VocabularyEditor } from "@/components/groups/vocabulary-editor";
import type { GroupEventDefaults } from "@/lib/schemas";

export default async function VocabularyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const group = await db.group.findUnique({
    where: { slug },
    select: { id: true, name: true, tagPalette: true, accessibilityPalette: true, eventDefaults: true },
  });
  if (!group) notFound();
  await requireAdmin(group.id);

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href={`/g/${slug}/admin`}
          className="text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
        >
          ← {group.name} · Admin
        </Link>
        <h1 className="mt-2 font-display text-3xl font-medium tracking-tight">
          Vocabulary & defaults
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Shape how event creation feels for admins in <strong>{group.name}</strong>: which tags you suggest, which
          accessibility flags apply, and what fields are pre-filled.
        </p>
      </div>

      <VocabularyEditor
        initial={{
          id: group.id,
          name: group.name,
          tagPalette: group.tagPalette,
          accessibilityPalette: group.accessibilityPalette,
          eventDefaults: (group.eventDefaults as GroupEventDefaults | null) ?? null,
        }}
      />
    </section>
  );
}

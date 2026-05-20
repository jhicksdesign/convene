import { requireUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { PrivacyForm } from "@/components/settings/privacy-form";

export default async function PrivacySettingsPage() {
  const me = await requireUser();
  const u = await db.user.findUnique({
    where: { id: me.id },
    select: {
      profileVisibility: true, attendanceVisibility: true, rsvpVisibility: true,
      searchable: true, showOnAttendeeLists: true,
    },
  });
  if (!u) return null;
  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Privacy</h1>
      <PrivacyForm initial={u} />
    </section>
  );
}

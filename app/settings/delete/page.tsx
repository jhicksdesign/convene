import { requireUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { hasRealEmail } from "@/lib/identity";
import { DeleteAccount } from "@/components/settings/delete-account";

export default async function DeleteAccountPage() {
  const me = await requireUser();
  const u = await db.user.findUnique({
    where: { id: me.id },
    select: { email: true, emailVerified: true, displayName: true },
  });
  if (!u) return null;

  const useEmail = hasRealEmail(u);
  const confirmValue = useEmail ? u.email : u.displayName;
  const label = useEmail ? "email" : "display name";

  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Delete account</h1>
      <p className="text-sm text-muted-foreground">
        Soft-deletes your account. You have 30 days to restore by emailing support before everything is permanently removed.
        Attendance history is kept (anonymized) for admin accuracy.
      </p>
      <DeleteAccount confirmValue={confirmValue} label={label} />
    </section>
  );
}

import Link from "next/link";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { requireUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { hasRealEmail, isPlaceholderEmail } from "@/lib/identity";
import { EmailForm } from "@/components/settings/email-form";

const ERROR_COPY: Record<string, string> = {
  invalid: "That link wasn't valid.",
  expired: "That link expired.",
  taken: "That email was claimed by another account.",
};

export default async function EmailSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const me = await requireUser();
  const u = await db.user.findUnique({
    where: { id: me.id },
    select: { email: true, emailVerified: true },
  });
  if (!u) return null;

  const { ok, error } = await searchParams;
  const verified = hasRealEmail(u);
  const isPlaceholder = isPlaceholderEmail(u.email);

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <Link href="/settings" className="text-sm text-muted-foreground hover:underline">← Settings</Link>
      <h1 className="text-2xl font-semibold tracking-tight">Email</h1>

      {ok && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>Email confirmed.</span>
        </div>
      )}
      {error && ERROR_COPY[error] && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{ERROR_COPY[error]}</span>
        </div>
      )}

      <div className="space-y-2 rounded-lg border bg-card p-4">
        <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Current</div>
        {verified ? (
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{u.email}</span>
          </div>
        ) : isPlaceholder ? (
          <p className="text-sm text-muted-foreground">No email on file.</p>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <span>{u.email} <span className="text-muted-foreground">— not yet confirmed</span></span>
          </div>
        )}
      </div>

      <EmailForm currentEmail={verified ? u.email : null} />
    </section>
  );
}

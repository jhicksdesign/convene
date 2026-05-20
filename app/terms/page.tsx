export default function TermsPage() {
  return (
    <section className="mx-auto max-w-2xl space-y-6 py-6 text-sm leading-relaxed">
      <h1 className="text-2xl font-semibold tracking-tight">Terms & data commitments</h1>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">What you agree to</h2>
        <p>
          You'll use Convene in good faith: don't impersonate others, don't post content
          that endangers community members, don't try to abuse rate limits or the LLM
          features, and don't try to discover information about other users beyond what
          the visibility settings expose.
        </p>
        <p>
          Admins of a group are trusted with safety information about that group's
          members. Admin notes and incident reports are protected — sharing them outside
          their intended audience is grounds for losing admin status.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">What we collect</h2>
        <p>
          Your email (for sign-in), profile fields you supply, RSVPs you submit, vouches
          and friendships you create, and audit trails for incident reports. We use
          aggregate attendance to power conflict-warning overlap statistics. We never
          sell or share data with third parties beyond the providers needed to run the
          app (listed in the README).
        </p>
        <p>
          You can export everything we hold about you any time at{" "}
          <a className="underline" href="/settings/export">/settings/export</a>, and you
          can soft-delete your account (with a 30-day grace period before permanent
          deletion) at{" "}
          <a className="underline" href="/settings/delete">/settings/delete</a>.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Shutdown commitments</h2>
        <p>
          If the operator chooses to shut Convene down, we commit to:
        </p>
        <ul className="list-disc pl-6">
          <li>60-day advance notice posted in-app and to all admins.</li>
          <li>Every admin receives a full data export of their groups (members, events, notes).</li>
          <li>Every user receives a personal data export.</li>
          <li>The source code is open under AGPL-3.0 so any community can self-host immediately.</li>
        </ul>
        <p className="text-muted-foreground">
          This commitment is binding on the operator and travels with the instance.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">License</h2>
        <p>
          Convene is licensed under the GNU AGPL-3.0. Forking is fine; closed-source
          SaaS forks are not.
        </p>
      </section>
    </section>
  );
}

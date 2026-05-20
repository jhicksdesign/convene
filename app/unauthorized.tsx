import Link from "next/link";

export default function Unauthorized() {
  return (
    <section className="mx-auto max-w-md py-20 text-center">
      <h1 className="text-2xl font-semibold">Sign in to continue</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        <Link href="/login" className="underline">Send me a magic link</Link>
      </p>
    </section>
  );
}

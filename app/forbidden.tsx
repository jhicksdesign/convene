import Link from "next/link";

export default function Forbidden() {
  return (
    <section className="mx-auto max-w-md py-20 text-center">
      <h1 className="text-2xl font-semibold">You don't have access</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        That content is restricted. <Link href="/" className="underline">Back to home.</Link>
      </p>
    </section>
  );
}

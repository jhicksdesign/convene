import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-md py-20 text-center">
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        That page doesn't exist. <Link href="/" className="underline">Back to the start.</Link>
      </p>
    </section>
  );
}

import { Button } from "@/components/ui/button";
import { exportUserData } from "@/app/_actions/account";

async function exportAction() {
  "use server";
  const data = await exportUserData();
  // Server actions can't stream a download; just persist and return JSON inline as a separate route is overkill for v1.
  // We expose the JSON in the action result; the form below uses target=_blank to a route below.
  return data;
}

export default function ExportPage() {
  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Export your data</h1>
      <p className="text-sm text-muted-foreground">
        Download a JSON file with everything we hold about you — profile, RSVPs, vouches, notes others have written about you, and reports you've filed.
      </p>
      <a href="/api/me/export" target="_blank" rel="noopener noreferrer">
        <Button>Download JSON</Button>
      </a>
    </section>
  );
}

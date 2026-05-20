import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { softDeleteAccount } from "@/app/_actions/account";

async function deleteAction() {
  "use server";
  await softDeleteAccount();
  redirect("/");
}

export default function DeleteAccountPage() {
  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Delete account</h1>
      <p className="text-sm text-muted-foreground">
        Soft-deletes your account. You have 30 days to restore by emailing support before everything is permanently removed.
        Attendance history is kept (anonymized) for admin accuracy.
      </p>
      <form action={deleteAction}>
        <Button type="submit" variant="destructive">Delete my account</Button>
      </form>
    </section>
  );
}

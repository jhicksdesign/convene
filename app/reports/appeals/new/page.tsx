import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { fileAppeal } from "@/app/_actions/appeals";

async function submitAction(formData: FormData) {
  "use server";
  const r = await fileAppeal(
    formData.get("originalAction") as string,
    formData.get("userStatement") as string,
    (formData.get("reportId") as string) || undefined,
  );
  redirect(`/reports/appeals/${r.id}`);
}

export default async function NewAppealPage({ searchParams }: { searchParams: Promise<{ action?: string; report?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Request review</h1>
      <p className="text-sm text-muted-foreground">
        Tell us what happened and why you think the action should be reconsidered. An admin who didn't take the original action will respond.
      </p>
      <form action={submitAction} className="space-y-3">
        <input type="hidden" name="reportId" value={sp.report ?? ""} />
        <div>
          <Label htmlFor="originalAction">What was the action?</Label>
          <Input id="originalAction" name="originalAction" required defaultValue={sp.action ?? ""} />
        </div>
        <div>
          <Label htmlFor="userStatement">Your statement</Label>
          <Textarea id="userStatement" name="userStatement" rows={6} required />
        </div>
        <Button type="submit">Submit appeal</Button>
      </form>
    </section>
  );
}

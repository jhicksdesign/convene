import { requireUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { rotateICalToken, revokeICalToken } from "@/app/_actions/account";

async function rotate() { "use server"; await rotateICalToken(); }
async function revoke() { "use server"; await revokeICalToken(); }

export default async function CalendarFeedsPage() {
  const me = await requireUser();
  const u = await db.user.findUnique({ where: { id: me.id }, select: { iCalToken: true } });
  const base = process.env.AUTH_URL ?? "";

  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Calendar feeds</h1>
      <p className="text-sm text-muted-foreground">
        Subscribe to your personalized iCal feed from any calendar app.
        Rotate the token if it leaks; the old URL stops working immediately.
      </p>
      {u?.iCalToken ? (
        <>
          <code className="block break-all rounded-md bg-muted p-3 text-xs">{base}/api/ical/user/{u.iCalToken}</code>
          <div className="flex gap-2">
            <form action={rotate}><Button type="submit" variant="outline">Rotate token</Button></form>
            <form action={revoke}><Button type="submit" variant="outline">Revoke</Button></form>
          </div>
        </>
      ) : (
        <form action={rotate}><Button type="submit">Generate feed token</Button></form>
      )}
    </section>
  );
}

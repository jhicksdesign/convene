import Link from "next/link";
import { requireUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { acceptFriend, declineFriend, removeFriend } from "@/app/_actions/friends";

async function acceptAction(formData: FormData) {
  "use server";
  await acceptFriend(formData.get("id") as string);
}
async function declineAction(formData: FormData) {
  "use server";
  await declineFriend(formData.get("id") as string);
}
async function removeAction(formData: FormData) {
  "use server";
  await removeFriend(formData.get("id") as string);
}

export default async function FriendsPage() {
  const me = await requireUser();

  const friendships = await db.friendship.findMany({
    where: { OR: [{ userAId: me.id }, { userBId: me.id }] },
    include: {
      userA: { select: { id: true, displayName: true, avatarUrl: true } },
      userB: { select: { id: true, displayName: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const other = (f: typeof friendships[number]) => (f.userAId === me.id ? f.userB : f.userA);

  const accepted = friendships.filter((f) => f.status === "ACCEPTED");
  const incoming = friendships.filter((f) => f.status === "PENDING" && f.initiatorId !== me.id);
  const outgoing = friendships.filter((f) => f.status === "PENDING" && f.initiatorId === me.id);

  return (
    <section className="mx-auto max-w-2xl space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Friends</h1>

      <div>
        <h2 className="text-lg font-semibold">Incoming requests ({incoming.length})</h2>
        <ul className="mt-2 divide-y rounded-md border">
          {incoming.length === 0 && <li className="p-3 text-sm text-muted-foreground">None.</li>}
          {incoming.map((f) => (
            <li key={f.id} className="flex items-center justify-between p-3 text-sm">
              <Link href={`/u/${other(f).id}`} className="hover:underline">{other(f).displayName}</Link>
              <div className="flex gap-2">
                <form action={acceptAction}>
                  <input type="hidden" name="id" value={other(f).id} />
                  <Button size="sm" type="submit">Accept</Button>
                </form>
                <form action={declineAction}>
                  <input type="hidden" name="id" value={other(f).id} />
                  <Button size="sm" variant="outline" type="submit">Decline</Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="text-lg font-semibold">Friends ({accepted.length})</h2>
        <ul className="mt-2 divide-y rounded-md border">
          {accepted.length === 0 && <li className="p-3 text-sm text-muted-foreground">None yet.</li>}
          {accepted.map((f) => (
            <li key={f.id} className="flex items-center justify-between p-3 text-sm">
              <Link href={`/u/${other(f).id}`} className="hover:underline">{other(f).displayName}</Link>
              <form action={removeAction}>
                <input type="hidden" name="id" value={other(f).id} />
                <Button size="sm" variant="outline" type="submit">Remove</Button>
              </form>
            </li>
          ))}
        </ul>
      </div>

      {outgoing.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold">Sent requests</h2>
          <ul className="mt-2 divide-y rounded-md border">
            {outgoing.map((f) => (
              <li key={f.id} className="p-3 text-sm text-muted-foreground">
                {other(f).displayName} — awaiting response
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

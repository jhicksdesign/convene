import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";

export default async function MePage() {
  const user = await requireUser();
  redirect(`/u/${user.id}`);
}

// Canonical auth gates. Every server action / route handler / page that needs
// "is logged in" or "is admin of group X" goes through here. Do not re-implement.
import { redirect } from "next/navigation";
import { forbidden, unauthorized } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Role, User } from "@prisma/client";

export type AuthedUser = Pick<
  User,
  "id" | "email" | "displayName" | "avatarUrl" | "timezone" | "deletedAt"
>;

export async function getCurrentUser(): Promise<AuthedUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, displayName: true, avatarUrl: true, timezone: true, deletedAt: true },
  });
  if (!user || user.deletedAt) return null;
  return user;
}

export async function requireUser(): Promise<AuthedUser> {
  const u = await getCurrentUser();
  if (!u) {
    // Page calls: navigate to login. Server actions / API: throw.
    if (typeof unauthorized === "function") unauthorized();
    redirect("/login");
  }
  return u!;
}

export async function isAdminOf(userId: string, groupId: string): Promise<boolean> {
  const m = await db.membership.findUnique({
    where: { userId_groupId: { userId, groupId } },
    select: { role: true },
  });
  return m?.role === "ADMIN";
}

export async function requireAdmin(groupId: string): Promise<AuthedUser> {
  const u = await requireUser();
  if (!(await isAdminOf(u.id, groupId))) forbidden();
  return u;
}

export async function isMemberOf(userId: string, groupId: string): Promise<boolean> {
  const m = await db.membership.findUnique({
    where: { userId_groupId: { userId, groupId } },
    select: { role: true },
  });
  return !!m;
}

export async function requireMember(groupId: string): Promise<AuthedUser> {
  const u = await requireUser();
  if (!(await isMemberOf(u.id, groupId))) forbidden();
  return u;
}

/** Returns admin role membership ids the user holds, for sidebar / dashboards. */
export async function adminGroupIds(userId: string): Promise<string[]> {
  const rows = await db.membership.findMany({
    where: { userId, role: "ADMIN" satisfies Role },
    select: { groupId: true },
  });
  return rows.map((r) => r.groupId);
}

// Canonical transaction helpers.
// All multi-step writes that touch contended rows (Event capacity, Group admin
// count, SoftClaim ≤2 limit, etc.) go through `withRowLock` so we serialize
// against concurrent callers.
//
// Postgres-only — uses `SELECT ... FOR UPDATE` which Prisma exposes via $queryRaw.
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * Run `fn` inside a transaction after acquiring a row-level write lock on the
 * given table/id pair. The lock is released when the transaction commits or
 * rolls back. Callers should keep the body short.
 *
 * Table names below must match Prisma's pluralized SQL names (we use the
 * @@map / @@id Prisma defaults which are unquoted PascalCase).
 */
export async function withRowLock<T>(
  table: "Event" | "Group" | "User" | "SoftClaim",
  id: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$queryRawUnsafe(`SELECT 1 FROM "${table}" WHERE id = $1 FOR UPDATE`, id);
    return fn(tx);
  });
}

/**
 * Lock a synthetic key — used when there is no single row to lock but we still
 * need serialization (e.g. soft-claim count per group). Backed by a Postgres
 * advisory lock so we don't need a real table.
 */
export async function withAdvisoryLock<T>(key: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  // Hash the key to a bigint (advisory locks take an int8).
  let hash = 0n;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 1099511628211n) ^ BigInt(key.charCodeAt(i));
  }
  // Truncate to a signed 64-bit range.
  const lockId = (hash % 9223372036854775783n) - 9223372036854775783n / 2n;
  return db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock($1)`, lockId);
    return fn(tx);
  });
}

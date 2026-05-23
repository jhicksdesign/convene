// Seed convention calendar (PRD §6.7).
//
// Convene is multi-tenant. The original repo seeded a global furry-convention
// calendar, but for a generic instance there's no universal set of "conventions
// every community cares about" — book-club admins don't need Anthrocon dates.
//
// New posture:
//   - No global conventions by default.
//   - Group admins add their own at /g/<slug>/admin/vocabulary (per-group scope
//     via Convention.groupId).
//   - This script remains as a hook for instance admins who want to seed their
//     own global list — add entries to the `conventions` array below.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

interface SeedConvention {
  name: string;
  startDate: string;
  endDate: string;
  location: string;
  url?: string | null;
  /** null = global (visible to every group). Set to a specific Group.id to scope. */
  groupId?: string | null;
}

const conventions: SeedConvention[] = [
  // Add seed entries here for your instance if desired. Example shape:
  // { name: "City Library Book Fair", startDate: "2026-06-12", endDate: "2026-06-14", location: "Downtown", url: null, groupId: null },
];

async function main() {
  for (const c of conventions) {
    const id = c.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
    await db.convention.upsert({
      where: { id },
      update: {
        startDate: new Date(c.startDate),
        endDate: new Date(c.endDate),
        location: c.location,
        url: c.url ?? null,
        groupId: c.groupId ?? null,
      },
      create: {
        id,
        name: c.name,
        startDate: new Date(c.startDate),
        endDate: new Date(c.endDate),
        location: c.location,
        url: c.url ?? null,
        groupId: c.groupId ?? null,
      },
    });
  }
  console.log(`Seeded ${conventions.length} conventions.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

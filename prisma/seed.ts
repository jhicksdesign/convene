// Seed the convention calendar (PRD §6.7).
// Refreshed manually. Run: npm run prisma:seed
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const conventions = [
  { name: "Anthrocon", startDate: "2026-07-02", endDate: "2026-07-05", location: "Pittsburgh, PA", url: "https://www.anthrocon.org" },
  { name: "Midwest FurFest (MFF)", startDate: "2026-12-03", endDate: "2026-12-06", location: "Rosemont, IL", url: "https://www.furfest.org" },
  { name: "Furry Weekend Atlanta (FWA)", startDate: "2026-04-02", endDate: "2026-04-05", location: "Atlanta, GA", url: "https://www.furryweekend.com" },
  { name: "Texas Furry Fiesta (TFF)", startDate: "2026-03-19", endDate: "2026-03-22", location: "Dallas, TX", url: "https://texasfurryfiesta.org" },
  { name: "Further Confusion", startDate: "2026-01-22", endDate: "2026-01-26", location: "San Jose, CA", url: "https://www.furtherconfusion.org" },
  { name: "DenFur", startDate: "2026-08-28", endDate: "2026-08-30", location: "Denver, CO", url: "https://denfur.org" },
  { name: "Fur Squared", startDate: "2026-02-13", endDate: "2026-02-15", location: "Itasca, IL", url: "https://www.fursquared.com" },
  { name: "BLFC (Biggest Little Fur Con)", startDate: "2026-05-21", endDate: "2026-05-25", location: "Reno, NV", url: "https://www.blfc.org" },
  { name: "Rocky Mountain Fur Con", startDate: "2026-09-04", endDate: "2026-09-07", location: "Denver, CO", url: null },
  { name: "Califur", startDate: "2026-06-12", endDate: "2026-06-14", location: "Pomona, CA", url: null },
];

async function main() {
  for (const c of conventions) {
    await db.convention.upsert({
      where: { id: c.name.toLowerCase().replace(/[^a-z0-9]/g, "-") },
      update: {
        startDate: new Date(c.startDate),
        endDate: new Date(c.endDate),
        location: c.location,
        url: c.url ?? null,
      },
      create: {
        id: c.name.toLowerCase().replace(/[^a-z0-9]/g, "-"),
        name: c.name,
        startDate: new Date(c.startDate),
        endDate: new Date(c.endDate),
        location: c.location,
        url: c.url ?? null,
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

// Helper for event-creation surfaces: fetches the groups a user can host
// events for, including each group's curated vocabulary so the EventForm
// can render group-specific tag suggestions, accessibility flags, and
// pre-filled defaults.
import { db } from "@/lib/db";
import type { OwnableGroup } from "@/components/events/event-form";
import type { GroupEventDefaults } from "@/lib/schemas";

export async function loadOwnableGroups(adminUserId: string): Promise<OwnableGroup[]> {
  const rows = await db.group.findMany({
    where: { memberships: { some: { userId: adminUserId, role: "ADMIN" } } },
    select: { id: true, name: true, tagPalette: true, accessibilityPalette: true, eventDefaults: true },
  });
  return rows.map((g) => ({
    id: g.id,
    name: g.name,
    tagPalette: g.tagPalette,
    accessibilityPalette: g.accessibilityPalette,
    eventDefaults: (g.eventDefaults as GroupEventDefaults | null) ?? null,
  }));
}

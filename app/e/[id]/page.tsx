import { notFound, forbidden } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canSeeEvent } from "@/lib/visibility";
import { RSVPButton } from "@/components/events/rsvp-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AnnouncementGenerator } from "@/components/events/announcement-generator";
import { goingCount } from "@/lib/waitlist";
import { RealtimeSubscribe } from "@/components/realtime/subscribe";
import { CarpoolPanel } from "@/components/events/carpool-panel";
import { TravelEstimate } from "@/components/events/travel-estimate";
import { InstanceList } from "@/components/events/instance-list";
import { expand } from "@/lib/recurrence";
import { addMonths } from "date-fns";
import { VenueNotesEditor } from "@/components/events/venue-notes-editor";
import { VenueAddress } from "@/components/events/venue-address";
import { SimilarEvents } from "@/components/events/similar-events";

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await db.event.findUnique({
    where: { id },
    include: {
      owningGroup: { select: { id: true, name: true, color: true, slug: true } },
      location: true,
      coHosts: { include: { group: { select: { id: true, name: true, slug: true } } } },
    },
  });
  if (!event) notFound();

  const me = await getCurrentUser();
  const visible = await canSeeEvent(me?.id ?? null, event);
  if (!visible) forbidden();

  const myRsvp = me ? await db.rSVP.findUnique({ where: { userId_eventId: { userId: me.id, eventId: id } } }) : null;
  const going = await goingCount(id);

  // §12.4 — venue notes are editable by admins of any group that has hosted at this address.
  const canEditVenue = me && event.locationId
    ? !!(await db.event.findFirst({
        where: {
          locationId: event.locationId,
          owningGroup: { memberships: { some: { userId: me.id, role: "ADMIN" } } },
        },
        select: { id: true },
      }))
    : false;

  // §9.2 — aggregate conditional display ("8 will go if 5 others do")
  const conditionalAgg = await db.rSVP.aggregate({
    where: { eventId: id, status: "CONDITIONAL", conditionalMinAttendees: { not: null } },
    _count: { _all: true },
    _min: { conditionalMinAttendees: true },
  });
  const conditionalSummary =
    conditionalAgg._count._all > 0 && conditionalAgg._min.conditionalMinAttendees != null
      ? `${conditionalAgg._count._all} ${conditionalAgg._count._all === 1 ? "person" : "people"} will go if at least ${conditionalAgg._min.conditionalMinAttendees} others commit.`
      : null;

  const [carpoolOffers, carpoolRequests] = await Promise.all([
    db.carpoolOffer.findMany({
      where: { eventId: id },
      include: { user: { select: { id: true, displayName: true } } },
      orderBy: { departureTime: "asc" },
    }),
    db.carpoolRequest.findMany({
      where: { eventId: id },
      include: { user: { select: { id: true, displayName: true } } },
      orderBy: { preferredDepartureTime: "asc" },
    }),
  ]);
  const isAdmin = me
    ? !!(await db.membership.findFirst({
        where: { userId: me.id, role: "ADMIN", groupId: { in: [event.owningGroupId, ...event.coHosts.map((c) => c.groupId)] } },
      }))
    : false;

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <RealtimeSubscribe channels={[`event:${event.id}`, `group:${event.owningGroupId}`]} />
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: event.owningGroup.color }} />
          <Link href={`/g/${event.owningGroup.slug}`} className="text-sm text-muted-foreground hover:underline">
            {event.owningGroup.name}
          </Link>
          {event.coHosts.map((c) => (
            <Link key={c.groupId} href={`/g/${c.group.slug}`} className="text-xs text-muted-foreground hover:underline">
              + {c.group.name}
            </Link>
          ))}
          {event.status !== "CONFIRMED" && (
            <Badge variant={event.status === "CANCELLED" ? "destructive" : "secondary"}>
              {event.status.toLowerCase()}
            </Badge>
          )}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">{event.title}</h1>
        <p className="text-sm text-muted-foreground">
          {format(event.startsAt, "EEEE MMM d, yyyy")} · {format(event.startsAt, "p")} – {format(event.endsAt, "p")}
        </p>
        {event.location && (
          <>
            <VenueAddress address={event.location.address} venueName={event.location.venueName} />
            {me && <TravelEstimate eventId={event.id} />}
            {canEditVenue ? (
              <VenueNotesEditor locationId={event.location.id} initialNotes={event.location.venueNotes} />
            ) : event.location.venueNotes ? (
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{event.location.venueNotes}</p>
            ) : null}
          </>
        )}
        {event.cost && <p className="text-sm">Cost: {event.cost}</p>}
        {event.capacity && (
          <p className="text-sm">{going} / {event.capacity} confirmed</p>
        )}
        {conditionalSummary && (
          <p className="text-sm text-muted-foreground">{conditionalSummary}</p>
        )}
        {event.accessibilityFlags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {event.accessibilityFlags.map((f) => <Badge key={f} variant="outline">{f.replace(/_/g, " ")}</Badge>)}
          </div>
        )}
      </header>

      {event.description && (
        <article className="prose prose-sm max-w-none whitespace-pre-wrap">{event.description}</article>
      )}

      {me && event.status !== "CANCELLED" && (
        <CarpoolPanel
          eventId={event.id}
          currentUserId={me.id}
          offers={carpoolOffers.map((o) => ({
            id: o.id,
            userId: o.user.id,
            pickupArea: o.pickupArea,
            seatsAvailable: o.seatsAvailable,
            departureTime: o.departureTime.toISOString(),
            userDisplayName: o.user.displayName,
          }))}
          requests={carpoolRequests.map((r) => ({
            id: r.id,
            userId: r.user.id,
            pickupArea: r.pickupArea,
            preferredDepartureTime: r.preferredDepartureTime.toISOString(),
            userDisplayName: r.user.displayName,
          }))}
        />
      )}

      {me && event.status !== "CANCELLED" && (
        <div>
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">Your RSVP</h2>
          <RSVPButton
            eventId={event.id}
            initialStatus={myRsvp?.status as "GOING" | "INTERESTED" | "MAYBE" | "NOT_GOING" | "CONDITIONAL" | "WAITLIST" | undefined}
            initialPlusOnes={myRsvp?.plusOneCount}
            allowPlusOnes={event.allowPlusOnes}
            initialPosition={myRsvp?.waitlistPosition ?? null}
          />
        </div>
      )}

      <SimilarEvents eventId={event.id} />

      {isAdmin && (
        <div className="space-y-3 rounded-md border bg-muted/40 p-4">
          <h2 className="text-lg font-semibold">Admin tools</h2>
          <div className="flex flex-wrap gap-2">
            <Link href={`/e/${event.id}/edit`}><Button variant="outline" size="sm">Edit event</Button></Link>
            <Link href={`/e/${event.id}/admin`}><Button variant="outline" size="sm">Attendees</Button></Link>
            <Link href={`/e/new?dup=${event.id}`}><Button variant="outline" size="sm">Duplicate</Button></Link>
          </div>
          {event.rrule && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Upcoming occurrences</h3>
              <InstanceList
                parentEventId={event.id}
                instances={expand(event, new Date(), addMonths(new Date(), 3))
                  .slice(0, 12)
                  .map((i) => ({ startsAt: i.startsAt.toISOString(), endsAt: i.endsAt.toISOString() }))}
              />
            </div>
          )}
          <AnnouncementGenerator eventId={event.id} />
        </div>
      )}
    </section>
  );
}

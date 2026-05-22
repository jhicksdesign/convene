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
import { LocationDisplay } from "@/components/events/location-display";
import { SimilarEvents } from "@/components/events/similar-events";
import { exposedLocation } from "@/lib/event-location";

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await db.event.findUnique({
    where: { id },
    include: {
      owningGroup: { select: { id: true, name: true, color: true, slug: true } },
      location: true,
      coHosts: { include: { group: { select: { id: true, name: true, slug: true, color: true } } } },
    },
  });
  if (!event) notFound();

  const me = await getCurrentUser();
  const visible = await canSeeEvent(me?.id ?? null, event);
  if (!visible) forbidden();

  const myRsvp = me ? await db.rSVP.findUnique({ where: { userId_eventId: { userId: me.id, eventId: id } } }) : null;
  const going = await goingCount(id);

  const canEditVenue = me && event.locationId
    ? !!(await db.event.findFirst({
        where: {
          locationId: event.locationId,
          owningGroup: { memberships: { some: { userId: me.id, role: "ADMIN" } } },
        },
        select: { id: true },
      }))
    : false;

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

  // §12.1 — resolve what location data to actually show this viewer.
  // Admins of the owning or co-hosting group always see the exact address;
  // RSVP_CONFIRMED gates on the viewer's RSVP status; DAY_OF gates on time.
  const exposed = exposedLocation(
    {
      startsAt: event.startsAt,
      locationVisibility: event.locationVisibility,
      locationGeneralArea: event.locationGeneralArea,
      location: event.location,
    },
    { viewerRsvp: myRsvp?.status ?? null, isAdmin },
  );

  return (
    <section className="relative mx-auto max-w-3xl space-y-6">
      <RealtimeSubscribe channels={[`event:${event.id}`, `group:${event.owningGroupId}`]} />

      {/* Group-color wash behind the header. Identifies the owning group
          at a glance without overpowering the title or copy. */}
      <header
        className="relative -mx-4 overflow-hidden border-t-[3px] px-4 pb-2 pt-6 sm:rounded-b-2xl sm:px-6"
        style={{ borderTopColor: event.owningGroup.color }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-40"
          style={{ background: `linear-gradient(180deg, ${event.owningGroup.color}26 0%, transparent 100%)` }}
        />
        <div className="relative space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/g/${event.owningGroup.slug}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
              style={{ color: event.owningGroup.color }}
            >
              <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: event.owningGroup.color }} />
              {event.owningGroup.name}
            </Link>
            {event.coHosts.map((c) => (
              <Link
                key={c.groupId}
                href={`/g/${c.group.slug}`}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:underline"
              >
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c.group.color }} />
                + {c.group.name}
              </Link>
            ))}
            {event.status !== "CONFIRMED" && (
              <Badge variant={event.status === "CANCELLED" ? "destructive" : "secondary"}>
                {event.status.toLowerCase()}
              </Badge>
            )}
          </div>
          <h1
            className="font-display text-3xl font-medium leading-tight tracking-tight sm:text-4xl"
            style={{ fontVariationSettings: '"opsz" 96, "SOFT" 35' }}
          >
            {event.title}
          </h1>
          <p className="font-mono text-sm tabular-nums text-muted-foreground">
            {format(event.startsAt, "EEEE, MMMM d, yyyy")}
            <span className="ml-2 text-foreground/85">
              {format(event.startsAt, "p")} – {format(event.endsAt, "p")}
            </span>
          </p>
          {exposed.kind !== "none" || exposed.generalArea ? (
            <div className="space-y-2">
              {exposed.kind === "pin" && (
                <LocationDisplay
                  kind="pin"
                  address={exposed.address}
                  venueName={exposed.venueName}
                  lat={exposed.lat}
                  lng={exposed.lng}
                  ownerColor={event.owningGroup.color}
                />
              )}
              {exposed.kind === "area" && (
                <LocationDisplay
                  kind="area"
                  lat={exposed.lat}
                  lng={exposed.lng}
                  radius={exposed.radius}
                  venueName={exposed.venueName}
                  ownerColor={event.owningGroup.color}
                />
              )}
              {exposed.kind === "hidden" && (
                <LocationDisplay
                  kind="hidden"
                  generalArea={exposed.generalArea}
                  revealsAt={exposed.revealsAt}
                  reason={exposed.reason}
                />
              )}
              {exposed.kind === "none" && exposed.generalArea && (
                <LocationDisplay kind="none" generalArea={exposed.generalArea} />
              )}
              {/* Travel estimate only makes sense once the exact location is visible. */}
              {me && (exposed.kind === "pin" || exposed.kind === "area") && (
                <TravelEstimate eventId={event.id} />
              )}
              {/* Venue notes — shown only when the exact location is exposed. */}
              {event.location && (exposed.kind === "pin" || exposed.kind === "area") && (
                canEditVenue ? (
                  <VenueNotesEditor locationId={event.location.id} initialNotes={event.location.venueNotes} />
                ) : event.location.venueNotes ? (
                  <p className="whitespace-pre-wrap text-xs text-muted-foreground">{event.location.venueNotes}</p>
                ) : null
              )}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {event.cost && (
              <p>
                <span className="text-muted-foreground">Cost · </span>
                <span className="font-medium">{event.cost}</span>
              </p>
            )}
            {event.capacity && (
              <p>
                <span className="font-mono font-semibold tabular-nums">{going}</span>
                <span className="text-muted-foreground"> / </span>
                <span className="font-mono tabular-nums">{event.capacity}</span>
                <span className="ml-1 text-muted-foreground">confirmed</span>
              </p>
            )}
          </div>
          {conditionalSummary && (
            <p className="text-sm text-muted-foreground">{conditionalSummary}</p>
          )}
          {event.accessibilityFlags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {event.accessibilityFlags.map((f) => <Badge key={f} variant="outline">{f.replace(/_/g, " ")}</Badge>)}
            </div>
          )}
        </div>
      </header>

      {event.description && (
        <article className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground/90">{event.description}</article>
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
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Your RSVP</h2>
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
        <div
          className="space-y-3 rounded-xl border bg-card p-4"
          style={{ boxShadow: "var(--shadow-paper)" }}
        >
          <h2 className="font-display text-lg font-medium tracking-tight">Admin tools</h2>
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

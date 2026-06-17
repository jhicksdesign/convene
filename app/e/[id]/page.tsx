import { notFound, forbidden } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
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
import { EventPoster } from "@/components/events/event-poster";
import { Reveal } from "@/components/common/reveal";
import { exposedLocation } from "@/lib/event-location";
import { EventDiscussion } from "@/components/events/event-discussion";
import { fetchCommentPage } from "@/lib/comments";
import { PersonalConflictBanner } from "@/components/events/personal-conflict-banner";
import { personalBusyConflicts } from "@/lib/personal-conflicts";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const event = await db.event.findUnique({
    where: { id },
    select: {
      title: true,
      description: true,
      startsAt: true,
      scope: true,
      flyerImageUrl: true,
      owningGroup: { select: { name: true } },
    },
  });
  // Only PUBLIC events get rich link previews. Anything narrower would leak
  // titles/descriptions of events the viewer isn't entitled to see.
  if (!event || event.scope !== "PUBLIC") {
    return { title: "Eventide", description: "Community calendar." };
  }
  const when = format(event.startsAt, "EEE MMM d, p");
  const title = `${event.title} · ${event.owningGroup.name}`;
  const description = event.description?.slice(0, 200) ?? `${when} — hosted by ${event.owningGroup.name}.`;
  const images = event.flyerImageUrl ? [{ url: event.flyerImageUrl }] : undefined;
  return {
    title,
    description,
    openGraph: { title, description, type: "website", images },
    twitter: { card: event.flyerImageUrl ? "summary_large_image" : "summary", title, description, images: event.flyerImageUrl ? [event.flyerImageUrl] : undefined },
  };
}

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

  // Discussion thread — visible to anyone who can see the event. The page
  // shows the latest page; the client pages backwards. We also load the
  // viewer's read marker to render the "new since last visit" divider.
  const [thread, threadRead] = me
    ? await Promise.all([
        fetchCommentPage(id, me.id, {}),
        db.eventThreadRead.findUnique({
          where: { userId_eventId: { userId: me.id, eventId: id } },
          select: { lastReadAt: true },
        }),
      ])
    : [{ comments: [], hasMore: false }, null];

  // Personal-calendar clash — does this event overlap something the viewer
  // already has on a subscribed Google/Apple calendar? (External-calendar import.)
  const personalConflicts = me
    ? (await personalBusyConflicts(me.id, event.startsAt, event.endsAt)).map((c) => ({
        title: c.title,
        startsAt: c.startsAt.toISOString(),
        endsAt: c.endsAt.toISOString(),
        calendarLabel: c.calendarLabel,
      }))
    : [];

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

      <EventPoster
        flyerImageUrl={event.flyerImageUrl}
        title={event.title}
        group={event.owningGroup}
        coHosts={event.coHosts.map((c) => c.group)}
        dateText={format(event.startsAt, "EEEE, MMMM d, yyyy")}
        timeText={`${format(event.startsAt, "p")} – ${format(event.endsAt, "p")}`}
        statusLabel={event.status !== "CONFIRMED" ? event.status.toLowerCase() : null}
        statusTone={event.status === "CANCELLED" ? "cancelled" : "tentative"}
      />

      <Reveal className="space-y-3" delay={0.05}>
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
      </Reveal>

      {event.description && (
        <Reveal as="article" delay={0.1} className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground/90">{event.description}</Reveal>
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

      {me && personalConflicts.length > 0 && event.status !== "CANCELLED" && (
        <PersonalConflictBanner conflicts={personalConflicts} />
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

      {!me && event.status !== "CANCELLED" && (
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            <Link
              href={`/login?callbackUrl=${encodeURIComponent(`/e/${event.id}`)}`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Sign in
            </Link>{" "}
            to RSVP.
          </p>
        </div>
      )}

      {me && (
        <EventDiscussion
          eventId={event.id}
          currentUserId={me.id}
          canModerate={isAdmin}
          comments={thread.comments}
          hasMore={thread.hasMore}
          lastReadAt={threadRead?.lastReadAt.toISOString() ?? null}
        />
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

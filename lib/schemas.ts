// Shared Zod schemas. Form components and server actions both validate from here
// so a field added to the schema lights up everywhere consistently.
import { z } from "zod";

export const visibility = z.enum(["PUBLIC", "MEMBERS", "GROUP", "FRIENDS", "PRIVATE"]);
export const eventScope = z.enum(["PUBLIC", "MEMBERS", "VOUCHED", "INVITE"]);
export const eventStatus = z.enum(["TENTATIVE", "CONFIRMED", "CANCELLED"]);
export const rsvpStatus = z.enum(["GOING", "INTERESTED", "MAYBE", "NOT_GOING", "CONDITIONAL", "WAITLIST"]);
export const groupVisibility = z.enum(["PUBLIC_LISTED", "MEMBERS_VISIBLE", "INVITE_ONLY"]);
export const joinMode = z.enum(["OPEN", "REQUEST", "INVITE_ONLY"]);

// Universal accessibility flags every community gets by default. Groups can
// add their own via
// the per-group accessibilityPalette stored on Group.
export const UNIVERSAL_ACCESSIBILITY_FLAGS = [
  "wheelchair_accessible",
  "sensory_friendly",
  "alcohol_free",
  "smoke_free",
  "kid_friendly",
] as const;

// Validation: accept any slug-shaped string. Groups define their own palette,
// so the canonical enum lives in `Group.accessibilityPalette`, not here.
export const accessibilityFlag = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9_]+$/, "lowercase, digits, and underscores only");

export const eventLocationVisibility = z.enum(["PUBLIC", "RSVP_CONFIRMED", "DAY_OF"]);

// Discriminated-union location payload used by event create/update.
// `pin`  — specific address (geocoded); de-dupes by address.
// `area` — circle (center + radius in meters); never de-duped.
// `tbd`  — no Location row created; only general-area text on the Event.
// `none` — clear the location on update.
export const eventLocationInput = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("pin"),
    address: z.string().min(2).max(500),
    venueName: z.string().max(120).optional().nullable(),
    venueNotes: z.string().max(10_000).optional().nullable(),
    lat: z.number(),
    lng: z.number(),
    visibility: eventLocationVisibility.default("PUBLIC"),
    generalArea: z.string().max(120).optional().nullable(),
  }),
  z.object({
    kind: z.literal("area"),
    lat: z.number(),
    lng: z.number(),
    // Radius represents "find your group within X meters of this pin" — a
    // meeting-point spread, not a region. 5–5000m covers everything from
    // "right at this bench" to "this section of a wide outdoor zone." Use
    // TBD mode for anything bigger.
    radius: z.number().int().min(5).max(5000),
    venueName: z.string().max(120).optional().nullable(),
    venueNotes: z.string().max(10_000).optional().nullable(),
    visibility: eventLocationVisibility.default("PUBLIC"),
    generalArea: z.string().max(120).optional().nullable(),
  }),
  z.object({
    kind: z.literal("tbd"),
    generalArea: z.string().max(120),
    visibility: eventLocationVisibility.default("RSVP_CONFIRMED"),
  }),
  z.object({
    kind: z.literal("none"),
  }),
]);

export const groupCreate = z.object({
  name: z.string().min(2).max(80),
  slug: z.string().min(2).max(64).regex(/^[a-z0-9-]+$/).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  description: z.string().max(2000).optional(),
  logoUrl: z.string().url().optional(),
  visibility: groupVisibility.default("MEMBERS_VISIBLE"),
  joinMode: joinMode.default("REQUEST"),
});

export const groupUpdate = groupCreate.partial();

// Event-defaults JSON shape stored on Group.eventDefaults. Each field optional —
// the form merges defined keys onto a new event payload.
export const groupEventDefaults = z.object({
  scope: eventScope.optional(),
  capacity: z.number().int().positive().nullable().optional(),
  cost: z.string().max(40).nullable().optional(),
  allowPlusOnes: z.boolean().optional(),
  useWaitlist: z.boolean().optional(),
  accessibilityFlags: z.array(accessibilityFlag).optional(),
});

export const groupVocabularyUpdate = z.object({
  tagPalette: z.array(z.string().min(1).max(40).regex(/^[a-z0-9-]+$/, "lowercase, digits, hyphens only")).max(100),
  accessibilityPalette: z.array(accessibilityFlag).max(40),
  eventDefaults: groupEventDefaults.nullable(),
});

export type GroupEventDefaults = z.infer<typeof groupEventDefaults>;
export type GroupVocabularyUpdate = z.infer<typeof groupVocabularyUpdate>;

const eventBase = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(10_000).optional(),
  owningGroupId: z.string().min(1),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  locationId: z.string().optional().nullable(),
  location: eventLocationInput.optional(),
  capacity: z.coerce.number().int().positive().optional().nullable(),
  cost: z.string().max(40).optional().nullable(),
  scope: eventScope.default("MEMBERS"),
  status: eventStatus.default("CONFIRMED"),
  flyerImageUrl: z.string().url().optional().nullable(),
  tags: z.array(z.string()).default([]),
  accessibilityFlags: z.array(accessibilityFlag).default([]),
  rrule: z.string().optional().nullable(),
  coHostGroupIds: z.array(z.string()).default([]),
  allowPlusOnes: z.boolean().default(false),
  useWaitlist: z.boolean().default(true),
});

export const eventCreate = eventBase.refine((v) => v.endsAt > v.startsAt, { message: "endsAt must be after startsAt" });

export const eventUpdate = eventBase.partial().refine(
  (v) => v.startsAt == null || v.endsAt == null || v.endsAt > v.startsAt,
  { message: "endsAt must be after startsAt" },
);

export const softClaimCreate = z.object({
  groupId: z.string(),
  date: z.coerce.date(),
  note: z.string().max(400).optional(),
});

export const rsvpInput = z.object({
  eventId: z.string(),
  status: rsvpStatus,
  conditionalMinAttendees: z.number().int().positive().optional().nullable(),
  conditionalOnUserId: z.string().optional().nullable(),
  plusOneCount: z.number().int().min(0).max(10).default(0),
});

export const profileUpdate = z.object({
  displayName: z.string().min(1).max(80),
  pronouns: z.string().max(40).optional(),
  bio: z.string().max(2000).optional(),
  avatarUrl: z.string().url().optional().nullable(),
  timezone: z.string().min(1).max(64),
  homeLat: z.number().optional().nullable(),
  homeLng: z.number().optional().nullable(),
});

export const privacyUpdate = z.object({
  profileVisibility: visibility,
  attendanceVisibility: visibility,
  rsvpVisibility: visibility,
  searchable: z.boolean(),
  showOnAttendeeLists: z.boolean(),
});

export const reportCreate = z.object({
  subjectId: z.string().optional().nullable(),
  eventId: z.string().optional().nullable(),
  body: z.string().min(10).max(10_000),
  evidenceUrls: z.array(z.string().url()).max(5).default([]),
  confidential: z.boolean().default(false),
  shareWithSafetyNetwork: z.boolean().default(false),
});

export const adminNoteCreate = z.object({
  subjectUserId: z.string(),
  groupId: z.string(),
  body: z.string().min(1).max(10_000),
  shareWithSafetyNetwork: z.boolean().default(false),
});

export const carpoolOfferCreate = z.object({
  eventId: z.string(),
  pickupArea: z.string().min(1).max(200),
  seatsAvailable: z.number().int().min(1).max(20),
  departureTime: z.coerce.date(),
});

export const carpoolRequestCreate = z.object({
  eventId: z.string(),
  pickupArea: z.string().min(1).max(200),
  preferredDepartureTime: z.coerce.date(),
});

export const locationUpsert = z.object({
  address: z.string().min(2),
  lat: z.number(),
  lng: z.number(),
  radius: z.number().int().min(5).max(5000).optional().nullable(),
  venueName: z.string().max(120).optional().nullable(),
  venueNotes: z.string().max(10_000).optional().nullable(),
});

export const friendAction = z.object({ otherUserId: z.string() });
export const blockAction = z.object({ otherUserId: z.string() });

export const eventCommentCreate = z
  .object({
    eventId: z.string().min(1),
    body: z.string().trim().max(4000).default(""),
    imageUrl: z.string().url().optional().nullable(),
    // User ids the author @mentioned; the action re-checks each can see the event.
    mentionedUserIds: z.array(z.string()).max(20).default([]),
  })
  // A comment must carry something — text or an image.
  .refine((v) => v.body.length > 0 || !!v.imageUrl, { message: "Say something or attach an image." });

export const eventCommentEdit = z.object({
  commentId: z.string().min(1),
  body: z.string().trim().min(1, "Say something").max(4000),
});

// Small fixed palette — keeps the reaction bar legible and avoids an emoji picker.
export const COMMENT_REACTIONS = ["👍", "❤️", "🎉", "😂", "👀", "🙌"] as const;
export const eventCommentReactionToggle = z.object({
  commentId: z.string().min(1),
  emoji: z.enum(COMMENT_REACTIONS),
});

// External calendar subscription. We only accept https URLs and reject
// obvious internal hosts in the action layer (SSRF guard); webcal:// links
// (Apple) are normalized to https before validation.
export const externalCalendarUrlCreate = z.object({
  label: z.string().trim().min(1).max(80),
  url: z.string().url().max(2000),
});

export const externalCalendarFileImport = z.object({
  label: z.string().trim().min(1).max(80),
  ics: z.string().min(1).max(2_000_000), // ~2MB of text
});

export type GroupCreate = z.infer<typeof groupCreate>;
export type EventCreate = z.infer<typeof eventCreate>;
export type SoftClaimCreate = z.infer<typeof softClaimCreate>;
export type RSVPInput = z.infer<typeof rsvpInput>;
export type ProfileUpdate = z.infer<typeof profileUpdate>;
export type PrivacyUpdate = z.infer<typeof privacyUpdate>;
export type ReportCreate = z.infer<typeof reportCreate>;
export type AdminNoteCreate = z.infer<typeof adminNoteCreate>;
export type CarpoolOfferCreate = z.infer<typeof carpoolOfferCreate>;
export type CarpoolRequestCreate = z.infer<typeof carpoolRequestCreate>;
export type LocationUpsert = z.infer<typeof locationUpsert>;
export type EventLocationInput = z.infer<typeof eventLocationInput>;
export type EventLocationVisibility = z.infer<typeof eventLocationVisibility>;
export type EventCommentCreate = z.infer<typeof eventCommentCreate>;
export type EventCommentEdit = z.infer<typeof eventCommentEdit>;
export type CommentReaction = (typeof COMMENT_REACTIONS)[number];
export type ExternalCalendarUrlCreate = z.infer<typeof externalCalendarUrlCreate>;
export type ExternalCalendarFileImport = z.infer<typeof externalCalendarFileImport>;

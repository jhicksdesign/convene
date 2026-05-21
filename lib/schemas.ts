// Shared Zod schemas. Form components and server actions both validate from here
// so a field added to the schema lights up everywhere consistently.
import { z } from "zod";

export const visibility = z.enum(["PUBLIC", "MEMBERS", "GROUP", "FRIENDS", "PRIVATE"]);
export const eventScope = z.enum(["PUBLIC", "MEMBERS", "VOUCHED", "INVITE"]);
export const eventStatus = z.enum(["TENTATIVE", "CONFIRMED", "CANCELLED"]);
export const rsvpStatus = z.enum(["GOING", "INTERESTED", "MAYBE", "NOT_GOING", "CONDITIONAL", "WAITLIST"]);
export const groupVisibility = z.enum(["PUBLIC_LISTED", "MEMBERS_VISIBLE", "INVITE_ONLY"]);
export const joinMode = z.enum(["OPEN", "REQUEST", "INVITE_ONLY"]);

export const accessibilityFlag = z.enum([
  "wheelchair_accessible",
  "sensory_friendly",
  "suit_friendly_restrooms",
  "alcohol_free",
  "smoke_free",
  "kid_friendly",
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

const eventBase = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(10_000).optional(),
  owningGroupId: z.string().min(1),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  locationId: z.string().optional().nullable(),
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
  venueName: z.string().max(120).optional().nullable(),
  venueNotes: z.string().max(10_000).optional().nullable(),
});

export const friendAction = z.object({ otherUserId: z.string() });
export const blockAction = z.object({ otherUserId: z.string() });

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

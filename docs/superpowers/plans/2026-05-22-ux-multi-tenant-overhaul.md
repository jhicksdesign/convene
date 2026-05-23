# UX + Multi-tenant Vocabulary Overhaul

**Goal:** Make Eventide usable for arbitrary communities. Fix broken onboarding (raw lat/lng + free-text timezone), simplify form complexity via progressive disclosure, and move all "questionable for non-furry communities" vocabulary (tags, accessibility flags, conventions) to per-group config.

**Architecture:** Add three JSON/array columns to `Group` (`eventDefaults`, `tagPalette`, `accessibilityPalette`). Add nullable `groupId` to `Convention` so conventions become per-community. Existing forms read vocabulary from the group instead of hardcoded constants. Profile form swaps raw lat/lng for the existing `<LocationPicker>` and free-text timezone for a searchable IANA select.

**Tech Stack:** Next.js 16 (Turbopack), Prisma 6, Zod, Mapbox GL, Auth.js v5, Tailwind v4, Fraunces (display) + Inter (body), warm paper-and-ink palette (already established).

## Aesthetic direction

Existing system: warm "paper-and-ink" palette, Fraunces display type, Inter body, editorial spacing. New components inherit this — no new design language. Specifically:

- Visibility preset picker: editorial pull-quote cards with Fraunces small-caps labels, narrow ink rule between cards, hover lifts paper. Not stacked toggles.
- Tag input: pill chips matching existing `<Badge variant="outline">` warm-ivory styling. Combobox popover with soft drop shadow + 1px ink border (no glass/blur).
- More-options collapsible: marked by a left-hand 1px ink rule + small-caps "More options" label that flips a chevron. Not a clinical accordion.
- Timezone select: cmdk-style searchable popover (the project already has `cmdk` installed).

## Phases (each independently shippable)

### Phase 1 — Schema foundation
- `Group.eventDefaults Json?`
- `Group.tagPalette String[]`
- `Group.accessibilityPalette String[]`
- `Convention.groupId String?` nullable + index
- Migration; backfill `accessibilityPalette` with universal flags on existing groups

### Phase 2 — Profile form fix (highest reviewer impact)
- New `<TimezoneSelect>` component (cmdk search of IANA zones)
- Reuse `<LocationPicker>` from events for "Home" lat/lng (no address required — `area` mode w/ small radius is conceptually right but we want pin mode without address requirement; we'll add a `home` variant)
- Profile form: replace raw lat/lng inputs and timezone text input
- Default timezone from `Intl.DateTimeFormat().resolvedOptions().timeZone` when unset

### Phase 3 — Group form presets
- New `<VisibilityPreset>` component: 4 cards
- Group form switches to preset picker + optional "Advanced" reveal
- Group create defaults `accessibilityPalette` to universal seed

### Phase 4 — Vocabulary editor
- `/g/[slug]/admin/vocabulary` page
- Server actions: `updateGroupVocabulary` (tagPalette, accessibilityPalette, eventDefaults)
- Universal accessibility flag list as the defaults; admin adds/removes per group

### Phase 5 — Event form: tags + accessibility from group
- New `<TagInput>` component (chips + autocomplete from group palette + recent group tags)
- Event form uses group's `accessibilityPalette` instead of hardcoded `A11Y`
- Event form uses `<TagInput>` instead of plain text input
- Drop fursuit-specific placeholder

### Phase 6 — Event form progressive disclosure
- Essentials always: Title, Group, When, Where, Description
- "More options" reveal: Visibility scope, Tentative, Capacity+Waitlist, Cost, Plus-ones, Tags, Accessibility, Recurrence
- Per-group `eventDefaults` prefill the advanced fields

### Phase 7 — Convention cleanup
- Drop seed (or make it CSV-import only)
- Conflict detection + LLM assistant filter conventions to `groupId IN (group, safety-network groups) OR groupId IS NULL`
- Admin UI to add per-group conventions (stretch — defer if time)

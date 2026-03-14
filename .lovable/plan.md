

## Plan: Move Attendee Marquee Bars to Hero Section

### What Changes

1. **Remove `PublicAttendeesSection`** from its current standalone position in all 8 theme files.

2. **Embed attendee marquee bars directly inside `PublicHeroSection`** at the bottom of the hero (above the scroll indicator, below the CTA area). This keeps them visually part of the hero.

3. **Styling for hero context**: The marquee chips currently use `border-border/40 bg-card/60 text-foreground/80` which is for body sections. Inside the hero (which has images or dark bg), they need glass/translucent styling: `border-white/15 bg-white/10 backdrop-blur-md text-white/80`.

4. **Group label logic stays the same**:
   - If groups exist: show one marquee row per group, with the group name as a small label above each row.
   - If no groups: show one row labeled "Attendees".
   - Number of bars = number of groups (or 1 if ungrouped).
   - Alternate scroll direction per row.

### Technical Details

**`PublicHeroSection.tsx`** — Add the marquee rendering at the bottom of the hero content `<div>`, after the calendar pills, before the scroll/slide indicators. Import `useMemo` (already imported). Inline the `AttendeeMarquee` sub-component (or extract to a shared file). Use the `data.attendees` prop that's already available via `PublicEventData`.

- Position: absolute bottom area or within the flex column, placed after CTA with some top margin.
- Chips use hero-aware styling (glass pills on dark, card pills on light).
- Group labels: small uppercase text with `text-white/60` or `text-muted-foreground` depending on `hasImages`.

**All 8 theme files** — Remove the `<PublicAttendeesSection data={data} />` line and its import.

### Files Modified
- `src/components/public/sections/PublicHeroSection.tsx` — Add marquee bars
- `src/components/public/sections/PublicAttendeesSection.tsx` — Can be kept as-is (unused) or deleted
- 8 theme files — Remove `PublicAttendeesSection` usage


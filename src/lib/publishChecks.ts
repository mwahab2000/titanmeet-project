/**
 * Shared publish-readiness checks for events.
 * Used by WebsiteSection, QuickEventWizard, DraftsPage, and Events list.
 */

export interface PublishCheck {
  key: string;
  label: string;
  check: (event: any) => boolean;
}

export const PUBLISH_CHECKS: PublishCheck[] = [
  { key: "client", label: "Client selected", check: (e: any) => !!e.client_id },
  { key: "title", label: "Event title", check: (e: any) => !!e.title?.trim() },
  { key: "slug", label: "Event slug", check: (e: any) => !!e.slug?.trim() },
  { key: "date", label: "Event date", check: (e: any) => !!e.event_date },
  { key: "description", label: "Description", check: (e: any) => !!e.description?.trim() },
  { key: "hero", label: "Hero image", check: (e: any) => Array.isArray(e.hero_images) && e.hero_images.length > 0 },
  { key: "venue", label: "Venue or location", check: (e: any) => !!(e.venue_name?.trim() || e.venue?.trim() || e.location?.trim()) },
];

export function getPublishStatus(event: any) {
  const results = PUBLISH_CHECKS.map(c => ({ ...c, ok: c.check(event) }));
  const passed = results.filter(r => r.ok).length;
  const total = results.length;
  const pct = Math.round((passed / total) * 100);
  const allPass = passed === total;
  const missing = results.filter(r => !r.ok);
  return { results, passed, total, pct, allPass, missing };
}

export type CompletionLabel = "Just Started" | "In Progress" | "Ready to Publish";

export function getCompletionLabel(pct: number): CompletionLabel {
  if (pct >= 100) return "Ready to Publish";
  if (pct >= 30) return "In Progress";
  return "Just Started";
}

/* ─── Weighted completion for event cards ─── */

export interface WeightedCheck {
  key: string;
  label: string;
  weight: number;
  check: (event: any, counts: EventRelatedCounts) => boolean;
}

export interface EventRelatedCounts {
  attendees: number;
  agenda: number;
  invites: number;
}

export const READY_TO_PUBLISH_CHECKS: WeightedCheck[] = [
  { key: "client",      label: "Client",          weight: 8,  check: (e) => !!e.client_id },
  { key: "title",       label: "Title",           weight: 8,  check: (e) => !!e.title?.trim() },
  { key: "date",        label: "Event date",      weight: 8,  check: (e) => !!e.event_date },
  { key: "start_time",  label: "Start time",      weight: 6,  check: (e) => !!e.start_date },
  { key: "location",    label: "Location",        weight: 5,  check: (e) => !!(e.venue_name?.trim() || e.venue?.trim() || e.location?.trim()) },
  { key: "attendees",   label: "Attendees",       weight: 12, check: (_e, c) => c.attendees > 0 },
  { key: "slug",        label: "Public URL",      weight: 8,  check: (e) => !!e.slug?.trim() },
  { key: "template",    label: "Theme",           weight: 8,  check: (e) => !!e.theme_id },
  { key: "content",     label: "Content section", weight: 8,  check: (e) => !!e.description?.trim() },
  { key: "rsvp",        label: "RSVP configured", weight: 8,  check: (_e, c) => c.invites > 0 || c.attendees > 0 },
  { key: "comms",       label: "Comm. channels",  weight: 5,  check: (_e, c) => c.invites > 0 || c.attendees > 0 },
  { key: "cover",       label: "Cover image",     weight: 8,  check: (e) => Array.isArray(e.hero_images) && e.hero_images.length > 0 },
  { key: "agenda",      label: "Agenda",          weight: 8,  check: (_e, c) => c.agenda > 0 },
];

export interface WeightedResult {
  pct: number;
  ready: boolean;
  missing: string[];
}

export function getWeightedCompletion(event: any, counts: EventRelatedCounts): WeightedResult {
  let earned = 0;
  let total = 0;
  const missing: string[] = [];

  for (const check of READY_TO_PUBLISH_CHECKS) {
    total += check.weight;
    if (check.check(event, counts)) {
      earned += check.weight;
    } else {
      missing.push(check.label);
    }
  }

  const pct = total > 0 ? Math.round((earned / total) * 100) : 0;
  const ready = missing.length === 0;
  return { pct, ready, missing };
}

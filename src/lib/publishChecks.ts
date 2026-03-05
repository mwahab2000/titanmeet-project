/**
 * Shared publish-readiness checks for events.
 * Used by WebsiteSection, QuickEventWizard, and DraftsPage.
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

import type { PublicEventData } from "./types";
import { getPublicAssetUrl } from "@/lib/storage";

/** Resolve a stored path/URL to a public proxy URL for a given bucket */
function resolveImages(bucket: string, images: unknown): string[] {
  const arr = Array.isArray(images) ? (images as string[]) : [];
  return arr.map((v) => getPublicAssetUrl(bucket, v));
}

export function mapPublicEventData(
  client: any,
  event: any,
  agenda: any[],
  speakers: any[],
  organizers: any[],
  announcements: any[],
  surveyCount: number,
  speakerMap: Map<string, string>,
  dressCodesRaw: any[] = [],
  transportSettings: any | null = null,
  transportRoutes: any[] = [],
  transportStops: any[] = [],
  attendeesRaw: any[] = [],
  groupsRaw: any[] = [],
  attendeeGroupsRaw: any[] = [],
): PublicEventData {
  const heroImages = resolveImages("event-assets", event.hero_images);
  const venueImages = resolveImages("event-assets", event.venue_images);
  const galleryImages = resolveImages("event-assets", event.gallery_images);

  // Group stops by route_id
  const stopsByRoute = new Map<string, any[]>();
  transportStops.forEach((s: any) => {
    const key = s.route_id ?? "__none__";
    if (!stopsByRoute.has(key)) stopsByRoute.set(key, []);
    stopsByRoute.get(key)!.push(s);
  });

  return {
    client: {
      id: client.id,
      name: client.name,
      slug: client.slug,
      logoUrl: client.logo_url ?? null,
    },
    event: {
      id: event.id,
      title: event.title,
      slug: event.slug ?? "",
      description: event.description ?? null,
      date: event.event_date ?? null,
      status: event.status,
      themeId: (event as any).theme_id ?? "corporate",
    },
    hero: {
      title: event.title,
      description: event.description ?? null,
      images: heroImages,
      date: event.event_date ?? null,
      venueName: event.venue_name ?? event.location ?? null,
    },
    agenda: agenda.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description ?? null,
      startTime: a.start_time ?? null,
      endTime: a.end_time ?? null,
      dayNumber: a.day_number ?? 1,
      speakerName: a.speaker_id ? (speakerMap.get(a.speaker_id) ?? null) : null,
    })),
    speakers: speakers.map((s) => ({
      id: s.id,
      name: s.name,
      title: s.title ?? null,
      bio: s.bio ?? null,
      photoUrl: s.photo_url ? getPublicAssetUrl("event-assets", s.photo_url) : null,
      linkedinUrl: s.linkedin_url ?? null,
      gender: s.gender ?? "male",
    })),
    venue: {
      name: event.venue_name ?? null,
      address: event.venue_address ?? null,
      notes: event.venue_notes ?? null,
      mapLink: event.venue_map_link ?? null,
      images: venueImages,
    },
    organizers: organizers.map((o) => ({
      id: o.id,
      name: o.name,
      role: o.role ?? null,
      // Intentionally omit email and mobile from public payloads — PII
      email: null,
      mobile: null,
      photoUrl: o.photo_url ? getPublicAssetUrl("event-assets", o.photo_url) : null,
    })),
    announcements: announcements.map((a) => ({ id: a.id, text: a.text })),
    gallery: galleryImages,
    dressCode: dressCodesRaw.map((d) => ({
      dayNumber: d.day_number ?? 1,
      dressType: d.dress_type ?? "business_casual",
      customInstructions: d.custom_instructions ?? null,
      referenceImages: resolveImages("dress-code-images", d.reference_images),
    })),
    transport: {
      enabled: transportSettings?.enabled ?? false,
      generalInstructions: transportSettings?.general_instructions ?? null,
      meetupTime: transportSettings?.meetup_time ?? null,
      routes: transportRoutes.map((r: any) => ({
        id: r.id,
        name: r.name,
        dayNumber: r.day_number ?? null,
        departureTime: r.departure_time ?? null,
        vehicleType: r.vehicle_type ?? null,
        notes: r.notes ?? null,
        stops: (stopsByRoute.get(r.id) ?? []).map((s: any) => ({
          id: s.id,
          name: s.name,
          address: s.address ?? null,
          pickupTime: s.pickup_time ?? null,
          stopType: s.stop_type ?? "pickup",
          mapUrl: s.map_url ?? null,
          notes: s.notes ?? null,
        })),
      })),
    },
    surveys: { hasSurvey: surveyCount > 0 },
    attendees: (() => {
      const validAttendees = attendeesRaw.filter((a: any) => a.name?.trim());
      const hasGroups = groupsRaw.length > 0;
      if (!hasGroups) {
        return {
          hasGroups: false,
          groups: validAttendees.length > 0
            ? [{ name: "", names: validAttendees.map((a: any) => a.name.trim()) }]
            : [],
        };
      }
      // Build attendee-to-groups map
      const attendeeToGroups = new Map<string, string[]>();
      attendeeGroupsRaw.forEach((ag: any) => {
        if (!attendeeToGroups.has(ag.attendee_id)) attendeeToGroups.set(ag.attendee_id, []);
        attendeeToGroups.get(ag.attendee_id)!.push(ag.group_id);
      });
      // Build group-to-names
      const groupNames = new Map<string, string[]>();
      groupsRaw.forEach((g: any) => groupNames.set(g.id, []));
      validAttendees.forEach((a: any) => {
        const gids = attendeeToGroups.get(a.id) ?? [];
        if (gids.length === 0) {
          // ungrouped - we'll add to a special group
          if (!groupNames.has("__ungrouped__")) groupNames.set("__ungrouped__", []);
          groupNames.get("__ungrouped__")!.push(a.name.trim());
        } else {
          gids.forEach((gid) => {
            if (groupNames.has(gid)) groupNames.get(gid)!.push(a.name.trim());
          });
        }
      });
      const groups = groupsRaw
        .filter((g: any) => (groupNames.get(g.id) ?? []).length > 0)
        .map((g: any) => ({ name: g.name, names: groupNames.get(g.id)! }));
      // Add ungrouped if any
      const ungrouped = groupNames.get("__ungrouped__");
      if (ungrouped?.length) groups.push({ name: "Other", names: ungrouped });
      return { hasGroups: true, groups };
    })(),
  };
}

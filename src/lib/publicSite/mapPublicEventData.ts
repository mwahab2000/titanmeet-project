import type { PublicEventData } from "./types";

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
): PublicEventData {
  const heroImages = Array.isArray(event.hero_images) ? event.hero_images as string[] : [];
  const venueImages = Array.isArray(event.venue_images) ? event.venue_images as string[] : [];
  const galleryImages = Array.isArray(event.gallery_images) ? event.gallery_images as string[] : [];

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
      photoUrl: s.photo_url ?? null,
      linkedinUrl: s.linkedin_url ?? null,
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
      email: o.email ?? null,
      mobile: o.mobile ?? null,
      photoUrl: o.photo_url ?? null,
    })),
    announcements: announcements.map((a) => ({ id: a.id, text: a.text })),
    gallery: galleryImages,
    dressCode: dressCodesRaw.map((d) => ({
      dayNumber: d.day_number ?? 1,
      dressType: d.dress_type ?? "business_casual",
      customInstructions: d.custom_instructions ?? null,
      referenceImages: Array.isArray(d.reference_images) ? d.reference_images as string[] : [],
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
  };
}

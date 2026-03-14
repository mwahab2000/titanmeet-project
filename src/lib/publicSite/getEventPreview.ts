import { supabase } from "@/integrations/supabase/client";
import type { FetchResult } from "./types";
import { mapPublicEventData } from "./mapPublicEventData";
import { createSignedAssetUrls } from "@/lib/storage";
import { extractStoragePath } from "@/lib/storage";

/**
 * Replace proxy URLs in the mapped data with signed URLs so the
 * preview iframe (authenticated owner) can display private assets.
 */
async function resolveSignedImages(data: ReturnType<typeof mapPublicEventData>) {
  // Collect all image arrays we need to resolve
  const heroRaw = (data as any).__rawHeroImages as string[] | undefined;
  const venueRaw = (data as any).__rawVenueImages as string[] | undefined;
  const galleryRaw = (data as any).__rawGalleryImages as string[] | undefined;

  const [heroSigned, venueSigned, gallerySigned] = await Promise.all([
    heroRaw?.length ? createSignedAssetUrls("event-assets", heroRaw) : Promise.resolve([]),
    venueRaw?.length ? createSignedAssetUrls("event-assets", venueRaw) : Promise.resolve([]),
    galleryRaw?.length ? createSignedAssetUrls("event-assets", galleryRaw) : Promise.resolve([]),
  ]);

  if (heroSigned.length) data.hero.images = heroSigned;
  if (venueSigned.length) data.venue.images = venueSigned;
  if (gallerySigned.length) data.gallery = gallerySigned;

  // Speaker photos
  const speakerPaths = data.speakers.map((s) => s.photoUrl).filter(Boolean) as string[];
  if (speakerPaths.length) {
    // Extract raw paths from proxy URLs
    const rawPaths = speakerPaths.map((url) => {
      const prefix = "/functions/v1/serve-event-asset/event-assets/";
      const idx = url.indexOf(prefix);
      if (idx !== -1) return url.substring(idx + prefix.length);
      return url;
    });
    const signed = await createSignedAssetUrls("event-assets", rawPaths);
    let si = 0;
    data.speakers.forEach((s) => {
      if (s.photoUrl) { s.photoUrl = signed[si++]; }
    });
  }

  // Organizer photos
  const orgPaths = data.organizers.map((o) => o.photoUrl).filter(Boolean) as string[];
  if (orgPaths.length) {
    const rawPaths = orgPaths.map((url) => {
      const prefix = "/functions/v1/serve-event-asset/event-assets/";
      const idx = url.indexOf(prefix);
      if (idx !== -1) return url.substring(idx + prefix.length);
      return url;
    });
    const signed = await createSignedAssetUrls("event-assets", rawPaths);
    let si = 0;
    data.organizers.forEach((o) => {
      if (o.photoUrl) { o.photoUrl = signed[si++]; }
    });
  }

  // Dress code reference images
  for (const dc of data.dressCode) {
    if (dc.referenceImages.length) {
      const rawPaths = dc.referenceImages.map((url) => {
        const prefix = "/functions/v1/serve-event-asset/dress-code-images/";
        const idx = url.indexOf(prefix);
        if (idx !== -1) return url.substring(idx + prefix.length);
        return url;
      });
      dc.referenceImages = await createSignedAssetUrls("dress-code-images", rawPaths);
    }
  }

  // Clean up internal fields
  delete (data as any).__rawHeroImages;
  delete (data as any).__rawVenueImages;
  delete (data as any).__rawGalleryImages;
}

/**
 * Fetch event data for owner/admin preview — bypasses published status check.
 * Requires the user to own the event (or be admin).
 * Uses the same data mapping as the public page so the preview is identical.
 */
export async function getEventPreview(eventId: string): Promise<FetchResult> {
  try {
    // 1. Get event (RLS ensures only owner/admin can read draft events)
    const { data: event, error: eventErr } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .single();

    if (eventErr || !event) return { status: "not_found" };

    // 2. Get client
    let client = { id: "", name: "No Client", slug: "", logo_url: null as string | null };
    if (event.client_id) {
      const { data: c } = await supabase
        .from("clients")
        .select("id, name, slug, logo_url")
        .eq("id", event.client_id)
        .single();
      if (c) client = c;
    }

    // 3. Parallel-fetch related data (same as public fetch)
    const [agendaRes, speakersRes, organizersRes, announcementsRes, surveyRes, dressCodeRes, transportSettingsRes, transportRoutesRes, transportStopsRes, attendeesRes, groupsRes, attendeeGroupsRes] = await Promise.all([
      supabase.from("agenda_items").select("id, title, description, start_time, end_time, day_number, speaker_id").eq("event_id", event.id).order("day_number").order("order_index"),
      supabase.from("speakers").select("id, name, title, bio, photo_url, linkedin_url").eq("event_id", event.id),
      supabase.from("organizers").select("id, name, role, email, mobile, photo_url").eq("event_id", event.id),
      supabase.from("announcements").select("id, text").eq("event_id", event.id).order("order_index"),
      supabase.from("surveys").select("id", { count: "exact", head: true }).eq("event_id", event.id),
      supabase.from("dress_codes").select("day_number, dress_type, custom_instructions, reference_images").eq("event_id", event.id).order("day_number"),
      supabase.from("transport_settings").select("enabled, general_instructions, meetup_time").eq("event_id", event.id).maybeSingle(),
      supabase.from("transport_routes").select("id, name, day_number, departure_time, vehicle_type, notes").eq("event_id", event.id).order("day_number").order("name"),
      supabase.from("transport_pickup_points").select("id, name, address, pickup_time, stop_type, map_url, notes, route_id, order_index").eq("event_id", event.id).order("order_index"),
      supabase.from("attendees").select("id, name").eq("event_id", event.id),
      supabase.from("groups").select("id, name").eq("event_id", event.id),
      supabase.from("attendee_groups").select("attendee_id, group_id"),
    ]);

    const speakerMap = new Map<string, string>();
    (speakersRes.data ?? []).forEach((s: any) => speakerMap.set(s.id, s.name));

    const mapped = mapPublicEventData(client, event, agendaRes.data ?? [], speakersRes.data ?? [], organizersRes.data ?? [], announcementsRes.data ?? [], (surveyRes as any).count ?? 0, speakerMap, dressCodeRes.data ?? [], transportSettingsRes.data, transportRoutesRes.data ?? [], transportStopsRes.data ?? [], attendeesRes.data ?? [], groupsRes.data ?? [], attendeeGroupsRes.data ?? []);

    // Attach raw image paths for signed URL resolution
    const rawHero = Array.isArray(event.hero_images) ? (event.hero_images as string[]) : [];
    const rawVenue = Array.isArray(event.venue_images) ? (event.venue_images as string[]) : [];
    const rawGallery = Array.isArray(event.gallery_images) ? (event.gallery_images as string[]) : [];
    (mapped as any).__rawHeroImages = rawHero;
    (mapped as any).__rawVenueImages = rawVenue;
    (mapped as any).__rawGalleryImages = rawGallery;

    // Resolve all images to signed URLs for the preview
    await resolveSignedImages(mapped);

    return {
      status: "ok",
      data: mapped,
    };
  } catch (e: any) {
    return { status: "error", message: e.message ?? "Unknown error" };
  }
}

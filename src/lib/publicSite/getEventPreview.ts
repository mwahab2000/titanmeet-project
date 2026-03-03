import { supabase } from "@/integrations/supabase/client";
import type { FetchResult } from "./types";
import { mapPublicEventData } from "./mapPublicEventData";

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
    const [agendaRes, speakersRes, organizersRes, announcementsRes, surveyRes, dressCodeRes, transportSettingsRes, transportRoutesRes, transportStopsRes] = await Promise.all([
      supabase.from("agenda_items").select("id, title, description, start_time, end_time, day_number, speaker_id").eq("event_id", event.id).order("day_number").order("order_index"),
      supabase.from("speakers").select("id, name, title, bio, photo_url, linkedin_url").eq("event_id", event.id),
      supabase.from("organizers").select("id, name, role, email, mobile, photo_url").eq("event_id", event.id),
      supabase.from("announcements").select("id, text").eq("event_id", event.id).order("order_index"),
      supabase.from("surveys").select("id", { count: "exact", head: true }).eq("event_id", event.id),
      supabase.from("dress_codes").select("day_number, dress_type, custom_instructions, reference_images").eq("event_id", event.id).order("day_number"),
      supabase.from("transport_settings").select("enabled, general_instructions, meetup_time").eq("event_id", event.id).maybeSingle(),
      supabase.from("transport_routes").select("id, name, day_number, departure_time, vehicle_type, notes").eq("event_id", event.id).order("day_number").order("name"),
      supabase.from("transport_pickup_points").select("id, name, address, pickup_time, stop_type, map_url, notes, route_id, order_index").eq("event_id", event.id).order("order_index"),
    ]);

    const speakerMap = new Map<string, string>();
    (speakersRes.data ?? []).forEach((s: any) => speakerMap.set(s.id, s.name));

    return {
      status: "ok",
      data: mapPublicEventData(client, event, agendaRes.data ?? [], speakersRes.data ?? [], organizersRes.data ?? [], announcementsRes.data ?? [], (surveyRes as any).count ?? 0, speakerMap, dressCodeRes.data ?? [], transportSettingsRes.data, transportRoutesRes.data ?? [], transportStopsRes.data ?? []),
    };
  } catch (e: any) {
    return { status: "error", message: e.message ?? "Unknown error" };
  }
}

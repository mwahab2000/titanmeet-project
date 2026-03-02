import { supabase } from "@/integrations/supabase/client";
import type { FetchResult } from "./types";
import { mapPublicEventData } from "./mapPublicEventData";

export async function getPublicEventBySlugs(clientSlug: string, eventSlug: string): Promise<FetchResult> {
  try {
    // 1. Find client by slug
    const { data: client, error: clientErr } = await supabase
      .from("clients")
      .select("id, name, slug, logo_url")
      .eq("slug", clientSlug)
      .single();

    if (clientErr || !client) return { status: "not_found" };

    // 2. Find event by slug + client_id
    const { data: event, error: eventErr } = await supabase
      .from("events")
      .select("*")
      .eq("slug", eventSlug)
      .eq("client_id", client.id)
      .single();

    if (eventErr || !event) return { status: "not_found" };

    // 3. Check published status
    if (event.status !== "published" && event.status !== "ongoing") {
      return { status: "private" };
    }

    // 4. Parallel-fetch related data
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

    // Build speaker name map for agenda
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

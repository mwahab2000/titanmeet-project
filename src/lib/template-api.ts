import { supabase } from "@/integrations/supabase/client";

export interface TemplateData {
  // Event fields
  title?: string;
  description?: string;
  venue_name?: string;
  venue_address?: string;
  venue_notes?: string;
  venue_map_link?: string;
  location?: string;
  venue?: string;
  hero_images?: any[];
  gallery_images?: any[];
  venue_images?: any[];
  theme_id?: string;
  max_attendees?: number;
  transportation_notes?: string;
  // Relational
  agenda_items?: any[];
  speakers?: any[];
  organizers?: any[];
  dress_codes?: any[];
}

export type IncludedSection = "website" | "agenda" | "speakers" | "organizers" | "dress_codes";

export const SECTION_LABELS: Record<IncludedSection, string> = {
  website: "Website Content",
  agenda: "Agenda",
  speakers: "Speakers",
  organizers: "Organizers",
  dress_codes: "Dress Code",
};

/**
 * Build template_data from an existing event, fetching relational data.
 */
export async function buildTemplateFromEvent(
  eventId: string,
  sections: IncludedSection[]
): Promise<TemplateData> {
  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (!event) throw new Error("Event not found");

  const tpl: TemplateData = {};

  if (sections.includes("website")) {
    tpl.title = event.title;
    tpl.description = event.description;
    tpl.venue_name = event.venue_name;
    tpl.venue_address = event.venue_address;
    tpl.venue_notes = event.venue_notes;
    tpl.venue_map_link = event.venue_map_link;
    tpl.location = event.location;
    tpl.venue = event.venue;
    tpl.hero_images = event.hero_images as any;
    tpl.gallery_images = event.gallery_images as any;
    tpl.venue_images = event.venue_images as any;
    tpl.theme_id = event.theme_id;
    tpl.max_attendees = event.max_attendees ?? undefined;
    tpl.transportation_notes = event.transportation_notes;
  }

  if (sections.includes("agenda")) {
    const { data } = await supabase
      .from("agenda_items")
      .select("title, description, start_time, end_time, day_number, order_index")
      .eq("event_id", eventId)
      .order("order_index");
    tpl.agenda_items = data || [];
  }

  if (sections.includes("speakers")) {
    const { data } = await supabase
      .from("speakers" as any)
      .select("name, title, bio, photo_url, linkedin_url")
      .eq("event_id", eventId);
    tpl.speakers = data || [];
  }

  if (sections.includes("organizers")) {
    const { data } = await supabase
      .from("organizers")
      .select("name, role, email, mobile, photo_url")
      .eq("event_id", eventId);
    tpl.organizers = data || [];
  }

  if (sections.includes("dress_codes")) {
    const { data } = await supabase
      .from("dress_codes" as any)
      .select("dress_type, custom_instructions, day_number, reference_images")
      .eq("event_id", eventId);
    tpl.dress_codes = data || [];
  }

  return tpl;
}

/**
 * Create a new event from a template, cloning relational rows.
 */
export async function createEventFromTemplate(
  templateId: string,
  overrides: {
    title: string;
    slug: string;
    client_id: string;
    start_date: string;
    end_date: string;
    event_date: string;
  },
  userId: string
) {
  // Fetch template
  const { data: tpl, error: tplErr } = await supabase
    .from("event_templates" as any)
    .select("*")
    .eq("id", templateId)
    .single();

  if (tplErr || !tpl) throw new Error("Template not found");

  const td: TemplateData = (tpl as any).template_data || {};
  const sections: string[] = (tpl as any).included_sections || [];

  // Create event
  const eventInsert: any = {
    created_by: userId,
    title: overrides.title,
    slug: overrides.slug,
    client_id: overrides.client_id,
    start_date: overrides.start_date,
    end_date: overrides.end_date,
    event_date: overrides.event_date,
    status: "draft",
  };

  if (sections.includes("website")) {
    eventInsert.description = td.description;
    eventInsert.venue_name = td.venue_name;
    eventInsert.venue_address = td.venue_address;
    eventInsert.venue_notes = td.venue_notes;
    eventInsert.venue_map_link = td.venue_map_link;
    eventInsert.location = td.location;
    eventInsert.venue = td.venue;
    eventInsert.hero_images = td.hero_images || [];
    eventInsert.gallery_images = td.gallery_images || [];
    eventInsert.venue_images = td.venue_images || [];
    eventInsert.theme_id = td.theme_id || "corporate";
    eventInsert.max_attendees = td.max_attendees;
    eventInsert.transportation_notes = td.transportation_notes;
  }

  const { data: newEvent, error: evErr } = await supabase
    .from("events")
    .insert(eventInsert)
    .select()
    .single();

  if (evErr || !newEvent) throw new Error(evErr?.message || "Failed to create event");

  const newEventId = newEvent.id;

  // Clone relational rows in parallel
  const cloneOps: PromiseLike<any>[] = [];

  if (sections.includes("agenda") && td.agenda_items?.length) {
    const rows = td.agenda_items.map((item: any) => ({
      event_id: newEventId,
      title: item.title,
      description: item.description,
      start_time: item.start_time,
      end_time: item.end_time,
      day_number: item.day_number,
      order_index: item.order_index,
    }));
    cloneOps.push(supabase.from("agenda_items").insert(rows));
  }

  if (sections.includes("speakers") && td.speakers?.length) {
    const rows = td.speakers.map((s: any) => ({
      event_id: newEventId,
      name: s.name,
      title: s.title,
      bio: s.bio,
      photo_url: s.photo_url,
      linkedin_url: s.linkedin_url,
    }));
    cloneOps.push(supabase.from("speakers" as any).insert(rows));
  }

  if (sections.includes("organizers") && td.organizers?.length) {
    const rows = td.organizers.map((o: any) => ({
      event_id: newEventId,
      name: o.name,
      role: o.role,
      email: o.email,
      mobile: o.mobile,
      photo_url: o.photo_url,
    }));
    cloneOps.push(supabase.from("organizers").insert(rows));
  }

  if (sections.includes("dress_codes") && td.dress_codes?.length) {
    const rows = td.dress_codes.map((d: any) => ({
      event_id: newEventId,
      dress_type: d.dress_type,
      custom_instructions: d.custom_instructions,
      day_number: d.day_number,
      reference_images: d.reference_images,
    }));
    cloneOps.push(supabase.from("dress_codes" as any).insert(rows));
  }

  await Promise.all(cloneOps);

  return newEvent;
}

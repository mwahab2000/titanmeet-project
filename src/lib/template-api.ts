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
  // Transport
  transport_settings?: any;
  transport_routes?: any[];
  transport_stops?: any[];
  // Surveys
  surveys?: any[];
}

export type IncludedSection = "website" | "agenda" | "speakers" | "organizers" | "dress_codes" | "transport" | "surveys";

export const SECTION_LABELS: Record<IncludedSection, string> = {
  website: "Website Content",
  agenda: "Agenda",
  speakers: "Speakers",
  organizers: "Organizers",
  dress_codes: "Dress Code",
  transport: "Transport Routes",
  surveys: "Surveys",
};

export type TemplateCategory = "general" | "corporate" | "social" | "conference" | "workshop" | "gala" | "retreat";

export const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  general: "General",
  corporate: "Corporate",
  social: "Social",
  conference: "Conference",
  workshop: "Workshop",
  gala: "Gala & Awards",
  retreat: "Retreat & Wellness",
};

export interface CommTemplates {
  invitation_subject?: string;
  invitation_body?: string;
  reminder_subject?: string;
  reminder_body?: string;
  followup_subject?: string;
  followup_body?: string;
}

export interface MarketplaceTemplate {
  id: string;
  name: string;
  description: string | null;
  category: TemplateCategory;
  tags: string[];
  is_featured: boolean;
  preview_image: string | null;
  event_type: string | null;
  expected_attendees: number | null;
  included_sections: string[];
  comm_templates: CommTemplates;
  template_data: TemplateData;
  client_id: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
  clients?: { name: string } | null;
}

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

  if (sections.includes("transport")) {
    const [sRes, rRes, pRes] = await Promise.all([
      supabase.from("transport_settings" as any).select("enabled, mode, meetup_time, general_instructions").eq("event_id", eventId).maybeSingle(),
      supabase.from("transport_routes" as any).select("name, vehicle_type, capacity, departure_time, driver_name, driver_mobile, day_number, notes").eq("event_id", eventId).order("created_at"),
      supabase.from("transport_pickup_points" as any).select("name, address, pickup_time, map_url, notes, stop_type, destination, order_index, route_id").eq("event_id", eventId).order("order_index"),
    ]);
    tpl.transport_settings = sRes.data || null;
    tpl.transport_routes = (rRes.data as any) || [];
    // Store stops with a temporary route_index reference so we can re-link after cloning routes
    const routeIds = ((rRes.data as any) || []).map((r: any) => r.id ?? null);
    tpl.transport_stops = ((pRes.data as any) || []).map((s: any) => {
      const routeIdx = s.route_id ? routeIds.indexOf(s.route_id) : -1;
      const { route_id, ...rest } = s;
      return { ...rest, _route_index: routeIdx };
    });
  }

  if (sections.includes("surveys")) {
    const { data: surveyRows } = await supabase
      .from("surveys")
      .select("title, description, status")
      .eq("event_id", eventId);
    const surveys: any[] = [];
    for (const sv of surveyRows || []) {
      const { data: qRows } = await supabase
        .from("survey_questions")
        .select("question_text, type, required, order_index, settings")
        .eq("survey_id", (sv as any).id)
        .order("order_index");
      surveys.push({ ...sv, questions: qRows || [] });
    }
    tpl.surveys = surveys;
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

  // Transport cloning (sequential because stops reference routes)
  if (sections.includes("transport") && td.transport_settings) {
    const ts = td.transport_settings;
    await supabase.from("transport_settings" as any).upsert({
      event_id: newEventId,
      enabled: ts.enabled,
      mode: ts.mode,
      meetup_time: ts.meetup_time,
      general_instructions: ts.general_instructions,
    }, { onConflict: "event_id" });

    if (td.transport_routes?.length) {
      const routeInserts = td.transport_routes.map((r: any) => ({
        event_id: newEventId,
        name: r.name,
        vehicle_type: r.vehicle_type,
        capacity: r.capacity,
        departure_time: r.departure_time,
        driver_name: r.driver_name,
        driver_mobile: r.driver_mobile,
        day_number: r.day_number,
        notes: r.notes,
      }));
      const { data: newRoutes } = await supabase.from("transport_routes" as any).insert(routeInserts).select("id");

      if (td.transport_stops?.length && newRoutes) {
        const stopInserts = td.transport_stops.map((s: any) => {
          const { _route_index, ...rest } = s;
          const newRouteId = _route_index >= 0 && newRoutes[_route_index] ? (newRoutes[_route_index] as any).id : null;
          return { ...rest, event_id: newEventId, route_id: newRouteId };
        });
        await supabase.from("transport_pickup_points" as any).insert(stopInserts);
      }
    }
  }

  // Survey cloning (sequential because questions reference surveys)
  if (sections.includes("surveys") && td.surveys?.length) {
    for (const sv of td.surveys) {
      const { data: newSurvey } = await supabase.from("surveys").insert({
        event_id: newEventId,
        created_by: userId,
        title: sv.title,
        description: sv.description,
        status: "draft",
      }).select("id").single();

      if (newSurvey && sv.questions?.length) {
        const qRows = sv.questions.map((q: any) => ({
          survey_id: newSurvey.id,
          event_id: newEventId,
          question_text: q.question_text,
          type: q.type,
          required: q.required,
          order_index: q.order_index,
          settings: q.settings,
        }));
        await supabase.from("survey_questions").insert(qRows);
      }
    }
  }

  return newEvent;
}

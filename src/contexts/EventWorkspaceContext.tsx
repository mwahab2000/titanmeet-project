import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type SaveStatus = "idle" | "saving" | "saved" | "error";
export type CompletionStatus = "empty" | "partial" | "done";

interface EventData {
  id: string;
  title: string;
  description: string | null;
  status: string;
  client_id: string | null;
  slug: string | null;
  event_date: string | null;
  hero_images: string[];
  venue_images: string[];
  venue_name: string | null;
  venue_address: string | null;
  venue_notes: string | null;
  venue_map_link: string | null;
  transportation_notes: string | null;
  transportation_pickups: any[];
  transportation_schedule: any[];
  location: string | null;
  venue: string | null;
  start_date: string;
  end_date: string;
  created_by: string;
  [key: string]: any;
}

interface RelatedCounts {
  agenda: number;
  organizers: number;
  speakers: number;
  attendees: number;
  transportRoutes: number;
  dressCode: number;
  groups: number;
  announcements: number;
  survey: number;
}

interface EventWorkspaceContextType {
  event: EventData | null;
  setEvent: React.Dispatch<React.SetStateAction<EventData | null>>;
  saveStatus: SaveStatus;
  autosave: (updates: Partial<EventData>) => void;
  manualSave: () => Promise<void>;
  loading: boolean;
  isArchived: boolean;
  completionMap: Record<string, CompletionStatus>;
  refreshCounts: () => void;
}

const EventWorkspaceContext = createContext<EventWorkspaceContextType | null>(null);

export const useEventWorkspace = () => {
  const ctx = useContext(EventWorkspaceContext);
  if (!ctx) throw new Error("useEventWorkspace must be used within EventWorkspaceProvider");
  return ctx;
};

/** Safe version that returns null when outside the provider */
export const useEventWorkspaceOptional = () => useContext(EventWorkspaceContext);

function computeCompletion(event: EventData | null, counts: RelatedCounts): Record<string, CompletionStatus> {
  if (!event) return {};
  const hasTitle = !!event.title?.trim();
  const hasImages = event.hero_images.length > 0;
  return {
    hero: hasTitle && hasImages ? "done" : hasTitle ? "partial" : "empty",
    info: (hasTitle && event.description && event.event_date) ? "done" : (hasTitle || event.description || event.event_date) ? "partial" : "empty",
    agenda: counts.agenda > 0 ? "done" : "empty",
    organizers: counts.organizers > 0 ? "done" : "empty",
    speakers: counts.speakers > 0 ? "done" : "empty",
    attendees: counts.attendees > 0 ? "done" : "empty",
    groups: counts.groups > 0 ? "done" : "empty",
    "assign-groups": counts.groups > 0 ? "done" : "empty",
    transportation: counts.transportRoutes > 0 ? "done" : "empty",
    venue: event.venue_name ? "done" : "empty",
    gallery: (Array.isArray((event as any).gallery_images) ? (event as any).gallery_images : []).length > 0 ? "done" : "empty",
    announcements: counts.announcements > 0 ? "done" : "empty",
    survey: counts.survey > 0 ? "done" : "empty",
    "dress-code": counts.dressCode > 0 ? "done" : "empty",
    communications: "done",
    website: "done",
  };
}

export const EventWorkspaceProvider: React.FC<{ eventId: string; children: React.ReactNode }> = ({ eventId, children }) => {
  const [event, setEvent] = useState<EventData | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<RelatedCounts>({ agenda: 0, organizers: 0, speakers: 0, attendees: 0, groups: 0, announcements: 0, survey: 0, transportRoutes: 0, dressCode: 0 });
  const pendingUpdates = useRef<Partial<EventData>>({});
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const loadCounts = useCallback(async (eid: string) => {
    const [a, o, sp, at, g, an, s, tr, dc] = await Promise.all([
      supabase.from("agenda_items").select("id", { count: "exact", head: true }).eq("event_id", eid),
      supabase.from("organizers").select("id", { count: "exact", head: true }).eq("event_id", eid),
      supabase.from("speakers" as any).select("id", { count: "exact", head: true }).eq("event_id", eid),
      supabase.from("attendees").select("id", { count: "exact", head: true }).eq("event_id", eid),
      supabase.from("groups").select("id", { count: "exact", head: true }).eq("event_id", eid),
      supabase.from("announcements").select("id", { count: "exact", head: true }).eq("event_id", eid),
      supabase.from("surveys" as any).select("id", { count: "exact", head: true }).eq("event_id", eid),
      supabase.from("transport_routes").select("id", { count: "exact", head: true }).eq("event_id", eid),
      supabase.from("dress_codes" as any).select("id", { count: "exact", head: true }).eq("event_id", eid),
    ]);
    setCounts({
      agenda: a.count ?? 0,
      organizers: o.count ?? 0,
      speakers: (sp as any).count ?? 0,
      attendees: at.count ?? 0,
      groups: g.count ?? 0,
      announcements: an.count ?? 0,
      survey: s.count ?? 0,
      transportRoutes: tr.count ?? 0,
      dressCode: (dc as any).count ?? 0,
    });
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase.from("events").select("*").eq("id", eventId).single();
      if (error) {
        toast.error("Failed to load event");
        setLoading(false);
        return;
      }
      setEvent({
        ...data,
        hero_images: Array.isArray(data.hero_images) ? data.hero_images : [],
        venue_images: Array.isArray(data.venue_images) ? data.venue_images : [],
        transportation_pickups: Array.isArray(data.transportation_pickups) ? data.transportation_pickups : [],
        transportation_schedule: Array.isArray(data.transportation_schedule) ? data.transportation_schedule : [],
      } as EventData);
      await loadCounts(eventId);
      setLoading(false);
    };
    load();
  }, [eventId, loadCounts]);

  const flush = useCallback(async (updates: Partial<EventData>) => {
    if (!event) return;
    setSaveStatus("saving");
    const { error } = await supabase.from("events").update(updates as any).eq("id", event.id);
    if (error) {
      setSaveStatus("error");
      toast.error("Failed to save");
    } else {
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    }
    pendingUpdates.current = {};
  }, [event]);

  const autosave = useCallback((updates: Partial<EventData>) => {
    pendingUpdates.current = { ...pendingUpdates.current, ...updates };
    setEvent(prev => prev ? { ...prev, ...updates } : prev);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => flush(pendingUpdates.current), 1500);
  }, [flush]);

  const manualSave = useCallback(async () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    await flush(pendingUpdates.current);
  }, [flush]);

  const refreshCounts = useCallback(() => {
    if (event) loadCounts(event.id);
  }, [event, loadCounts]);

  const isArchived = event?.status === "archived";
  const completionMap = computeCompletion(event, counts);

  return (
    <EventWorkspaceContext.Provider value={{ event, setEvent, saveStatus, autosave, manualSave, loading, isArchived, completionMap, refreshCounts }}>
      {children}
    </EventWorkspaceContext.Provider>
  );
};

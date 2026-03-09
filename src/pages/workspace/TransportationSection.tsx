import { useState, useEffect, useCallback, useRef } from "react";
import { useEventWorkspace } from "@/contexts/EventWorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import TransportSettingsCard, { type TransportSettings } from "./transport/TransportSettingsCard";
import RoutesCard, { type TransportRoute, type TransportStop } from "./transport/RoutesCard";
import { SectionHint } from "@/components/ui/section-hint";

const defaultSettings = (eventId: string): TransportSettings => ({
  event_id: eventId,
  enabled: false,
  mode: "none",
  meetup_time: null,
  general_instructions: null,
});

const TransportationSection = () => {
  const { event, isArchived } = useEventWorkspace();
  const [settings, setSettings] = useState<TransportSettings | null>(null);
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [stops, setStops] = useState<TransportStop[]>([]);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const loadAll = useCallback(async () => {
    if (!event) return;
    setLoading(true);
    const [sRes, rRes, pRes] = await Promise.all([
      supabase.from("transport_settings" as any).select("*").eq("event_id", event.id).maybeSingle(),
      supabase.from("transport_routes" as any).select("*").eq("event_id", event.id).order("created_at"),
      supabase.from("transport_pickup_points" as any).select("*").eq("event_id", event.id).order("order_index"),
    ]);
    setSettings(sRes.data ? (sRes.data as any) : defaultSettings(event.id));
    setRoutes((rRes.data as any) || []);
    setStops((pRes.data as any) || []);
    setLoading(false);
  }, [event]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const upsertSettings = useCallback(async (updates: Partial<TransportSettings>) => {
    if (!event || !settings) return;
    const merged = { ...settings, ...updates };
    setSettings(merged);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const payload: any = {
        event_id: event.id,
        enabled: merged.enabled,
        mode: merged.mode,
        meetup_time: merged.meetup_time,
        general_instructions: merged.general_instructions,
      };
      const { error } = await supabase.from("transport_settings" as any).upsert(payload, { onConflict: "event_id" });
      if (error) toast.error(error.message);
    }, 800);
  }, [event, settings]);

  if (!event) return null;
  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;

  const s = settings || defaultSettings(event.id);
  return (
    <div className="space-y-6">
      {routes.length === 0 && (
        <SectionHint
          sectionKey="transportation"
          title="Transportation"
          description="Add bus routes and pickup stops for coordinated attendee transport. Routes and stops are displayed on the public event page."
        />
      )}
      <TransportSettingsCard settings={s} onChange={upsertSettings} disabled={isArchived} />
      {s.enabled && (
        <RoutesCard eventId={event.id} disabled={isArchived} routes={routes} stops={stops} reload={loadAll} />
      )}
    </div>
  );
};

export default TransportationSection;

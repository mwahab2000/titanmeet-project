import { useEffect, useState, useCallback } from "react";
import { useEventWorkspace } from "@/contexts/EventWorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { CommsMessageList, type CommsMessage } from "./CommsMessageList";

interface CommsInboxViewProps {
  filter: "resolved" | "unassigned";
  onSelectMessage: (msg: CommsMessage) => void;
  selectedId: string | null;
}

export function CommsInboxView({ filter, onSelectMessage, selectedId }: CommsInboxViewProps) {
  const { event } = useEventWorkspace();
  const [messages, setMessages] = useState<CommsMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!event) return;
    setLoading(true);

    let query = supabase
      .from("inbound_messages" as any)
      .select("*")
      .order("received_at", { ascending: false });

    if (filter === "resolved") {
      query = query.eq("event_id", event.id).eq("resolved_status", "resolved");
    } else {
      query = query.is("event_id", null);
    }

    const { data } = await query;
    const msgs = (data || []) as any[];

    // Get attendee names
    const attendeeIds = [...new Set(msgs.map(m => m.attendee_id).filter(Boolean))];
    let attendeeMap: Record<string, string> = {};
    if (attendeeIds.length > 0) {
      const { data: attendees } = await supabase
        .from("attendees")
        .select("id, name")
        .in("id", attendeeIds);
      if (attendees) {
        attendeeMap = Object.fromEntries(attendees.map(a => [a.id, a.name]));
      }
    }

    setMessages(msgs.map(m => ({
      id: m.id,
      attendeeName: attendeeMap[m.attendee_id] || m.from_phone,
      attendeeId: m.attendee_id,
      channel: "whatsapp" as const,
      preview: m.body?.substring(0, 80) || "",
      lastActivity: m.received_at,
      status: m.resolved_status === "resolved" ? "replied" as const : "unresolved" as const,
      direction: "inbound" as const,
      fromPhone: m.from_phone,
    })));
    setLoading(false);
  }, [event?.id, filter]);

  useEffect(() => { load(); }, [load]);

  return (
    <CommsMessageList
      messages={messages}
      loading={loading}
      selectedId={selectedId}
      onSelect={onSelectMessage}
      emptyMessage={filter === "resolved" ? "No inbox messages for this event." : "No unassigned messages."}
    />
  );
}

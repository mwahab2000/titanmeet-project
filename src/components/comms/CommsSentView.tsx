import { useEffect, useState, useCallback } from "react";
import { useEventWorkspace } from "@/contexts/EventWorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { CommsMessageList, type CommsMessage } from "./CommsMessageList";

export function CommsSentView({ onSelectMessage }: { onSelectMessage: (msg: CommsMessage) => void; selectedId: string | null }) {
  const { event } = useEventWorkspace();
  const [messages, setMessages] = useState<CommsMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!event) return;
    setLoading(true);

    const { data: logs } = await supabase
      .from("message_logs")
      .select("id, channel, to_address, message_body, subject, status, created_at, attendee_id")
      .eq("event_id", event.id)
      .order("created_at", { ascending: false })
      .limit(200);

    if (!logs) { setMessages([]); setLoading(false); return; }

    // Get attendee names
    const attendeeIds = [...new Set(logs.map(l => l.attendee_id).filter(Boolean))];
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

    setMessages(logs.map(l => ({
      id: l.id,
      attendeeName: attendeeMap[l.attendee_id] || l.to_address,
      attendeeId: l.attendee_id,
      channel: (l.channel as "whatsapp" | "email" | "sms") || "email",
      preview: l.message_body?.substring(0, 80) || "",
      subject: l.subject || undefined,
      lastActivity: l.created_at,
      status: l.status as any || "queued",
      direction: "outbound",
    })));
    setLoading(false);
  }, [event?.id]);

  useEffect(() => { load(); }, [load]);

  return (
    <CommsMessageList
      messages={messages}
      loading={loading}
      selectedId={null}
      onSelect={onSelectMessage}
      emptyMessage="No sent messages yet."
    />
  );
}

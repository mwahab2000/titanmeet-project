import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useEventWorkspace } from "@/contexts/EventWorkspaceContext";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  User, Phone, Mail, MessageSquare, Send, Link2,
  CheckCircle2, ArrowLeft, RefreshCw, ExternalLink,
} from "lucide-react";
import type { CommsMessage } from "./CommsMessageList";

interface ThreadItem {
  id: string;
  direction: "inbound" | "outbound";
  body: string;
  timestamp: string;
  status?: string;
  channel?: string;
  subject?: string;
}

interface AttendeeInfo {
  name: string;
  email: string;
  mobile: string | null;
  confirmed: boolean;
}

interface CommsThreadViewProps {
  message: CommsMessage;
  onBack: () => void;
  onAssignEvent?: () => void;
  onLinkAttendee?: () => void;
  onMarkResolved?: () => void;
}

export function CommsThreadView({ message, onBack, onAssignEvent, onLinkAttendee, onMarkResolved }: CommsThreadViewProps) {
  const { event } = useEventWorkspace();
  const [thread, setThread] = useState<ThreadItem[]>([]);
  const [attendeeInfo, setAttendeeInfo] = useState<AttendeeInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const loadThread = useCallback(async () => {
    setLoading(true);
    const items: ThreadItem[] = [];

    // Load inbound messages for this phone/attendee
    if (message.fromPhone || message.attendeeId) {
      const query = supabase
        .from("inbound_messages" as any)
        .select("*")
        .order("received_at", { ascending: true });

      if (message.fromPhone) query.eq("from_phone", message.fromPhone);
      if (event?.id) query.eq("event_id", event.id);

      const { data: inbounds } = await query;
      if (inbounds) {
        for (const m of inbounds as any[]) {
          items.push({
            id: m.id,
            direction: "inbound",
            body: m.body,
            timestamp: m.received_at,
            channel: "whatsapp",
          });
        }
      }
    }

    // Load outbound logs
    if (message.attendeeId && event?.id) {
      const { data: outbounds } = await supabase
        .from("message_logs")
        .select("*")
        .eq("attendee_id", message.attendeeId)
        .eq("event_id", event.id)
        .order("created_at", { ascending: true });

      if (outbounds) {
        for (const m of outbounds) {
          items.push({
            id: m.id,
            direction: "outbound",
            body: m.message_body,
            timestamp: m.created_at,
            status: m.status,
            channel: m.channel,
            subject: m.subject || undefined,
          });
        }
      }

      // Load attendee info
      const { data: att } = await supabase
        .from("attendees")
        .select("name, email, mobile, confirmed")
        .eq("id", message.attendeeId)
        .single();
      if (att) setAttendeeInfo(att);
    }

    items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    setThread(items);
    setLoading(false);
  }, [message.attendeeId, message.fromPhone, event?.id]);

  useEffect(() => { loadThread(); }, [loadThread]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
        <Button variant="ghost" size="icon" className="h-7 w-7 md:hidden" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium truncate">{message.attendeeName}</span>
            {message.channel === "whatsapp" ? (
              <MessageSquare className="h-3 w-3 text-emerald-500" />
            ) : (
              <Mail className="h-3 w-3 text-blue-500" />
            )}
          </div>
          {message.fromPhone && (
            <p className="text-[10px] text-muted-foreground ml-6">{message.fromPhone}</p>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={loadThread}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Attendee info card */}
      {attendeeInfo && (
        <div className="px-4 py-2 border-b border-border bg-muted/30">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Mail className="h-3 w-3" /> {attendeeInfo.email}
            </span>
            {attendeeInfo.mobile && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" /> {attendeeInfo.mobile}
              </span>
            )}
            <Badge variant={attendeeInfo.confirmed ? "default" : "outline"} className="text-[9px] h-4">
              {attendeeInfo.confirmed ? "RSVP Confirmed" : "Not Confirmed"}
            </Badge>
          </div>
        </div>
      )}

      {/* Thread messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
                <Skeleton className="h-16 w-3/4 rounded-lg" />
              </div>
            ))}
          </div>
        ) : thread.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No messages in this thread.</p>
        ) : (
          thread.map((t) => (
            <div
              key={t.id}
              className={cn("flex", t.direction === "inbound" ? "justify-start" : "justify-end")}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-xl px-3 py-2 text-sm",
                  t.direction === "inbound"
                    ? "bg-muted text-foreground rounded-bl-sm"
                    : "bg-primary text-primary-foreground rounded-br-sm"
                )}
              >
                {t.subject && (
                  <p className="text-[10px] font-medium opacity-70 mb-0.5">{t.subject}</p>
                )}
                <p className="whitespace-pre-wrap text-[13px]">{t.body}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] opacity-60">
                    {format(new Date(t.timestamp), "MMM d, HH:mm")}
                  </span>
                  {t.channel && (
                    <span className="text-[10px] opacity-50">{t.channel}</span>
                  )}
                  {t.direction === "outbound" && t.status && (
                    <Badge
                      variant={t.status === "failed" ? "destructive" : "secondary"}
                      className="text-[8px] h-3.5 px-1"
                    >
                      {t.status}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Actions bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-t border-border bg-card">
        <Button variant="outline" size="sm" className="gap-1 text-xs" disabled>
          <Send className="h-3 w-3" /> Reply
        </Button>
        {message.status === "failed" && (
          <Button variant="outline" size="sm" className="gap-1 text-xs">
            <RefreshCw className="h-3 w-3" /> Resend
          </Button>
        )}
        {(message.status === "unresolved") && onAssignEvent && (
          <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={onAssignEvent}>
            <Link2 className="h-3 w-3" /> Assign Event
          </Button>
        )}
        {!message.attendeeId && onLinkAttendee && (
          <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={onLinkAttendee}>
            <User className="h-3 w-3" /> Link Attendee
          </Button>
        )}
        {onMarkResolved && message.status === "unresolved" && (
          <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={onMarkResolved}>
            <CheckCircle2 className="h-3 w-3" /> Mark Resolved
          </Button>
        )}
      </div>
    </div>
  );
}

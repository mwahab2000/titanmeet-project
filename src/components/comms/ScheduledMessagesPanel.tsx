import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useEventWorkspace } from "@/contexts/EventWorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  listScheduledMessages, cancelScheduledMessage,
  scheduleEventReminders, scheduleEventCheckin,
  type ScheduledMessage,
} from "@/lib/whatsapp-api";
import { toast } from "sonner";
import { format, addHours } from "date-fns";
import {
  Clock, Send, X, CheckCircle2, AlertTriangle,
  MessageSquare, Bell, QrCode, Plus, Loader2,
} from "lucide-react";

const TYPE_ICONS: Record<string, any> = {
  reminder: Bell,
  checkin: QrCode,
  invitation: Send,
};
const TYPE_LABELS: Record<string, string> = {
  reminder: "Reminder",
  checkin: "Check-in",
  invitation: "Invitation",
};
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  processing: "outline",
  sent: "default",
  failed: "destructive",
  cancelled: "outline",
};

export function ScheduledMessagesPanel() {
  const { event } = useEventWorkspace();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduling, setScheduling] = useState(false);
  const [scheduleType, setScheduleType] = useState<string>("reminder");
  const [scheduleHours, setScheduleHours] = useState<string>("1");

  const load = useCallback(async () => {
    if (!event) return;
    setLoading(true);
    try {
      const data = await listScheduledMessages(event.id);
      setMessages(data);
    } catch (err) {
      console.error("Failed to load scheduled messages", err);
    } finally {
      setLoading(false);
    }
  }, [event?.id]);

  useEffect(() => { load(); }, [load]);

  const handleSchedule = async () => {
    if (!event || !user) return;
    setScheduling(true);
    try {
      const scheduledAt = addHours(new Date(), parseInt(scheduleHours)).toISOString();
      let count = 0;

      if (scheduleType === "reminder") {
        count = await scheduleEventReminders({
          event_id: event.id,
          channel: "whatsapp",
          scheduled_at: scheduledAt,
          created_by: user.id,
        });
      } else if (scheduleType === "checkin") {
        count = await scheduleEventCheckin({
          event_id: event.id,
          channel: "whatsapp",
          scheduled_at: scheduledAt,
          created_by: user.id,
        });
      }

      if (count > 0) {
        toast.success(`Scheduled ${count} ${scheduleType} message${count !== 1 ? "s" : ""}`);
        load();
      } else {
        toast.info("No eligible attendees found for scheduling");
      }
    } catch (err: any) {
      toast.error("Failed to schedule: " + (err.message || "Unknown error"));
    } finally {
      setScheduling(false);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelScheduledMessage(id);
      toast.success("Message cancelled");
      load();
    } catch (err: any) {
      toast.error("Failed to cancel: " + (err.message || "Unknown error"));
    }
  };

  if (!event) return null;

  const pending = messages.filter((m) => m.status === "pending");
  const completed = messages.filter((m) => m.status !== "pending");

  return (
    <div className="space-y-4 p-4 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold flex items-center gap-2">
          <Clock className="h-5 w-5" /> Scheduled Messages
        </h2>
      </div>

      {/* Schedule new */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Schedule New</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-2">
            <Select value={scheduleType} onValueChange={setScheduleType}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="reminder">Reminder</SelectItem>
                <SelectItem value="checkin">Check-in</SelectItem>
              </SelectContent>
            </Select>

            <Select value={scheduleHours} onValueChange={setScheduleHours}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">In 1 hour</SelectItem>
                <SelectItem value="2">In 2 hours</SelectItem>
                <SelectItem value="4">In 4 hours</SelectItem>
                <SelectItem value="12">In 12 hours</SelectItem>
                <SelectItem value="24">In 24 hours</SelectItem>
                <SelectItem value="48">In 48 hours</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={handleSchedule} disabled={scheduling} className="gap-1">
              {scheduling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Schedule
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {scheduleType === "reminder"
              ? "Sends WhatsApp reminders to unconfirmed attendees."
              : "Sends WhatsApp check-in messages to confirmed attendees."}
          </p>
        </CardContent>
      </Card>

      {/* Pending */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Pending ({pending.length})
              </h3>
              {pending.map((msg) => {
                const Icon = TYPE_ICONS[msg.message_type] || Send;
                return (
                  <Card key={msg.id} className="p-3">
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{TYPE_LABELS[msg.message_type] || msg.message_type}</span>
                          <Badge variant={STATUS_VARIANTS[msg.status] || "secondary"} className="text-[10px] h-5">
                            {msg.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {msg.attendee_name || "All eligible"} · {format(new Date(msg.scheduled_at), "MMM d, h:mm a")}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => handleCancel(msg.id)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {completed.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Completed ({completed.length})
              </h3>
              {completed.slice(0, 20).map((msg) => {
                const Icon = TYPE_ICONS[msg.message_type] || Send;
                return (
                  <Card key={msg.id} className="p-3 opacity-70">
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{TYPE_LABELS[msg.message_type] || msg.message_type}</span>
                          <Badge variant={STATUS_VARIANTS[msg.status] || "secondary"} className="text-[10px] h-5">
                            {msg.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {msg.attendee_name || "Bulk"} · {msg.sent_at ? format(new Date(msg.sent_at), "MMM d, h:mm a") : format(new Date(msg.scheduled_at), "MMM d, h:mm a")}
                          {msg.error && <span className="text-destructive ml-1">· {msg.error}</span>}
                        </p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {pending.length === 0 && completed.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No scheduled messages yet</p>
              <p className="text-xs mt-1">Schedule reminders or check-in messages above.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

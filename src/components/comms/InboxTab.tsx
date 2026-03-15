import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useEventWorkspace } from "@/contexts/EventWorkspaceContext";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Inbox as InboxIcon,
  ArrowLeft,
  User,
  Phone,
  Calendar,
  Loader2,
  Link2,
  Search,
} from "lucide-react";

/* ─── Types ─── */
interface InboundMessage {
  id: string;
  from_phone: string;
  to_phone: string;
  body: string;
  received_at: string;
  attendee_id: string | null;
  event_id: string | null;
  client_id: string | null;
  resolved_status: string;
  resolution_reason: string | null;
  provider_message_id: string | null;
}

interface OutboundLog {
  id: string;
  channel: string;
  to_address: string;
  message_body: string;
  subject: string | null;
  status: string;
  created_at: string;
  attendee_id: string;
}

interface ThreadMessage {
  id: string;
  direction: "inbound" | "outbound";
  body: string;
  timestamp: string;
  status?: string;
  channel?: string;
}

interface AttendeeOption {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
}

interface EventOption {
  id: string;
  title: string;
}

/* ─── Component ─── */
export function InboxTab() {
  const { event } = useEventWorkspace();
  const [messages, setMessages] = useState<InboundMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"resolved" | "unassigned">("resolved");
  const [selectedMsg, setSelectedMsg] = useState<InboundMessage | null>(null);
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [attendeeName, setAttendeeName] = useState<string | null>(null);

  // Routing dialog state
  const [routingMsg, setRoutingMsg] = useState<InboundMessage | null>(null);
  const [routingEvents, setRoutingEvents] = useState<EventOption[]>([]);
  const [routingAttendees, setRoutingAttendees] = useState<AttendeeOption[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedAttendeeId, setSelectedAttendeeId] = useState("");
  const [attendeeSearch, setAttendeeSearch] = useState("");
  const [routingSaving, setRoutingSaving] = useState(false);

  /* ─── Load messages ─── */
  const loadMessages = useCallback(async () => {
    if (!event) return;
    setLoading(true);

    if (filter === "resolved") {
      const { data } = await supabase
        .from("inbound_messages" as any)
        .select("*")
        .eq("event_id", event.id)
        .eq("resolved_status", "resolved")
        .order("received_at", { ascending: false });
      setMessages((data as any as InboundMessage[]) || []);
    } else {
      // Unassigned — event_id is null
      const { data } = await supabase
        .from("inbound_messages" as any)
        .select("*")
        .is("event_id", null)
        .order("received_at", { ascending: false });
      setMessages((data as any as InboundMessage[]) || []);
    }
    setLoading(false);
  }, [event?.id, filter]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  /* ─── Load thread for a message ─── */
  const openThread = useCallback(
    async (msg: InboundMessage) => {
      setSelectedMsg(msg);
      setThreadLoading(true);
      setAttendeeName(null);

      const items: ThreadMessage[] = [];

      // Load all inbound from same phone + event
      const inboundQuery = supabase
        .from("inbound_messages" as any)
        .select("*")
        .eq("from_phone", msg.from_phone)
        .order("received_at", { ascending: true });

      if (msg.event_id) {
        inboundQuery.eq("event_id", msg.event_id);
      }

      const { data: inbounds } = await inboundQuery;
      if (inbounds) {
        for (const m of inbounds as any[]) {
          items.push({
            id: m.id,
            direction: "inbound",
            body: m.body,
            timestamp: m.received_at,
          });
        }
      }

      // Load outbound logs for same attendee + event
      if (msg.attendee_id && msg.event_id) {
        const { data: outbounds } = await supabase
          .from("message_logs")
          .select("*")
          .eq("attendee_id", msg.attendee_id)
          .eq("event_id", msg.event_id)
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
            });
          }
        }

        // Get attendee name
        const { data: att } = await supabase
          .from("attendees")
          .select("name")
          .eq("id", msg.attendee_id)
          .single();
        if (att) setAttendeeName(att.name);
      }

      items.sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      setThread(items);
      setThreadLoading(false);
    },
    []
  );

  /* ─── Routing logic ─── */
  const openRouting = useCallback(async (msg: InboundMessage) => {
    setRoutingMsg(msg);
    setSelectedEventId("");
    setSelectedAttendeeId("");
    setAttendeeSearch("");

    // Load user's events
    const { data: events } = await supabase
      .from("events")
      .select("id, title")
      .in("status", ["draft", "published", "ongoing"])
      .order("created_at", { ascending: false })
      .limit(50);
    setRoutingEvents((events as EventOption[]) || []);
    setRoutingAttendees([]);
  }, []);

  // When event selected in routing, load its attendees
  useEffect(() => {
    if (!selectedEventId) {
      setRoutingAttendees([]);
      return;
    }
    supabase
      .from("attendees")
      .select("id, name, email, mobile")
      .eq("event_id", selectedEventId)
      .order("name")
      .then(({ data }) => {
        setRoutingAttendees((data as AttendeeOption[]) || []);
      });
  }, [selectedEventId]);

  const saveRouting = async () => {
    if (!routingMsg || !selectedEventId) return;
    setRoutingSaving(true);

    // Get client_id from event
    const { data: ev } = await supabase
      .from("events")
      .select("client_id")
      .eq("id", selectedEventId)
      .single();

    const updates: Record<string, any> = {
      event_id: selectedEventId,
      client_id: ev?.client_id || null,
      resolved_status: "resolved",
      resolution_reason: "manual_admin_routing",
    };
    if (selectedAttendeeId) {
      updates.attendee_id = selectedAttendeeId;
    }

    const { error } = await supabase
      .from("inbound_messages" as any)
      .update(updates)
      .eq("id", routingMsg.id);

    if (error) {
      toast.error("Failed to route message");
    } else {
      toast.success("Message routed successfully");
      setRoutingMsg(null);
      loadMessages();
    }
    setRoutingSaving(false);
  };

  const filteredRoutingAttendees = routingAttendees.filter((a) => {
    if (!attendeeSearch) return true;
    const q = attendeeSearch.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      (a.mobile || "").includes(q)
    );
  });

  if (!event) return null;

  /* ─── Thread view ─── */
  if (selectedMsg) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1"
          onClick={() => setSelectedMsg(null)}
        >
          <ArrowLeft className="h-4 w-4" /> Back to Inbox
        </Button>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="h-4 w-4" />
              {attendeeName || selectedMsg.from_phone}
              {attendeeName && (
                <span className="text-xs text-muted-foreground font-normal">
                  {selectedMsg.from_phone}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {threadLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : thread.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No messages in this thread.
              </p>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {thread.map((t) => (
                  <div
                    key={t.id}
                    className={`flex ${
                      t.direction === "inbound" ? "justify-start" : "justify-end"
                    }`}
                  >
                    <div
                      className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                        t.direction === "inbound"
                          ? "bg-muted text-foreground"
                          : "bg-primary text-primary-foreground"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{t.body}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] opacity-70">
                          {format(new Date(t.timestamp), "MMM d, HH:mm")}
                        </span>
                        {t.direction === "outbound" && t.status && (
                          <Badge
                            variant={
                              t.status === "sent"
                                ? "default"
                                : t.status === "failed"
                                ? "destructive"
                                : "secondary"
                            }
                            className="text-[10px] h-4"
                          >
                            {t.status}
                          </Badge>
                        )}
                        {t.direction === "outbound" && t.channel && (
                          <span className="text-[10px] opacity-50">
                            {t.channel}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ─── Message list ─── */
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="font-display text-base font-semibold flex items-center gap-2">
          <InboxIcon className="h-4 w-4" /> Inbox
        </h3>
        <div className="flex gap-2">
          <Button
            variant={filter === "resolved" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("resolved")}
          >
            This Event
          </Button>
          <Button
            variant={filter === "unassigned" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("unassigned")}
          >
            Unassigned
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : messages.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8 text-muted-foreground text-sm">
            {filter === "resolved"
              ? "No incoming messages for this event yet."
              : "No unassigned messages."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {messages.map((msg) => (
            <Card
              key={msg.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => openThread(msg)}
            >
              <CardContent className="flex items-center gap-3 py-3">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {msg.from_phone}
                    </span>
                    <Badge
                      variant={
                        msg.resolved_status === "resolved"
                          ? "default"
                          : msg.resolved_status === "ambiguous"
                          ? "secondary"
                          : "outline"
                      }
                      className="text-[10px] h-4 shrink-0"
                    >
                      {msg.resolved_status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {msg.body}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(msg.received_at), "MMM d, HH:mm")}
                  </span>
                  {(msg.resolved_status === "unknown" ||
                    msg.resolved_status === "ambiguous") && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        openRouting(msg);
                      }}
                    >
                      <Link2 className="h-3 w-3" /> Route
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ─── Routing dialog ─── */}
      <Dialog
        open={!!routingMsg}
        onOpenChange={(open) => !open && setRoutingMsg(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Route Message</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              From: <span className="font-medium">{routingMsg?.from_phone}</span>
            </div>
            <div className="bg-muted rounded p-2 text-sm max-h-24 overflow-y-auto">
              {routingMsg?.body}
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Assign to Event</Label>
              <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select event..." />
                </SelectTrigger>
                <SelectContent>
                  {routingEvents.map((ev) => (
                    <SelectItem key={ev.id} value={ev.id}>
                      {ev.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedEventId && (
              <div className="space-y-2">
                <Label className="text-xs">Link to Attendee (optional)</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    className="pl-7"
                    placeholder="Search by name, email, phone..."
                    value={attendeeSearch}
                    onChange={(e) => setAttendeeSearch(e.target.value)}
                  />
                </div>
                <div className="border rounded max-h-32 overflow-y-auto">
                  {filteredRoutingAttendees.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      No attendees found
                    </p>
                  ) : (
                    filteredRoutingAttendees.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => setSelectedAttendeeId(a.id)}
                        className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted/50 flex items-center justify-between ${
                          selectedAttendeeId === a.id
                            ? "bg-primary/10 font-medium"
                            : ""
                        }`}
                      >
                        <span>{a.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {a.mobile || a.email}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRoutingMsg(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={saveRouting}
              disabled={!selectedEventId || routingSaving}
            >
              {routingSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : null}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

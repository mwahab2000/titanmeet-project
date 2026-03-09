import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useEventWorkspace } from "@/contexts/EventWorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, Users, User, Sparkles, Loader2, Clock, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { callAi, type CommsDraftResult, type BestSendTimeResult } from "@/lib/ai-api";
import { SectionHint } from "@/components/ui/section-hint";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { PlanLimitGate } from "@/components/billing/PlanLimitGate";

interface LogEntry {
  id: string;
  channel: string;
  subject: string | null;
  message: string;
  status: string;
  created_at: string;
  attendee_id: string | null;
  recipient_info: string | null;
}

interface Attendee {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
}

const CommunicationsSection = () => {
  const { event, isArchived } = useEventWorkspace();
  const planLimits = usePlanLimits();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [channel, setChannel] = useState("email");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [recipientMode, setRecipientMode] = useState<"all" | "selected">("all");
  const [selectedAttendeeIds, setSelectedAttendeeIds] = useState<Set<string>>(new Set());
  const [aiDrafting, setAiDrafting] = useState(false);
  const [bestTimeLoading, setBestTimeLoading] = useState(false);
  const [bestTimeResult, setBestTimeResult] = useState<BestSendTimeResult | null>(null);

  const AI_DRAFT_TYPES = [
    { value: "invitation", label: "Invitation" },
    { value: "reminder_3day", label: "Reminder (3 days before)" },
    { value: "day_of", label: "Day-of reminder" },
    { value: "thank_you", label: "Post-event thank you" },
    { value: "cancellation", label: "Cancellation notice" },
  ];

  const handleAiDraft = async (draftType: string) => {
    if (!event) return;
    setAiDrafting(true);
    try {
      const result = await callAi<CommsDraftResult>({
        action: "communications_draft",
        prompt: draftType,
        context: {
          eventTitle: event.title,
          eventDate: event.event_date,
          venue: event.venue_name,
          attendeeCount: attendees.length,
          communicationType: draftType,
        },
      });
      if (result.subject) setSubject(result.subject);
      if (result.body) setMessage(result.body);
      toast.success("AI draft ready! Review and send.");
    } catch (err: any) {
      toast.error(err.message || "AI draft failed");
    }
    setAiDrafting(false);
  };

  const handleBestTime = async () => {
    if (!event) return;
    setBestTimeLoading(true);
    try {
      const result = await callAi<BestSendTimeResult>({
        action: "best_send_time",
        prompt: "Recommend best time",
        context: {
          eventTitle: event.title,
          eventDate: event.event_date,
          attendeeCount: attendees.length,
          channel,
        },
      });
      setBestTimeResult(result);
    } catch (err: any) {
      toast.error(err.message || "Failed to get recommendation");
    }
    setBestTimeLoading(false);
  };

  const loadLogs = useCallback(async () => {
    if (!event) return;
    const { data } = await supabase
      .from("communications_log")
      .select("*")
      .eq("event_id", event.id)
      .order("created_at", { ascending: false });
    setLogs((data as LogEntry[]) || []);
  }, [event?.id]);

  const loadAttendees = useCallback(async () => {
    if (!event) return;
    const { data } = await supabase
      .from("attendees")
      .select("id, name, email, mobile")
      .eq("event_id", event.id)
      .order("name");
    setAttendees((data as Attendee[]) || []);
  }, [event?.id]);

  useEffect(() => {
    loadLogs();
    loadAttendees();
  }, [loadLogs, loadAttendees]);

  const toggleAttendee = (id: string) => {
    setSelectedAttendeeIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const normalizePhone = (value: string | null) => (value || "").trim().replace(/[\s\-()]/g, "");
  const isE164 = (value: string | null) => /^\+[1-9]\d{7,14}$/.test(normalizePhone(value));

  const getRecipients = (): Attendee[] => {
    if (recipientMode === "all") return attendees;
    return attendees.filter(a => selectedAttendeeIds.has(a.id));
  };

  const send = async () => {
    if (!event || !message.trim()) return;

    // Email soft limit check
    if (channel === "email") {
      if (!planLimits.canCreate("emails")) {
        toast.error("Monthly email limit reached. Upgrade your plan to send more.");
        return;
      } else if (planLimits.emails.percent >= 80) {
        toast.warning(`You've used ${planLimits.emails.percent}% of your monthly email limit.`);
      }
    }

    const recipients = getRecipients();
    if (recipients.length === 0) {
      toast.error("No recipients selected");
      return;
    }

    // Validate: SMS/WhatsApp needs E.164 mobile numbers
    if (channel !== "email") {
      const invalidPhone = recipients.filter(r => !r.mobile || !isE164(r.mobile));
      if (invalidPhone.length > 0) {
        toast.error(
          `Invalid phone format for ${invalidPhone.length} attendee(s). Use E.164 format (example: +201234567890).`
        );
        return;
      }
    }

    setSending(true);
    let successCount = 0;
    let failCount = 0;

    for (const recipient of recipients) {
      const to = channel === "email" ? recipient.email : normalizePhone(recipient.mobile);
      const recipientInfo = `${recipient.name} (${to})`;

      // Insert log row as queued
      const { data: logRow, error: logError } = await supabase
        .from("communications_log")
        .insert({
          event_id: event.id,
          channel,
          subject: channel === "email" ? subject || null : null,
          message,
          status: "queued",
          attendee_id: recipient.id,
          recipient_info: recipientInfo,
        } as any)
        .select("id")
        .single();

      if (logError) {
        failCount++;
        continue;
      }

      // Invoke edge function
      const { error: fnError } = await supabase.functions.invoke("send-communication", {
        body: {
          channel,
          to,
          message,
          subject: channel === "email" ? subject || "" : undefined,
          event_id: event.id,
          log_id: (logRow as any).id,
        },
      });

      if (fnError) {
        failCount++;
      } else {
        successCount++;
      }
    }

    setSending(false);
    if (successCount > 0) toast.success(`${successCount} message(s) sent`);
    if (failCount > 0) toast.error(`${failCount} message(s) failed`);
    setSubject("");
    setMessage("");
    loadLogs();
  };

  if (!event) return null;

  const isNonEmail = channel !== "email";

  return (
    <div className="space-y-4">
      {logs.length === 0 && (
        <SectionHint
          sectionKey="communications"
          title="Communications"
          description="Send bulk emails or WhatsApp messages to all attendees, a specific group, or selected individuals. All messages are logged here."
        />
      )}
      {!isArchived && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">Send Communication</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Channel + Recipient Mode */}
            <div className="flex gap-3">
              <div className="w-36 space-y-1">
                <Label className="text-xs">Channel</Label>
                <Select value={channel} onValueChange={setChannel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-44 space-y-1">
                <Label className="text-xs">Recipients</Label>
                <Select value={recipientMode} onValueChange={(v) => setRecipientMode(v as "all" | "selected")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" /> All attendees</span>
                    </SelectItem>
                    <SelectItem value="selected">
                      <span className="flex items-center gap-1"><User className="h-3 w-3" /> Select attendees</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {!isNonEmail && (
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Subject</Label>
                  <Input value={subject} onChange={e => setSubject(e.target.value)} />
                </div>
              )}
            </div>

            {/* Attendee selection */}
            {recipientMode === "selected" && (
              <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-1">
                {attendees.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">No attendees added to this event yet.</p>
                )}
                {attendees.map(a => (
                  <label key={a.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                    <Checkbox
                      checked={selectedAttendeeIds.has(a.id)}
                      onCheckedChange={() => toggleAttendee(a.id)}
                    />
                    <span className="flex-1">{a.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {isNonEmail ? (a.mobile || "no phone") : a.email}
                    </span>
                  </label>
                ))}
              </div>
            )}

            {/* Info banner for SMS/WhatsApp */}
            {isNonEmail && (
              <p className="text-xs text-muted-foreground">
                {channel === "sms" ? "SMS" : "WhatsApp"} messages require attendee mobile numbers in E.164 format (example: +201234567890).
              </p>
            )}

            {/* Message + AI Draft */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Message</Label>
                <div className="flex items-center gap-1">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1 text-purple-600 border-purple-200 hover:bg-purple-50 dark:border-purple-800 dark:hover:bg-purple-950/30 h-7 text-xs" disabled={aiDrafting}>
                        {aiDrafting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                        Draft with AI
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-1" align="end">
                      {AI_DRAFT_TYPES.map((t) => (
                        <button key={t.value} onClick={() => handleAiDraft(t.value)} className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-muted transition-colors">
                          {t.label}
                        </button>
                      ))}
                    </PopoverContent>
                  </Popover>
                  <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs" onClick={handleBestTime} disabled={bestTimeLoading}>
                    {bestTimeLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Clock className="h-3 w-3" />}
                    💡 Best send time
                  </Button>
                </div>
              </div>
              {bestTimeResult && (
                <p className="text-xs text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/20 rounded px-2 py-1">
                  📅 <strong>{bestTimeResult.recommendedTime}</strong> — {bestTimeResult.reason}
                </p>
              )}
              <Textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} />
            </div>

            <div className="flex items-center gap-3">
              <Button
                size="sm"
                className="gap-1 gradient-titan border-0 text-primary-foreground"
                onClick={send}
                disabled={sending || !message.trim()}
              >
                <Send className="h-4 w-4" /> {sending ? "Sending..." : "Send"}
              </Button>
              <span className="text-xs text-muted-foreground">
                {recipientMode === "all"
                  ? `To ${attendees.length} attendee(s)`
                  : `To ${selectedAttendeeIds.size} selected`}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Log */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Communication Log</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map(l => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs">{format(new Date(l.created_at), "PPp")}</TableCell>
                  <TableCell><Badge variant="outline">{l.channel}</Badge></TableCell>
                  <TableCell className="text-xs">{l.recipient_info || "—"}</TableCell>
                  <TableCell className="text-sm">{l.subject || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={l.status === "sent" ? "default" : l.status === "failed" ? "destructive" : "secondary"}>
                      {l.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">No communications yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default CommunicationsSection;

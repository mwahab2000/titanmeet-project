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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEventWorkspace } from "@/contexts/EventWorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Send, Users, User, Sparkles, Loader2, Clock, ChevronDown,
  Mail, CheckCircle2, Eye, MessageSquare, Link2, UserPlus,
  BarChart3, Inbox,
} from "lucide-react";
import { InboxTab } from "@/components/comms/InboxTab";
import { format } from "date-fns";
import { callAi, type CommsDraftResult, type BestSendTimeResult } from "@/lib/ai-api";
import { SectionHint } from "@/components/ui/section-hint";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { PlanLimitGate } from "@/components/billing/PlanLimitGate";
import { useUpgradeModal } from "@/hooks/useUpgradeModal";
import {
  listEventInvites,
  generateEventInvites,
  sendEventInvitations,
  type EventInvite,
  type SendChannel,
} from "@/lib/event-invite-api";

/* ─── Types ─── */
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

/* ─── Small Sub-components ─── */
function SummaryCard({ icon: Icon, label, value }: { icon: any; label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <Icon className="h-5 w-5 text-primary" />
        <div>
          <p className="text-2xl font-bold font-display">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function InviteStatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: "default" | "secondary" | "outline"; label: string }> = {
    created: { variant: "outline", label: "Created" },
    sent: { variant: "secondary", label: "Sent" },
    opened: { variant: "secondary", label: "Opened" },
    rsvp_yes: { variant: "default", label: "RSVP Yes" },
    rsvp_no: { variant: "outline", label: "RSVP No" },
    maybe: { variant: "secondary", label: "Maybe" },
  };
  const cfg = map[status] || { variant: "outline" as const, label: status };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

/* ─── Main Component ─── */
const CommunicationsSection = () => {
  const { event, isArchived } = useEventWorkspace();
  const planLimits = usePlanLimits();
  const { openUpgradeModal } = useUpgradeModal();

  /* Communications state */
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

  /* Invitations state */
  const [invites, setInvites] = useState<EventInvite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(true);
  const [invFilter, setInvFilter] = useState("all");
  const [invSearch, setInvSearch] = useState("");
  const [invSending, setInvSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedChannels, setSelectedChannels] = useState<SendChannel[]>(["email"]);
  const [rowSending, setRowSending] = useState<Record<string, "email" | "whatsapp" | null>>({});

  const AI_DRAFT_TYPES = [
    { value: "invitation", label: "Invitation" },
    { value: "reminder_3day", label: "Reminder (3 days before)" },
    { value: "day_of", label: "Day-of reminder" },
    { value: "thank_you", label: "Post-event thank you" },
    { value: "cancellation", label: "Cancellation notice" },
  ];

  /* ─── Data loading ─── */
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

  const loadInvites = useCallback(async () => {
    if (!event) return;
    setInvitesLoading(true);
    try {
      setInvites(await listEventInvites(event.id));
    } catch {
      toast.error("Failed to load invitations");
    }
    setInvitesLoading(false);
  }, [event?.id]);

  useEffect(() => {
    loadLogs();
    loadAttendees();
    loadInvites();
  }, [loadLogs, loadAttendees, loadInvites]);

  /* ─── Communications handlers ─── */
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

  const sendComms = async () => {
    if (!event || !message.trim()) return;
    if (channel === "email") {
      if (!planLimits.canCreate("emails")) {
        openUpgradeModal("emails");
        return;
      } else if (planLimits.emails.percent >= 80) {
        toast.warning(`You've used ${planLimits.emails.percent}% of your monthly email limit.`);
      }
    }
    const recipients = getRecipients();
    if (recipients.length === 0) { toast.error("No recipients selected"); return; }
    const isNonEmail = channel !== "email";
    if (isNonEmail) {
      const invalidPhone = recipients.filter(r => !r.mobile || !isE164(r.mobile));
      if (invalidPhone.length > 0) {
        toast.error(`Invalid phone format for ${invalidPhone.length} attendee(s). Use E.164 format (example: +201234567890).`);
        return;
      }
    }
    setSending(true);
    let successCount = 0;
    let failCount = 0;
    for (const recipient of recipients) {
      const to = channel === "email" ? recipient.email : normalizePhone(recipient.mobile);
      const recipientInfo = `${recipient.name} (${to})`;
      const { data: logRow, error: logError } = await supabase
        .from("communications_log")
        .insert({ event_id: event.id, channel, subject: channel === "email" ? subject || null : null, message, status: "queued", attendee_id: recipient.id, recipient_info: recipientInfo } as any)
        .select("id")
        .single();
      if (logError) { failCount++; continue; }
      const { error: fnError } = await supabase.functions.invoke("send-communication", {
        body: { channel, to, message, subject: channel === "email" ? subject || "" : undefined, event_id: event.id, log_id: (logRow as any).id },
      });
      if (fnError) failCount++; else successCount++;
    }
    setSending(false);
    if (successCount > 0) toast.success(`${successCount} message(s) sent`);
    if (failCount > 0) toast.error(`${failCount} message(s) failed`);
    setSubject("");
    setMessage("");
    loadLogs();
  };

  /* ─── Invitations handlers ─── */
  const handleGenerate = async () => {
    if (!event) return;
    setGenerating(true);
    try {
      const count = await generateEventInvites(event.id);
      toast.success(`${count} new invitation(s) generated`);
      loadInvites();
    } catch { toast.error("Failed to generate invitations"); }
    setGenerating(false);
  };

  const handleSendAll = async () => {
    if (!event || selectedChannels.length === 0) { toast.error("Select at least one channel"); return; }
    setInvSending(true);
    try {
      const result = await sendEventInvitations(event.id, selectedChannels);
      const parts: string[] = [];
      if (result.sent_email > 0) parts.push(`${result.sent_email} email(s)`);
      if (result.sent_whatsapp > 0) parts.push(`${result.sent_whatsapp} WhatsApp`);
      if (result.failed_email > 0) parts.push(`${result.failed_email} email failed`);
      if (result.failed_whatsapp > 0) parts.push(`${result.failed_whatsapp} WhatsApp failed`);
      if (result.skipped_no_phone > 0) parts.push(`${result.skipped_no_phone} skipped (no phone)`);
      if (result.skipped_no_email > 0) parts.push(`${result.skipped_no_email} skipped (no email)`);
      toast.success(`Sent: ${parts.join(", ") || "0"}`);
      loadInvites();
    } catch { toast.error("Failed to send invitations"); }
    setInvSending(false);
  };

  const handleSendSingle = async (attendeeId: string, ch: SendChannel) => {
    if (!event) return;
    setRowSending(prev => ({ ...prev, [attendeeId]: ch }));
    try {
      const result = await sendEventInvitations(event.id, [ch], [attendeeId]);
      if (ch === "email" && result.sent_email > 0) toast.success("Email invite sent");
      else if (ch === "whatsapp" && result.sent_whatsapp > 0) toast.success("WhatsApp invite sent");
      else if (ch === "email" && result.skipped_no_email > 0) toast.error("No email address for this attendee");
      else if (ch === "whatsapp" && result.skipped_no_phone > 0) toast.error("No WhatsApp number for this attendee");
      else toast.error("Failed to send");
      loadInvites();
    } catch { toast.error(`Failed to send via ${ch}`); }
    setRowSending(prev => ({ ...prev, [attendeeId]: null }));
  };

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/i/${token}`);
    toast.success("Invitation link copied");
  };

  const toggleChannel = (ch: SendChannel) => {
    setSelectedChannels(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]);
  };

  if (!event) return null;

  const isNonEmail = channel !== "email";

  /* Invite stats */
  const invStats = {
    total: invites.length,
    sent: invites.filter(i => ["sent", "opened", "rsvp_yes", "rsvp_no", "maybe"].includes(i.status)).length,
    opened: invites.filter(i => !!i.opened_at).length,
    rsvpd: invites.filter(i => i.attendee_confirmed).length,
  };

  const filteredInvites = invites
    .filter(inv => {
      if (invFilter === "rsvp") return inv.attendee_confirmed;
      if (invFilter === "pending") return !inv.attendee_confirmed;
      if (invFilter === "opened") return inv.status === "opened";
      if (invFilter === "not_sent") return inv.status === "created";
      return true;
    })
    .filter(inv => {
      if (!invSearch) return true;
      const q = invSearch.toLowerCase();
      return inv.attendee_name?.toLowerCase().includes(q) || inv.attendee_email?.toLowerCase().includes(q);
    });

  const emailsRemaining = planLimits.emails.limit === Infinity
    ? "∞"
    : Math.max(0, planLimits.emails.limit - planLimits.emails.used);

  return (
    <div className="space-y-6">
      {invites.length === 0 && logs.length === 0 && (
        <SectionHint
          sectionKey="communications-center"
          title="Communications Center"
          description="Manage invitations, send bulk messages, and track all communications from one place."
        />
      )}

      {/* ─── Summary Stats ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard icon={Send} label="Invitations Sent" value={invStats.sent} />
        <SummaryCard icon={CheckCircle2} label="RSVP Confirmed" value={invStats.rsvpd} />
        <SummaryCard icon={MessageSquare} label="Messages Sent" value={logs.filter(l => l.status === "sent").length} />
        <SummaryCard icon={Mail} label="Emails Remaining" value={emailsRemaining} />
      </div>

      {/* ─── Tabs ─── */}
      <Tabs defaultValue="invitations">
        <TabsList>
          <TabsTrigger value="invitations">Invitations & RSVP</TabsTrigger>
          <TabsTrigger value="messages">Messages & Updates</TabsTrigger>
          <TabsTrigger value="log">Message Log</TabsTrigger>
          <TabsTrigger value="inbox" className="gap-1"><Inbox className="h-3.5 w-3.5" /> Inbox</TabsTrigger>
        </TabsList>

        {/* ═══ TAB 1: Invitations & RSVP ═══ */}
        <TabsContent value="invitations" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="font-display text-base font-semibold">Event Invitations</h3>
            {!isArchived && (
              <Button size="sm" className="gap-1" onClick={handleGenerate} disabled={generating}>
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Generate Invites
              </Button>
            )}
          </div>

          {/* Invite stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard icon={Users} label="Total Invites" value={invStats.total} />
            <SummaryCard icon={Mail} label="Sent" value={invStats.sent} />
            <SummaryCard icon={Eye} label="Opened" value={invStats.opened} />
            <SummaryCard icon={CheckCircle2} label="RSVP'd" value={invStats.rsvpd} />
          </div>

          {/* Send sub-section */}
          <Tabs defaultValue="inv-send">
            <TabsList>
              <TabsTrigger value="inv-send">Send</TabsTrigger>
              <TabsTrigger value="inv-tracking">Tracking</TabsTrigger>
            </TabsList>

            <TabsContent value="inv-send" className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Delivery Channels</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={selectedChannels.includes("email")} onCheckedChange={() => toggleChannel("email")} />
                      <Mail className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Email</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={selectedChannels.includes("whatsapp")} onCheckedChange={() => toggleChannel("whatsapp")} />
                      <MessageSquare className="h-4 w-4 text-accent-foreground" />
                      <span className="text-sm font-medium">WhatsApp</span>
                    </label>
                  </div>
                  {selectedChannels.includes("whatsapp") && (
                    <p className="text-xs text-muted-foreground">WhatsApp requires attendees to have a phone number with country code (e.g., +966...).</p>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" className="gap-1" onClick={handleSendAll} disabled={invSending || selectedChannels.length === 0 || isArchived}>
                      {invSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Send Invitations
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="inv-tracking" className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Input placeholder="Search attendee…" value={invSearch} onChange={e => setInvSearch(e.target.value)} className="max-w-xs" />
                <Button variant={invFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setInvFilter("all")}>All</Button>
                <Button variant={invFilter === "rsvp" ? "default" : "outline"} size="sm" onClick={() => setInvFilter("rsvp")}>RSVP'd</Button>
                <Button variant={invFilter === "pending" ? "default" : "outline"} size="sm" onClick={() => setInvFilter("pending")}>Pending</Button>
                <Button variant={invFilter === "opened" ? "default" : "outline"} size="sm" onClick={() => setInvFilter("opened")}>Opened</Button>
                <Button variant={invFilter === "not_sent" ? "default" : "outline"} size="sm" onClick={() => setInvFilter("not_sent")}>Not Sent</Button>
              </div>

              {invitesLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (
                <div className="border border-border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Attendee</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead className="text-center"><div className="flex items-center gap-1 justify-center"><Mail className="h-3.5 w-3.5" /> Email</div></TableHead>
                        <TableHead className="text-center"><div className="flex items-center gap-1 justify-center"><MessageSquare className="h-3.5 w-3.5" /> WA</div></TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Opened</TableHead>
                        <TableHead>RSVP</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInvites.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                            {invites.length === 0 ? 'Click "Generate Invites" to create invitation links for attendees.' : "No matching invitations."}
                          </TableCell>
                        </TableRow>
                      )}
                      {filteredInvites.map(inv => (
                        <TableRow key={inv.id}>
                          <TableCell className="font-medium">{inv.attendee_name}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{inv.attendee_email}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{inv.attendee_mobile || "—"}</TableCell>
                          <TableCell className="text-center">
                            {inv.sent_via_email ? (
                              <span className="text-xs text-green-600" title={inv.email_sent_at ? format(new Date(inv.email_sent_at), "MMM d HH:mm") : ""}>
                                ✓ {inv.email_sent_at ? format(new Date(inv.email_sent_at), "MMM d") : ""}
                              </span>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-center">
                            {inv.sent_via_whatsapp ? (
                              <span className="text-xs text-green-600" title={inv.whatsapp_sent_at ? format(new Date(inv.whatsapp_sent_at), "MMM d HH:mm") : ""}>
                                ✓ {inv.whatsapp_sent_at ? format(new Date(inv.whatsapp_sent_at), "MMM d") : ""}
                              </span>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell><InviteStatusBadge status={inv.status} /></TableCell>
                          <TableCell className="text-sm text-muted-foreground">{inv.opened_at ? format(new Date(inv.opened_at), "MMM d, HH:mm") : "—"}</TableCell>
                          <TableCell>
                            {inv.attendee_confirmed ? <Badge variant="default" className="text-xs">Confirmed</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyLink(inv.token)} title="Copy invitation link">
                                <Link2 className="h-3.5 w-3.5" />
                              </Button>
                              {!isArchived && (
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleSendSingle(inv.attendee_id, "email")} disabled={!inv.attendee_email || rowSending[inv.attendee_id] === "email"} title={inv.attendee_email ? "Send invite by email" : "No email address"}>
                                  {rowSending[inv.attendee_id] === "email" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                                </Button>
                              )}
                              {!isArchived && (
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleSendSingle(inv.attendee_id, "whatsapp")} disabled={!inv.attendee_mobile || rowSending[inv.attendee_id] === "whatsapp"} title={inv.attendee_mobile ? "Send invite by WhatsApp" : "No WhatsApp number"}>
                                  {rowSending[inv.attendee_id] === "whatsapp" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <img src="/images/whatsapp-icon.svg" alt="WhatsApp" className="h-3.5 w-3.5" />}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ═══ TAB 2: Messages & Updates ═══ */}
        <TabsContent value="messages" className="space-y-4">
          {!isArchived && (
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-base">Send Communication</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
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
                        <SelectItem value="all"><span className="flex items-center gap-1"><Users className="h-3 w-3" /> All attendees</span></SelectItem>
                        <SelectItem value="selected"><span className="flex items-center gap-1"><User className="h-3 w-3" /> Select attendees</span></SelectItem>
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

                {recipientMode === "selected" && (
                  <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-1">
                    {attendees.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No attendees added to this event yet.</p>}
                    {attendees.map(a => (
                      <label key={a.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                        <Checkbox checked={selectedAttendeeIds.has(a.id)} onCheckedChange={() => toggleAttendee(a.id)} />
                        <span className="flex-1">{a.name}</span>
                        <span className="text-xs text-muted-foreground">{isNonEmail ? (a.mobile || "no phone") : a.email}</span>
                      </label>
                    ))}
                  </div>
                )}

                {isNonEmail && (
                  <p className="text-xs text-muted-foreground">
                    {channel === "sms" ? "SMS" : "WhatsApp"} messages require attendee mobile numbers in E.164 format (example: +201234567890).
                  </p>
                )}

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
                          {AI_DRAFT_TYPES.map(t => (
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
                  <Button size="sm" className="gap-1 gradient-titan border-0 text-primary-foreground" onClick={sendComms} disabled={sending || !message.trim()}>
                    <Send className="h-4 w-4" /> {sending ? "Sending..." : "Send"}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {recipientMode === "all" ? `To ${attendees.length} attendee(s)` : `To ${selectedAttendeeIds.size} selected`}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══ TAB 3: Message Log ═══ */}
        <TabsContent value="log" className="space-y-4">
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
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CommunicationsSection;

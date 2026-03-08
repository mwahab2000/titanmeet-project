import { useState, useEffect, useCallback } from "react";
import { useEventWorkspace } from "@/contexts/EventWorkspaceContext";
import {
  listEventInvites,
  generateEventInvites,
  sendEventInvitations,
  type EventInvite,
  type SendChannel,
} from "@/lib/event-invite-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Send, Link2, Users, Mail, CheckCircle2, Eye, Loader2,
  MessageSquare, Phone, UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const InvitationsSection = () => {
  const { event, isArchived } = useEventWorkspace();
  const [invites, setInvites] = useState<EventInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedChannels, setSelectedChannels] = useState<SendChannel[]>(["email"]);
  const [rowSending, setRowSending] = useState<Record<string, "email" | "whatsapp" | null>>({});

  const loadInvites = useCallback(async () => {
    if (!event) return;
    setLoading(true);
    try {
      setInvites(await listEventInvites(event.id));
    } catch {
      toast.error("Failed to load invitations");
    }
    setLoading(false);
  }, [event?.id]);

  useEffect(() => { loadInvites(); }, [loadInvites]);

  const handleGenerate = async () => {
    if (!event) return;
    setGenerating(true);
    try {
      const count = await generateEventInvites(event.id);
      toast.success(`${count} new invitation(s) generated`);
      loadInvites();
    } catch {
      toast.error("Failed to generate invitations");
    }
    setGenerating(false);
  };

  const handleSendAll = async () => {
    if (!event || selectedChannels.length === 0) {
      toast.error("Select at least one channel");
      return;
    }
    setSending(true);
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
    } catch {
      toast.error("Failed to send invitations");
    }
    setSending(false);
  };

  const handleResend = async (attendeeId: string) => {
    if (!event || selectedChannels.length === 0) return;
    try {
      await sendEventInvitations(event.id, selectedChannels, [attendeeId]);
      toast.success("Resent");
      loadInvites();
    } catch {
      toast.error("Failed to resend");
    }
  };

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/i/${token}`);
    toast.success("Invitation link copied");
  };

  const toggleChannel = (ch: SendChannel) => {
    setSelectedChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
  };

  if (!event) return null;

  const filteredInvites = invites
    .filter((inv) => {
      if (filter === "rsvp") return inv.attendee_confirmed;
      if (filter === "pending") return !inv.attendee_confirmed;
      if (filter === "opened") return inv.status === "opened";
      if (filter === "not_sent") return inv.status === "created";
      return true;
    })
    .filter((inv) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return inv.attendee_name?.toLowerCase().includes(q) || inv.attendee_email?.toLowerCase().includes(q);
    });

  const statusCounts = {
    total: invites.length,
    sent: invites.filter((i) => ["sent", "opened", "rsvp_yes", "rsvp_no", "maybe"].includes(i.status)).length,
    opened: invites.filter((i) => !!i.opened_at).length,
    rsvpd: invites.filter((i) => i.attendee_confirmed).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-display text-lg font-semibold">Event Invitations</h2>
        {!isArchived && (
          <Button size="sm" className="gap-1" onClick={handleGenerate} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Generate Invites
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatsCard icon={Users} label="Total Invites" value={statusCounts.total} />
        <StatsCard icon={Mail} label="Sent" value={statusCounts.sent} />
        <StatsCard icon={Eye} label="Opened" value={statusCounts.opened} />
        <StatsCard icon={CheckCircle2} label="RSVP'd" value={statusCounts.rsvpd} />
      </div>

      <Tabs defaultValue="send">
        <TabsList>
          <TabsTrigger value="send">Send</TabsTrigger>
          <TabsTrigger value="tracking">Tracking</TabsTrigger>
        </TabsList>

        {/* ── Send Tab ── */}
        <TabsContent value="send" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Delivery Channels</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={selectedChannels.includes("email")}
                    onCheckedChange={() => toggleChannel("email")}
                  />
                  <Mail className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Email</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={selectedChannels.includes("whatsapp")}
                    onCheckedChange={() => toggleChannel("whatsapp")}
                  />
                  <MessageSquare className="h-4 w-4 text-accent-foreground" />
                  <span className="text-sm font-medium">WhatsApp</span>
                </label>
              </div>

              {selectedChannels.includes("whatsapp") && (
                <p className="text-xs text-muted-foreground">
                  WhatsApp requires attendees to have a phone number with country code (e.g., +966...).
                </p>
              )}

              <div className="flex gap-2">
                <Button size="sm" className="gap-1" onClick={handleSendAll} disabled={sending || selectedChannels.length === 0 || isArchived}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send Invitations
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tracking Tab ── */}
        <TabsContent value="tracking" className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Input placeholder="Search attendee…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
            <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>All</Button>
            <Button variant={filter === "rsvp" ? "default" : "outline"} size="sm" onClick={() => setFilter("rsvp")}>RSVP'd</Button>
            <Button variant={filter === "pending" ? "default" : "outline"} size="sm" onClick={() => setFilter("pending")}>Pending</Button>
            <Button variant={filter === "opened" ? "default" : "outline"} size="sm" onClick={() => setFilter("opened")}>Opened</Button>
            <Button variant={filter === "not_sent" ? "default" : "outline"} size="sm" onClick={() => setFilter("not_sent")}>Not Sent</Button>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="border border-border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Attendee</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-center">
                      <div className="flex items-center gap-1 justify-center"><Mail className="h-3.5 w-3.5" /> Email</div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div className="flex items-center gap-1 justify-center"><MessageSquare className="h-3.5 w-3.5" /> WA</div>
                    </TableHead>
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
                  {filteredInvites.map((inv) => (
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
                      <TableCell>
                        <InviteStatusBadge status={inv.status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {inv.opened_at ? format(new Date(inv.opened_at), "MMM d, HH:mm") : "—"}
                      </TableCell>
                      <TableCell>
                        {inv.attendee_confirmed ? (
                          <Badge variant="default" className="text-xs">Confirmed</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyLink(inv.token)} title="Copy link">
                            <Link2 className="h-3.5 w-3.5" />
                          </Button>
                          {!inv.attendee_confirmed && !isArchived && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleResend(inv.attendee_id)} title="Resend">
                              <Send className="h-3.5 w-3.5" />
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
    </div>
  );
};

function StatsCard({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
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

export default InvitationsSection;

import { useState, useEffect, useCallback } from "react";
import { useEventWorkspace } from "@/contexts/EventWorkspaceContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  listCampaigns, createCampaign, sendCampaign, getConfirmationStats,
  type CampaignWithStats, type CampaignType, type Channel, type ConfirmationStats,
} from "@/lib/campaign-api";
import {
  Plus, Send, Mail, MessageSquare, CheckCircle2, Clock, AlertTriangle,
  Loader2, RefreshCw, Users, Eye,
} from "lucide-react";

const campaignTypeLabels: Record<CampaignType, string> = {
  invitation: "Invitation",
  attendance_confirmation: "Confirmation Request",
  reminder: "Reminder",
  check_in: "Check-in",
  follow_up: "Follow-up",
};

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  scheduled: "secondary",
  sending: "default",
  completed: "default",
  failed: "destructive",
};

export function CampaignsView() {
  const { event } = useEventWorkspace();
  const [campaigns, setCampaigns] = useState<CampaignWithStats[]>([]);
  const [confirmStats, setConfirmStats] = useState<ConfirmationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  // Create form state
  const [newType, setNewType] = useState<CampaignType>("invitation");
  const [newChannels, setNewChannels] = useState<Channel[]>(["email"]);
  const [newSegment, setNewSegment] = useState<string>("all");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!event) return;
    setLoading(true);
    try {
      const [camps, stats] = await Promise.all([
        listCampaigns(event.id),
        getConfirmationStats(event.id),
      ]);
      setCampaigns(camps);
      setConfirmStats(stats);
    } catch (err) {
      console.error("Failed to load campaigns:", err);
    } finally {
      setLoading(false);
    }
  }, [event?.id]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!event) return;
    setCreating(true);
    try {
      await createCampaign({
        event_id: event.id,
        campaign_type: newType,
        channels: newChannels,
        audience_filter: newSegment !== "all" ? { segment: newSegment } : {},
      });
      toast.success("Campaign created");
      setShowCreate(false);
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to create campaign");
    } finally {
      setCreating(false);
    }
  };

  const handleSend = async (campaign: CampaignWithStats) => {
    if (!event) return;
    setSendingId(campaign.id);
    try {
      const result = await sendCampaign(campaign.id, event.id);
      toast.success(`Sent: ${result.sent_email} emails, ${result.sent_whatsapp} WhatsApp`);
      load();
    } catch (err: any) {
      toast.error(err.message || "Send failed");
    } finally {
      setSendingId(null);
    }
  };

  const toggleChannel = (ch: Channel) => {
    setNewChannels(prev =>
      prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]
    );
  };

  if (!event) return null;

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 overflow-y-auto h-full">
      {/* Confirmation Stats */}
      {confirmStats && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" /> Attendance Confirmation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <p className="text-xl font-bold">{confirmStats.invited}</p>
                <p className="text-[10px] text-muted-foreground">Invited</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-emerald-500/10">
                <p className="text-xl font-bold text-emerald-600">{confirmStats.confirmed}</p>
                <p className="text-[10px] text-muted-foreground">Confirmed</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-yellow-500/10">
                <p className="text-xl font-bold text-yellow-600">{confirmStats.pending}</p>
                <p className="text-[10px] text-muted-foreground">Pending</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-primary/10">
                <p className="text-xl font-bold text-primary">{confirmStats.confirmationRate}%</p>
                <p className="text-[10px] text-muted-foreground">Rate</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Mail className="h-3 w-3" /> Email: {confirmStats.byChannel.email.sent} sent, {confirmStats.byChannel.email.delivered} delivered
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MessageSquare className="h-3 w-3" /> WhatsApp: {confirmStats.byChannel.whatsapp.sent} sent, {confirmStats.byChannel.whatsapp.delivered} delivered
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Campaigns header */}
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-bold">Campaigns</h3>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1">
            <Plus className="h-3.5 w-3.5" /> New Campaign
          </Button>
        </div>
      </div>

      {/* Campaign list */}
      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            No campaigns yet. Create one to start sending communications.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {campaigns.map(campaign => (
            <Card key={campaign.id}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={statusVariants[campaign.status] || "outline"} className="text-[10px]">
                        {campaign.status}
                      </Badge>
                      <span className="text-sm font-medium">
                        {campaignTypeLabels[campaign.campaign_type as CampaignType] || campaign.campaign_type}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" /> {campaign.audience_count} recipients
                      </span>
                      {campaign.channels.includes("email") && (
                        <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> Email</span>
                      )}
                      {campaign.channels.includes("whatsapp") && (
                        <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> WhatsApp</span>
                      )}
                      <span>{format(new Date(campaign.created_at), "MMM d, HH:mm")}</span>
                    </div>

                    {campaign.status === "completed" && (
                      <div className="flex items-center gap-3 mt-1 text-xs">
                        <span className="text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> {campaign.stats.sent + campaign.stats.delivered} sent
                        </span>
                        {campaign.stats.failed > 0 && (
                          <span className="text-destructive flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> {campaign.stats.failed} failed
                          </span>
                        )}
                        {campaign.stats.opened > 0 && (
                          <span className="text-blue-500 flex items-center gap-1">
                            <Eye className="h-3 w-3" /> {campaign.stats.opened} opened
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {campaign.status === "draft" && (
                    <Button
                      size="sm"
                      variant="default"
                      className="gap-1 shrink-0"
                      disabled={sendingId === campaign.id}
                      onClick={() => handleSend(campaign)}
                    >
                      {sendingId === campaign.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      Send
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Campaign Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Campaign</DialogTitle>
            <DialogDescription>Create a communication campaign for this event.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Campaign Type</label>
              <Select value={newType} onValueChange={(v) => setNewType(v as CampaignType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="invitation">Invitation</SelectItem>
                  <SelectItem value="attendance_confirmation">Confirmation Request</SelectItem>
                  <SelectItem value="reminder">Reminder</SelectItem>
                  <SelectItem value="check_in">Check-in</SelectItem>
                  <SelectItem value="follow_up">Follow-up</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Channels</label>
              <div className="flex gap-2">
                <Button
                  variant={newChannels.includes("email") ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleChannel("email")}
                  className="gap-1"
                >
                  <Mail className="h-3.5 w-3.5" /> Email
                </Button>
                <Button
                  variant={newChannels.includes("whatsapp") ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleChannel("whatsapp")}
                  className="gap-1"
                >
                  <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
                </Button>
              </div>
              {newChannels.length === 0 && (
                <p className="text-xs text-destructive mt-1">Select at least one channel</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Audience</label>
              <Select value={newSegment} onValueChange={setNewSegment}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Attendees</SelectItem>
                  <SelectItem value="pending">Pending (Not Confirmed)</SelectItem>
                  <SelectItem value="confirmed">Confirmed Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={creating || newChannels.length === 0}
              className="gap-1"
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Create Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

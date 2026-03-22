import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useEventWorkspace } from "@/contexts/EventWorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { WhatsAppMetricsDashboard } from "@/components/comms/WhatsAppMetricsDashboard";
import { format } from "date-fns";
import {
  Send, Mail, MessageSquare, CheckCircle2, Eye, AlertTriangle,
  Inbox, ClipboardList, ArrowRight, RefreshCw, Loader2, QrCode,
} from "lucide-react";

interface CommsStats {
  totalInvitesSent: number;
  whatsappSent: number;
  whatsappDelivered: number;
  whatsappReplied: number;
  emailSent: number;
  emailOpened: number;
  emailReplied: number;
  rsvpConfirmed: number;
  rsvpPending: number;
  surveyLinksSent: number;
  surveyResponses: number;
  surveyCompletionRate: number;
  failedDeliveries: number;
  unresolvedInbound: number;
}

interface ActivityEntry {
  id: string;
  type: "outbound" | "inbound" | "rsvp";
  description: string;
  timestamp: string;
  channel?: string;
}

function StatCard({ icon: Icon, label, value, variant = "default" }: {
  icon: any; label: string; value: number | string;
  variant?: "default" | "success" | "warning" | "danger";
}) {
  const colorMap = {
    default: "text-primary",
    success: "text-emerald-500",
    warning: "text-yellow-500",
    danger: "text-destructive",
  };
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
      <Icon className={`h-4 w-4 ${colorMap[variant]} shrink-0`} />
      <div className="min-w-0">
        <p className="text-lg font-bold font-display leading-none">{value}</p>
        <p className="text-[10px] text-muted-foreground truncate mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export function CommsOverview({ onNavigate }: { onNavigate: (view: string) => void }) {
  const { event } = useEventWorkspace();
  const [stats, setStats] = useState<CommsStats | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    if (!event) return;
    setLoading(true);

    const [invitesRes, logsRes, inboundRes, surveyInvRes, surveyRespRes] = await Promise.all([
      supabase.from("event_invites").select("status, opened_at, rsvp_at, sent_via_email, sent_via_whatsapp, attendee_id").eq("event_id", event.id),
      supabase.from("message_logs").select("channel, status, created_at, attendee_id").eq("event_id", event.id).order("created_at", { ascending: false }),
      supabase.from("inbound_messages" as any).select("id, resolved_status").eq("event_id", event.id),
      supabase.from("survey_invites" as any).select("status").eq("event_id", event.id),
      supabase.from("survey_responses" as any).select("id").eq("event_id", event.id),
    ]);

    const invites = invitesRes.data || [];
    const logs = logsRes.data || [];
    const inbound = (inboundRes.data || []) as any[];
    const surveyInvites = (surveyInvRes.data || []) as any[];
    const surveyResponses = (surveyRespRes.data || []) as any[];

    const sentInvites = invites.filter(i => ["sent", "opened", "rsvp_yes", "rsvp_no", "maybe"].includes(i.status));
    const waLogs = logs.filter(l => l.channel === "whatsapp");
    const emailLogs = logs.filter(l => l.channel === "email");

    // Get attendees who confirmed
    const { data: attendees } = await supabase
      .from("attendees")
      .select("id, confirmed")
      .eq("event_id", event.id);
    const confirmed = (attendees || []).filter(a => a.confirmed).length;
    const pending = (attendees || []).length - confirmed;

    // Inbound replies count
    const inboundCount = inbound.length;

    const surveyTotal = surveyInvites.length;
    const surveySubmitted = surveyInvites.filter((s: any) => s.status === "submitted").length;

    setStats({
      totalInvitesSent: sentInvites.length,
      whatsappSent: waLogs.length,
      whatsappDelivered: waLogs.filter(l => ["delivered", "read", "sent"].includes(l.status)).length,
      whatsappReplied: inboundCount,
      emailSent: emailLogs.length,
      emailOpened: invites.filter(i => !!i.opened_at).length,
      emailReplied: 0,
      rsvpConfirmed: confirmed,
      rsvpPending: pending,
      surveyLinksSent: surveyTotal,
      surveyResponses: surveyResponses.length,
      surveyCompletionRate: surveyTotal > 0 ? Math.round((surveySubmitted / surveyTotal) * 100) : 0,
      failedDeliveries: logs.filter(l => l.status === "failed").length,
      unresolvedInbound: inbound.filter((m: any) => m.resolved_status !== "resolved").length,
    });

    // Recent activity
    const recentActivity: ActivityEntry[] = [];
    logs.slice(0, 10).forEach(l => {
      recentActivity.push({
        id: l.attendee_id + l.created_at,
        type: "outbound",
        description: `${l.channel} message ${l.status}`,
        timestamp: l.created_at,
        channel: l.channel,
      });
    });
    setActivity(recentActivity.slice(0, 10));
    setLoading(false);
  }, [event?.id]);

  useEffect(() => { loadStats(); }, [loadStats]);

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6 p-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">Communications Overview</h2>
        <Button variant="ghost" size="sm" className="gap-1" onClick={loadStats}>
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* Invitations & RSVP */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Invitations & RSVP</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <StatCard icon={Send} label="Invitations Sent" value={stats.totalInvitesSent} />
          <StatCard icon={CheckCircle2} label="RSVP Confirmed" value={stats.rsvpConfirmed} variant="success" />
          <StatCard icon={Eye} label="RSVP Pending" value={stats.rsvpPending} />
          <StatCard icon={AlertTriangle} label="Failed Deliveries" value={stats.failedDeliveries} variant={stats.failedDeliveries > 0 ? "danger" : "default"} />
        </div>
      </div>

      {/* Channel Performance */}
      <div className="grid md:grid-cols-2 gap-4">
        <WhatsAppMetricsDashboard />

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-500" /> Email
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              <StatCard icon={Send} label="Sent" value={stats.emailSent} />
              <StatCard icon={Eye} label="Opened" value={stats.emailOpened} variant="success" />
              <StatCard icon={Inbox} label="Replied" value={stats.emailReplied} />
              <StatCard icon={AlertTriangle} label="Failed" value={stats.failedDeliveries} variant={stats.failedDeliveries > 0 ? "danger" : "default"} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Survey Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-purple-500" /> Survey Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <StatCard icon={Send} label="Links Sent" value={stats.surveyLinksSent} />
            <StatCard icon={CheckCircle2} label="Responses" value={stats.surveyResponses} variant="success" />
            <StatCard icon={Eye} label="Completion" value={`${stats.surveyCompletionRate}%`} />
          </div>
          <Button variant="outline" size="sm" className="gap-1 w-full" asChild>
            <Link to={`/dashboard/events/${event?.id}/survey`}>
              View Survey Results <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
          ) : (
            <div className="space-y-2">
              {activity.map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                    {a.channel || a.type}
                  </Badge>
                  <span className="truncate text-muted-foreground">{a.description}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0 ml-auto">
                    {format(new Date(a.timestamp), "MMM d HH:mm")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* CTA Buttons */}
      <div className="grid grid-cols-3 gap-2">
        <Button variant="outline" size="sm" className="gap-1" onClick={() => onNavigate("inbox")}>
          <Inbox className="h-3.5 w-3.5" /> Open Inbox
        </Button>
        <Button variant="outline" size="sm" className="gap-1" asChild>
          <Link to={`/dashboard/events/${event?.id}/survey`}>
            <ClipboardList className="h-3.5 w-3.5" /> Survey Results
          </Link>
        </Button>
        <Button variant="outline" size="sm" className="gap-1" onClick={() => onNavigate("sent")}>
          <RefreshCw className="h-3.5 w-3.5" /> Resend Failed
        </Button>
      </div>
    </div>
  );
}

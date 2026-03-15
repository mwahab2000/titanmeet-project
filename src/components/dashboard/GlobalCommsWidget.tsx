import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Send, MessageSquare, Mail, CheckCircle2, AlertTriangle, Inbox } from "lucide-react";

interface GlobalCommsStats {
  whatsappSent: number;
  whatsappDelivered: number;
  whatsappReplyRate: number;
  emailSent: number;
  emailOpenRate: number;
  rsvpRate: number;
  surveyCompletionRate: number;
  failedCount: number;
  unresolvedInbound: number;
}

export function GlobalCommsWidget() {
  const { user } = useAuth();
  const [stats, setStats] = useState<GlobalCommsStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Get user's events
    const { data: events } = await supabase
      .from("events")
      .select("id")
      .eq("created_by", user.id);
    const eventIds = (events || []).map(e => e.id);

    if (eventIds.length === 0) {
      setStats({
        whatsappSent: 0, whatsappDelivered: 0, whatsappReplyRate: 0,
        emailSent: 0, emailOpenRate: 0, rsvpRate: 0,
        surveyCompletionRate: 0, failedCount: 0, unresolvedInbound: 0,
      });
      setLoading(false);
      return;
    }

    const [logsRes, inboundRes, invitesRes] = await Promise.all([
      supabase.from("message_logs").select("channel, status").in("event_id", eventIds),
      supabase.from("inbound_messages" as any).select("resolved_status").in("event_id", eventIds),
      supabase.from("event_invites").select("status, opened_at, attendee_id").in("event_id", eventIds),
    ]);

    const logs = logsRes.data || [];
    const inbound = (inboundRes.data || []) as any[];
    const invites = invitesRes.data || [];

    const waLogs = logs.filter(l => l.channel === "whatsapp");
    const emailLogs = logs.filter(l => l.channel === "email");
    const waDelivered = waLogs.filter(l => ["delivered", "read", "sent"].includes(l.status)).length;
    const emailOpened = invites.filter(i => !!i.opened_at).length;
    const sentInvites = invites.filter(i => ["sent", "opened", "rsvp_yes", "rsvp_no", "maybe"].includes(i.status));

    // Get confirmed attendees count
    const { count: confirmedCount } = await supabase
      .from("attendees")
      .select("id", { count: "exact", head: true })
      .in("event_id", eventIds)
      .eq("confirmed", true);

    const totalAttendees = invites.length;

    setStats({
      whatsappSent: waLogs.length,
      whatsappDelivered: waDelivered,
      whatsappReplyRate: waLogs.length > 0 ? Math.round((inbound.length / waLogs.length) * 100) : 0,
      emailSent: emailLogs.length,
      emailOpenRate: sentInvites.length > 0 ? Math.round((emailOpened / sentInvites.length) * 100) : 0,
      rsvpRate: totalAttendees > 0 ? Math.round(((confirmedCount || 0) / totalAttendees) * 100) : 0,
      surveyCompletionRate: 0,
      failedCount: logs.filter(l => l.status === "failed").length,
      unresolvedInbound: inbound.filter((m: any) => m.resolved_status !== "resolved").length,
    });
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="font-display text-sm">Communications Performance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {/* WhatsApp */}
          <div className="space-y-1.5 p-2.5 rounded-lg bg-muted/50">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-xs font-medium">WhatsApp</span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
              <span className="text-muted-foreground">Sent</span>
              <span className="font-medium text-right">{stats.whatsappSent}</span>
              <span className="text-muted-foreground">Delivered</span>
              <span className="font-medium text-right">{stats.whatsappDelivered}</span>
              <span className="text-muted-foreground">Reply Rate</span>
              <span className="font-medium text-right">{stats.whatsappReplyRate}%</span>
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5 p-2.5 rounded-lg bg-muted/50">
            <div className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-xs font-medium">Email</span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
              <span className="text-muted-foreground">Sent</span>
              <span className="font-medium text-right">{stats.emailSent}</span>
              <span className="text-muted-foreground">Open Rate</span>
              <span className="font-medium text-right">{stats.emailOpenRate}%</span>
              <span className="text-muted-foreground">RSVP Rate</span>
              <span className="font-medium text-right">{stats.rsvpRate}%</span>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {(stats.failedCount > 0 || stats.unresolvedInbound > 0) && (
          <div className="flex gap-2 flex-wrap">
            {stats.failedCount > 0 && (
              <Badge variant="destructive" className="text-[10px] gap-1">
                <AlertTriangle className="h-2.5 w-2.5" /> {stats.failedCount} failed
              </Badge>
            )}
            {stats.unresolvedInbound > 0 && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <Inbox className="h-2.5 w-2.5" /> {stats.unresolvedInbound} unresolved
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

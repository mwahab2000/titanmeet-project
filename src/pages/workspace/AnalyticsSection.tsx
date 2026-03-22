import { useEffect, useState, useMemo } from "react";
import { useEventWorkspace } from "@/contexts/EventWorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, UserCheck, UserX, MailOpen, ClipboardCheck,
  Clock, Activity, RefreshCw, Radio,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { cn } from "@/lib/utils";

interface AnalyticsData {
  totalInvited: number;
  confirmed: number;
  declined: number;
  pending: number;
  checkedIn: number;
  noShow: number;
  messagesSent: number;
  messagesDelivered: number;
  messagesOpened: number;
  surveysSent: number;
  surveysCompleted: number;
  checkinTimeline: { hour: string; count: number }[];
  rsvpTimeline: { date: string; confirmed: number; total: number }[];
  messageFunnel: { stage: string; count: number }[];
  insights: { text: string; type: "info" | "warning" | "success" }[];
}

const COLORS = {
  primary: "hsl(var(--primary))",
  green: "hsl(142 71% 45%)",
  red: "hsl(0 84% 60%)",
  yellow: "hsl(48 96% 53%)",
  muted: "hsl(var(--muted-foreground))",
};

const PIE_COLORS = [COLORS.green, COLORS.red, COLORS.yellow, COLORS.muted];

function StatCard({ icon: Icon, label, value, sub, accent }: {
  icon: typeof Users; label: string; value: string | number; sub?: string; accent?: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
            <p className={cn("text-2xl sm:text-3xl font-display font-bold mt-1", accent)}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const AnalyticsSection = () => {
  const { event } = useEventWorkspace();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [liveMode, setLiveMode] = useState(false);

  const isLiveEvent = event?.status === "published" || event?.status === "ongoing";

  const fetchAnalytics = async () => {
    if (!event) return;
    setLoading(true);

    try {
      const [
        { data: attendees },
        { data: invites },
        { data: messages },
        { data: surveyInvites },
        { data: surveyResponses },
      ] = await Promise.all([
        supabase.from("attendees").select("id, confirmed, confirmed_at, checked_in_at").eq("event_id", event.id),
        supabase.from("event_invites").select("id, status, opened_at, rsvp_at").eq("event_id", event.id),
        supabase.from("message_logs").select("id, status, channel").eq("event_id", event.id),
        supabase.from("survey_invites" as any).select("id, status").eq("event_id", event.id),
        supabase.from("survey_responses" as any).select("id").eq("event_id", event.id),
      ]);

      const att = attendees || [];
      const inv = invites || [];
      const msgs = messages || [];
      const si = (surveyInvites || []) as any[];
      const sr = (surveyResponses || []) as any[];

      const totalInvited = att.length;
      const confirmed = att.filter(a => a.confirmed).length;
      const checkedIn = att.filter(a => a.checked_in_at).length;
      const noShow = confirmed > 0 ? confirmed - checkedIn : 0;
      const declined = inv.filter(i => i.status === "declined").length;
      const pending = totalInvited - confirmed - declined;

      const messagesSent = msgs.filter(m => ["sent", "delivered", "read"].includes(m.status)).length;
      const messagesDelivered = msgs.filter(m => ["delivered", "read"].includes(m.status)).length;
      const messagesOpened = inv.filter(i => i.opened_at).length;

      const surveysSent = si.length;
      const surveysCompleted = sr.length;

      // Message performance funnel
      const messageFunnel = [
        { stage: "Sent", count: messagesSent },
        { stage: "Delivered", count: messagesDelivered },
        { stage: "Opened", count: messagesOpened },
        { stage: "RSVP'd", count: confirmed },
      ];

      // Auto-generate insights
      const insights: { text: string; type: "info" | "warning" | "success" }[] = [];
      const rsvpRate = totalInvited > 0 ? (confirmed / totalInvited) * 100 : 0;
      const attendanceRate = confirmed > 0 ? (checkedIn / confirmed) * 100 : 0;
      const noShowPct = confirmed > 0 ? (noShow / confirmed) * 100 : 0;

      if (noShowPct > 25) insights.push({ text: `High no-show rate (${Math.round(noShowPct)}%) — consider sending reminders closer to the event.`, type: "warning" });
      else if (noShowPct > 0 && noShowPct <= 10) insights.push({ text: `Excellent no-show rate — only ${Math.round(noShowPct)}% absent.`, type: "success" });
      if (rsvpRate < 40 && totalInvited > 5) insights.push({ text: `Low RSVP conversion (${Math.round(rsvpRate)}%) — try a follow-up message.`, type: "warning" });
      else if (rsvpRate >= 70) insights.push({ text: `Strong RSVP rate at ${Math.round(rsvpRate)}%.`, type: "success" });
      if (checkedIn > 0) {
        const peakHour = Object.entries(
          att.filter(a => a.checked_in_at).reduce((acc: Record<string, number>, a) => {
            const h = new Date(a.checked_in_at!).getHours();
            const label = `${h.toString().padStart(2, "0")}:00`;
            acc[label] = (acc[label] || 0) + 1;
            return acc;
          }, {})
        ).sort(([, a], [, b]) => b - a)[0];
        if (peakHour) insights.push({ text: `Peak check-in time: ${peakHour[0]} (${peakHour[1]} arrivals).`, type: "info" });
      }
      if (messagesSent > 0 && messagesOpened === 0) insights.push({ text: "No messages opened yet — check delivery status.", type: "warning" });
      if (attendanceRate >= 80 && confirmed >= 10) insights.push({ text: `Great attendance rate (${Math.round(attendanceRate)}%) — well done!`, type: "success" });

      // Check-in time distribution
      const checkinHours: Record<string, number> = {};
      att.filter(a => a.checked_in_at).forEach(a => {
        const h = new Date(a.checked_in_at!).getHours();
        const label = `${h.toString().padStart(2, "0")}:00`;
        checkinHours[label] = (checkinHours[label] || 0) + 1;
      });
      const checkinTimeline = Object.entries(checkinHours)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([hour, count]) => ({ hour, count }));

      // RSVP timeline by date
      const rsvpByDate: Record<string, { confirmed: number; total: number }> = {};
      att.forEach(a => {
        if (a.confirmed_at) {
          const d = new Date(a.confirmed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
          if (!rsvpByDate[d]) rsvpByDate[d] = { confirmed: 0, total: 0 };
          rsvpByDate[d].confirmed += 1;
          rsvpByDate[d].total += 1;
        }
      });
      const rsvpTimeline = Object.entries(rsvpByDate)
        .map(([date, v]) => ({ date, ...v }));

      setData({
        totalInvited, confirmed, declined, pending,
        checkedIn, noShow, messagesSent, messagesDelivered, messagesOpened,
        surveysSent, surveysCompleted, checkinTimeline, rsvpTimeline,
        messageFunnel, insights,
      });
    } catch (err) {
      console.error("Analytics fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAnalytics(); }, [event?.id]);

  // Live mode: poll every 30s
  useEffect(() => {
    if (!liveMode || !isLiveEvent) return;
    const interval = setInterval(fetchAnalytics, 30_000);
    return () => clearInterval(interval);
  }, [liveMode, event?.id]);

  // Also subscribe to realtime attendee changes when live
  useEffect(() => {
    if (!liveMode || !event?.id) return;
    const channel = supabase
      .channel(`analytics-${event.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "attendees", filter: `event_id=eq.${event.id}` }, () => {
        fetchAnalytics();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [liveMode, event?.id]);

  const rsvpRate = data && data.totalInvited > 0 ? Math.round((data.confirmed / data.totalInvited) * 100) : 0;
  const attendanceRate = data && data.confirmed > 0 ? Math.round((data.checkedIn / data.confirmed) * 100) : 0;
  const noShowPct = data && data.confirmed > 0 ? Math.round((data.noShow / data.confirmed) * 100) : 0;
  const openRate = data && data.messagesSent > 0 ? Math.round((data.messagesOpened / data.messagesSent) * 100) : 0;
  const surveyRate = data && data.surveysSent > 0 ? Math.round((data.surveysCompleted / data.surveysSent) * 100) : 0;

  const pieData = useMemo(() => {
    if (!data) return [];
    return [
      { name: "Confirmed", value: data.confirmed },
      { name: "Declined", value: data.declined },
      { name: "Pending", value: data.pending },
    ].filter(d => d.value > 0);
  }, [data]);

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-foreground">Event Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isLiveEvent ? "Live event performance" : "Post-event report"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isLiveEvent && (
            <Button
              variant={liveMode ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => setLiveMode(!liveMode)}
            >
              <Radio className={cn("h-3.5 w-3.5", liveMode && "animate-pulse")} />
              {liveMode ? "Live" : "Go Live"}
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fetchAnalytics} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {liveMode && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2">
          <Radio className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-sm text-primary font-medium">Live mode — auto-refreshing every 30s</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={Users} label="Invited" value={data?.totalInvited ?? 0} />
        <StatCard icon={UserCheck} label="RSVP Rate" value={`${rsvpRate}%`} sub={`${data?.confirmed ?? 0} confirmed`} />
        <StatCard icon={Activity} label="Attendance" value={`${attendanceRate}%`} sub={`${data?.checkedIn ?? 0} checked in`} />
        <StatCard icon={UserX} label="No-Show" value={`${noShowPct}%`} sub={`${data?.noShow ?? 0} absent`} accent={noShowPct > 20 ? "text-destructive" : undefined} />
        <StatCard icon={MailOpen} label="Msg Open Rate" value={`${openRate}%`} sub={`${data?.messagesOpened ?? 0} / ${data?.messagesSent ?? 0}`} />
        <StatCard icon={ClipboardCheck} label="Survey" value={`${surveyRate}%`} sub={`${data?.surveysCompleted ?? 0} / ${data?.surveysSent ?? 0}`} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* RSVP Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">RSVP Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <div className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <ReTooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-10">No RSVP data yet</p>
            )}
            <div className="flex items-center justify-center gap-4 mt-2">
              {pieData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: PIE_COLORS[i] }} />
                  <span className="text-muted-foreground">{d.name}</span>
                  <span className="font-semibold text-foreground">{d.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Check-in Time Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Check-in Time Distribution</CardTitle>
              {liveMode && <Badge variant="outline" className="text-[10px]"><Radio className="h-2.5 w-2.5 mr-1 animate-pulse" />Live</Badge>}
            </div>
          </CardHeader>
          <CardContent>
            {(data?.checkinTimeline?.length ?? 0) > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data!.checkinTimeline} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                  <ReTooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                  />
                  <Bar dataKey="count" fill={COLORS.primary} radius={[4, 4, 0, 0]} name="Check-ins" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-10">No check-in data yet</p>
            )}
          </CardContent>
        </Card>

        {/* RSVP Trend */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">RSVP Confirmations Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.rsvpTimeline?.length ?? 0) > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data!.rsvpTimeline} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                  <ReTooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="confirmed"
                    stroke={COLORS.primary}
                    fill={COLORS.primary}
                    fillOpacity={0.15}
                    strokeWidth={2}
                    name="Confirmed"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-10">No RSVP timeline data yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Detailed Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {[
              { label: "Total Invited", value: data?.totalInvited ?? 0 },
              { label: "Confirmed", value: data?.confirmed ?? 0 },
              { label: "Declined", value: data?.declined ?? 0 },
              { label: "Pending", value: data?.pending ?? 0 },
              { label: "Checked In", value: data?.checkedIn ?? 0 },
              { label: "No-Shows", value: data?.noShow ?? 0 },
              { label: "Messages Sent", value: data?.messagesSent ?? 0 },
              { label: "Messages Opened", value: data?.messagesOpened ?? 0 },
              { label: "Survey Invites", value: data?.surveysSent ?? 0 },
              { label: "Survey Completed", value: data?.surveysCompleted ?? 0 },
              { label: "RSVP Rate", value: `${rsvpRate}%` },
              { label: "Attendance Rate", value: `${attendanceRate}%` },
            ].map(m => (
              <div key={m.label} className="rounded-lg border border-border/50 p-3 bg-muted/20">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{m.label}</p>
                <p className="text-lg font-bold text-foreground mt-0.5">{m.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticsSection;

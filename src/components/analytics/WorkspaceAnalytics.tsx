import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Calendar, Users, UserCheck, UserX, TrendingUp, Trophy, ArrowUpRight,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer,
} from "recharts";
import { format, subMonths, startOfMonth } from "date-fns";

interface WorkspaceStats {
  totalEvents: number;
  totalAttendees: number;
  avgRsvpRate: number;
  avgAttendanceRate: number;
  avgNoShowRate: number;
  topEvents: { id: string; title: string; attendanceRate: number; rsvpRate: number; attendees: number }[];
  monthlyTrend: { month: string; events: number; attendees: number }[];
}

function KpiCard({ icon: Icon, label, value, sub, accent }: {
  icon: typeof Users; label: string; value: string | number; sub?: string; accent?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
            <p className={`text-2xl font-display font-bold mt-1 ${accent || ""}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 shrink-0">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function WorkspaceAnalytics() {
  const { user } = useAuth();
  const [stats, setStats] = useState<WorkspaceStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Get all user's events with attendee counts
      const { data: events } = await supabase
        .from("events")
        .select("id, title, status, start_date, created_at")
        .order("created_at", { ascending: false });

      const allEvents = events || [];
      const eventIds = allEvents.map(e => e.id);

      if (eventIds.length === 0) {
        setStats({
          totalEvents: 0, totalAttendees: 0, avgRsvpRate: 0,
          avgAttendanceRate: 0, avgNoShowRate: 0, topEvents: [], monthlyTrend: [],
        });
        setLoading(false);
        return;
      }

      // Fetch all attendees for user's events
      const { data: attendees } = await supabase
        .from("attendees")
        .select("id, event_id, confirmed, checked_in_at")
        .in("event_id", eventIds);

      const att = attendees || [];

      // Compute per-event metrics
      const eventMetrics = allEvents.map(ev => {
        const evAtt = att.filter(a => a.event_id === ev.id);
        const total = evAtt.length;
        const confirmed = evAtt.filter(a => a.confirmed).length;
        const checkedIn = evAtt.filter(a => a.checked_in_at).length;
        const rsvpRate = total > 0 ? (confirmed / total) * 100 : 0;
        const attendanceRate = confirmed > 0 ? (checkedIn / confirmed) * 100 : 0;
        const noShowRate = confirmed > 0 ? ((confirmed - checkedIn) / confirmed) * 100 : 0;
        return { ...ev, attendees: total, confirmed, checkedIn, rsvpRate, attendanceRate, noShowRate };
      });

      // Aggregate workspace metrics
      const withAttendees = eventMetrics.filter(e => e.attendees > 0);
      const avgRsvpRate = withAttendees.length > 0
        ? Math.round(withAttendees.reduce((s, e) => s + e.rsvpRate, 0) / withAttendees.length)
        : 0;
      const avgAttendanceRate = withAttendees.length > 0
        ? Math.round(withAttendees.reduce((s, e) => s + e.attendanceRate, 0) / withAttendees.length)
        : 0;
      const avgNoShowRate = withAttendees.length > 0
        ? Math.round(withAttendees.reduce((s, e) => s + e.noShowRate, 0) / withAttendees.length)
        : 0;

      // Top events by attendance rate (minimum 5 attendees)
      const topEvents = eventMetrics
        .filter(e => e.attendees >= 5)
        .sort((a, b) => b.attendanceRate - a.attendanceRate)
        .slice(0, 5)
        .map(e => ({
          id: e.id,
          title: e.title,
          attendanceRate: Math.round(e.attendanceRate),
          rsvpRate: Math.round(e.rsvpRate),
          attendees: e.attendees,
        }));

      // Monthly trend (last 6 months)
      const monthlyTrend: { month: string; events: number; attendees: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const monthStart = startOfMonth(subMonths(new Date(), i));
        const monthEnd = startOfMonth(subMonths(new Date(), i - 1));
        const monthLabel = format(monthStart, "MMM");
        const monthEvents = allEvents.filter(e => {
          const d = new Date(e.created_at);
          return d >= monthStart && d < monthEnd;
        });
        const monthAttendees = att.filter(a => {
          const ev = allEvents.find(e => e.id === a.event_id);
          if (!ev) return false;
          const d = new Date(ev.created_at);
          return d >= monthStart && d < monthEnd;
        });
        monthlyTrend.push({
          month: monthLabel,
          events: monthEvents.length,
          attendees: monthAttendees.length,
        });
      }

      setStats({
        totalEvents: allEvents.length,
        totalAttendees: att.length,
        avgRsvpRate,
        avgAttendanceRate,
        avgNoShowRate,
        topEvents,
        monthlyTrend,
      });
    } catch (err) {
      console.error("Workspace analytics error:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-4">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard icon={Calendar} label="Total Events" value={stats.totalEvents} />
        <KpiCard icon={Users} label="Total Attendees" value={stats.totalAttendees} />
        <KpiCard icon={UserCheck} label="Avg RSVP Rate" value={`${stats.avgRsvpRate}%`} />
        <KpiCard icon={TrendingUp} label="Avg Attendance" value={`${stats.avgAttendanceRate}%`} />
        <KpiCard
          icon={UserX}
          label="Avg No-Show"
          value={`${stats.avgNoShowRate}%`}
          accent={stats.avgNoShowRate > 20 ? "text-destructive" : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monthly Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Activity Trend (6 months)</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.monthlyTrend.some(m => m.events > 0 || m.attendees > 0) ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats.monthlyTrend} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                  <ReTooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="events" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Events" />
                  <Bar dataKey="attendees" fill="hsl(var(--primary) / 0.4)" radius={[4, 4, 0, 0]} name="Attendees" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-10">No activity data yet</p>
            )}
          </CardContent>
        </Card>

        {/* Top Events */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-medium">Top Events by Attendance</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {stats.topEvents.length > 0 ? (
              <div className="space-y-3">
                {stats.topEvents.map((ev, i) => (
                  <Link
                    key={ev.id}
                    to={`/dashboard/events/${ev.id}/analytics`}
                    className="flex items-center justify-between rounded-lg border border-border/50 p-3 hover:bg-muted/30 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-bold text-muted-foreground w-5 text-center">{i + 1}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{ev.title}</p>
                        <p className="text-[10px] text-muted-foreground">{ev.attendees} attendees</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-bold">{ev.attendanceRate}%</p>
                        <p className="text-[10px] text-muted-foreground">attendance</p>
                      </div>
                      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-10">
                Need at least 5 attendees per event to rank
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

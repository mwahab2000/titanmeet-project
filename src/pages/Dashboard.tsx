import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Calendar, Users, TrendingUp, Clock, AlertTriangle, ArrowUpRight, Zap, FileEdit } from "lucide-react";
import AIInsightsCard from "@/components/ai/AIInsightsCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBilling } from "@/hooks/useBilling";
import { usagePercent, formatCents } from "@/lib/billing";
import { getPublishStatus } from "@/lib/publishChecks";

const Dashboard = () => {
  const { user } = useAuth();
  const { currentPlan, usage, loading: billingLoading } = useBilling();
  const [stats, setStats] = useState({ events: 0, attendees: 0, upcoming: 0 });
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [incompleteDrafts, setIncompleteDrafts] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;
      const [eventsRes, attendeesRes] = await Promise.all([
        supabase.from("events").select("*", { count: "exact" }),
        supabase.from("attendees").select("*", { count: "exact" }),
      ]);

      const events = eventsRes.data || [];
      const upcoming = events.filter(e => new Date(e.start_date) > new Date()).length;

      setStats({
        events: eventsRes.count || 0,
        attendees: attendeesRes.count || 0,
        upcoming,
      });

      setRecentEvents(events.slice(0, 5));

      // Count incomplete drafts
      const draftEvents = events.filter((e: any) => e.status === "draft");
      const incomplete = draftEvents.filter((e: any) => !getPublishStatus(e).allPass).length;
      setIncompleteDrafts(incomplete);
    };

    fetchStats();
  }, [user]);

  const statCards = [
    { title: "Total Events", value: stats.events, icon: Calendar, color: "text-titan-green" },
    { title: "Total Attendees", value: stats.attendees, icon: Users, color: "text-titan-blue" },
    { title: "Upcoming Events", value: stats.upcoming, icon: Clock, color: "text-titan-green" },
    { title: "Active Rate", value: stats.events > 0 ? `${Math.round((stats.upcoming / stats.events) * 100)}%` : "0%", icon: TrendingUp, color: "text-titan-blue" },
  ];

  // Usage metrics for plan awareness
  const usageMetrics = currentPlan ? [
    { label: "Clients", used: usage.clients_count, limit: currentPlan.max_clients },
    { label: "Active Events", used: usage.active_events_count, limit: currentPlan.max_active_events },
    { label: "Attendees", used: usage.attendees_count, limit: currentPlan.max_attendees },
    { label: "Emails", used: usage.emails_sent_count, limit: currentPlan.max_emails },
  ] : [];

  const warnings = usageMetrics.filter((m) => usagePercent(m.used, m.limit) >= 80);

  // Send a usage_warning notification once per session when thresholds are hit
  const usageNotifSent = useRef(false);
  useEffect(() => {
    if (!user || usageNotifSent.current || warnings.length === 0) return;
    usageNotifSent.current = true;
    const topWarning = warnings[0];
    supabase.from("notifications" as any).insert({
      user_id: user.id,
      type: "usage_warning",
      title: "Plan usage alert",
      message: `You've used ${usagePercent(topWarning.used, topWarning.limit)}% of your ${topWarning.label.toLowerCase()} limit.`,
      link: "/dashboard/billing",
      metadata: { warnings: warnings.map(w => w.label) },
    });
  }, [warnings, user]);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's your event overview.</p>
        </div>
        {currentPlan && !billingLoading && (
          <Link to="/dashboard/billing">
            <Badge variant="outline" className="text-sm px-3 py-1.5 gap-1.5 cursor-pointer hover:bg-accent">
              {currentPlan.name} Plan — {formatCents(currentPlan.monthly_price_cents)}/mo
            </Badge>
          </Link>
        )}
      </div>

      {/* Upgrade warnings */}
      {warnings.length > 0 && (
        <Alert className="mb-6 border-yellow-500/50 bg-yellow-500/10">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          <AlertTitle className="text-yellow-600 dark:text-yellow-400">Usage Alert</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <div>
              {warnings.map((w) => (
                <div key={w.label}>
                  You've used {usagePercent(w.used, w.limit)}% of your {w.label.toLowerCase()} limit ({w.used}/{w.limit}).
                </div>
              ))}
              {currentPlan && currentPlan.id !== "enterprise" && (
                <span className="font-medium">
                  {currentPlan.id === "starter" ? "Professional" : "Enterprise"} plan recommended.
                </span>
              )}
            </div>
            {currentPlan && currentPlan.id !== "enterprise" && (
              <Button size="sm" variant="outline" className="ml-4 shrink-0" asChild>
                <Link to="/dashboard/billing">Upgrade <ArrowUpRight className="h-3 w-3 ml-1" /></Link>
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Quick Setup + Drafts row */}
      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center justify-between p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-display text-base font-semibold">Quick Event Setup</h3>
                <p className="text-sm text-muted-foreground">Create an event in minutes</p>
              </div>
            </div>
            <Button size="sm" asChild>
              <Link to="/dashboard/events/quick-setup">
                Start <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {incompleteDrafts > 0 && (
          <Card className="border-destructive/20 bg-destructive/5">
            <CardContent className="flex items-center justify-between p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                  <FileEdit className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <h3 className="font-display text-base font-semibold">{incompleteDrafts} Incomplete Draft{incompleteDrafts !== 1 ? "s" : ""}</h3>
                  <p className="text-sm text-muted-foreground">Events needing attention before publish</p>
                </div>
              </div>
              <Button size="sm" variant="outline" asChild>
                <Link to="/dashboard/events/drafts">
                  View All <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-display">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Usage vs plan limits */}
      {currentPlan && !billingLoading && usageMetrics.length > 0 && (
        <Card className="mb-8">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-lg">Plan Usage — {currentPlan.name}</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/dashboard/billing" className="text-xs">View Billing →</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {usageMetrics.map((m) => {
                const pct = usagePercent(m.used, m.limit);
                return (
                  <div key={m.label} className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{m.label}</span>
                      <span className={`text-xs ${pct >= 90 ? "text-destructive font-semibold" : pct >= 80 ? "text-yellow-600 dark:text-yellow-400" : "text-muted-foreground"}`}>
                        {m.used}/{m.limit}
                      </span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Insights */}
      <div className="mb-8">
        <AIInsightsCard stats={stats} recentEvents={recentEvents} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display">Recent Events</CardTitle>
        </CardHeader>
        <CardContent>
          {recentEvents.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No events yet. Create your first event!</p>
          ) : (
            <div className="space-y-3">
              {recentEvents.map((event) => (
                <div key={event.id} className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div>
                    <p className="font-medium">{event.title}</p>
                    <p className="text-sm text-muted-foreground">{new Date(event.start_date).toLocaleDateString()}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                    event.status === 'published' ? 'bg-accent text-accent-foreground' :
                    event.status === 'draft' ? 'bg-muted text-muted-foreground' :
                    'bg-secondary/10 text-secondary'
                  }`}>
                    {event.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;

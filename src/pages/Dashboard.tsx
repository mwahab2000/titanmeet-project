import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Calendar, Users, TrendingUp, Clock, AlertTriangle, ArrowUpRight, Zap, FileEdit, Plus, Copy } from "lucide-react";
import { motion } from "framer-motion";
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
import { format, differenceInDays } from "date-fns";

const cellVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.4, ease: [0, 0, 0.2, 1] as const },
  }),
};

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

      const draftEvents = events.filter((e: any) => e.status === "draft");
      const incomplete = draftEvents.filter((e: any) => !getPublishStatus(e).allPass).length;
      setIncompleteDrafts(incomplete);
    };

    fetchStats();
  }, [user]);

  const statCards = [
    { title: "Total Events", value: stats.events, icon: Calendar, color: "text-titan-green" },
    { title: "Total Attendees", value: stats.attendees, icon: Users, color: "text-titan-blue" },
    { title: "Upcoming", value: stats.upcoming, icon: Clock, color: "text-titan-green" },
    { title: "Active Rate", value: stats.events > 0 ? `${Math.round((stats.upcoming / stats.events) * 100)}%` : "0%", icon: TrendingUp, color: "text-titan-blue" },
  ];

  const usageMetrics = currentPlan ? [
    { label: "Clients", used: usage.clients_count, limit: currentPlan.max_clients },
    { label: "Active Events", used: usage.active_events_count, limit: currentPlan.max_active_events },
    { label: "Attendees", used: usage.attendees_count, limit: currentPlan.max_attendees },
    { label: "Emails", used: usage.emails_sent_count, limit: currentPlan.max_emails },
  ] : [];

  const warnings = usageMetrics.filter((m) => usagePercent(m.used, m.limit) >= 80);

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

  // Next upcoming event
  const nextEvent = recentEvents.find(e => new Date(e.start_date) > new Date());
  const daysUntilNext = nextEvent ? differenceInDays(new Date(nextEvent.start_date), new Date()) : null;

  let cellIndex = 0;

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

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Row 1: Next Event hero (3 cols) + Quick Actions (1 col) */}
        <motion.div
          className="md:col-span-3"
          variants={cellVariants}
          initial="hidden"
          animate="visible"
          custom={cellIndex++}
        >
          <Card className="h-full border-l-4 border-l-primary overflow-hidden">
            <CardContent className="flex items-center justify-between p-6">
              {nextEvent ? (
                <>
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Next Event</p>
                    <h2 className="font-display text-2xl font-bold">{nextEvent.title}</h2>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(nextEvent.start_date), "EEEE, MMMM d, yyyy")}
                    </p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <p className="font-display text-4xl font-bold text-primary">{daysUntilNext}</p>
                      <p className="text-xs text-muted-foreground">days away</p>
                    </div>
                    <Button asChild>
                      <Link to={`/dashboard/events/${nextEvent.id}/hero`}>
                        Open Workspace <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-4 py-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                    <Plus className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-semibold">Create your first event</h3>
                    <p className="text-sm text-muted-foreground">Get started by setting up a new event.</p>
                  </div>
                  <Button className="ml-auto" asChild>
                    <Link to="/dashboard/events/new">
                      <Plus className="h-4 w-4 mr-1" /> New Event
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          className="md:col-span-1"
          variants={cellVariants}
          initial="hidden"
          animate="visible"
          custom={cellIndex++}
        >
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-sm">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="ghost" className="w-full justify-start gap-2 text-sm" asChild>
                <Link to="/dashboard/events/quick-setup">
                  <Zap className="h-4 w-4" /> Quick Event Setup
                </Link>
              </Button>
              <Button variant="ghost" className="w-full justify-start gap-2 text-sm" asChild>
                <Link to="/dashboard/templates">
                  <Copy className="h-4 w-4" /> View Templates
                </Link>
              </Button>
              <Button variant="ghost" className="w-full justify-start gap-2 text-sm relative" asChild>
                <Link to="/dashboard/events/drafts">
                  <FileEdit className="h-4 w-4" /> View Drafts
                  {incompleteDrafts > 0 && (
                    <Badge variant="destructive" className="ml-auto text-[10px] h-5 px-1.5">
                      {incompleteDrafts}
                    </Badge>
                  )}
                </Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Row 2: 4 stat cards */}
        {statCards.map((stat) => (
          <motion.div
            key={stat.title}
            variants={cellVariants}
            initial="hidden"
            animate="visible"
            custom={cellIndex++}
          >
            <Card className="border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-display">{stat.value}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}

        {/* Row 3: Recent Events (3 cols) + Plan Usage (1 col) */}
        <motion.div
          className="md:col-span-3"
          variants={cellVariants}
          initial="hidden"
          animate="visible"
          custom={cellIndex++}
        >
          <Card className="h-full">
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
        </motion.div>

        <motion.div
          className="md:col-span-1"
          variants={cellVariants}
          initial="hidden"
          animate="visible"
          custom={cellIndex++}
        >
          {currentPlan && !billingLoading && usageMetrics.length > 0 ? (
            <Card className="h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-display text-sm">Plan Usage</CardTitle>
                  <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-muted-foreground" asChild>
                    <Link to="/dashboard/billing">View →</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {usageMetrics.map((m) => {
                  const pct = usagePercent(m.used, m.limit);
                  return (
                    <div key={m.label} className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-xs">{m.label}</span>
                        <span className={`text-[10px] ${pct >= 90 ? "text-destructive font-semibold" : pct >= 80 ? "text-yellow-600 dark:text-yellow-400" : "text-muted-foreground"}`}>
                          {m.used}/{m.limit}
                        </span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full flex items-center justify-center">
              <CardContent className="text-center text-sm text-muted-foreground py-8">
                Plan info loading…
              </CardContent>
            </Card>
          )}
        </motion.div>

        {/* AI Insights full width */}
        <motion.div
          className="md:col-span-4"
          variants={cellVariants}
          initial="hidden"
          animate="visible"
          custom={cellIndex++}
        >
          <AIInsightsCard stats={stats} recentEvents={recentEvents} />
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;

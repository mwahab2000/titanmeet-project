import { useEffect, useState } from "react";
import { Calendar, Users, TrendingUp, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ events: 0, attendees: 0, upcoming: 0 });
  const [recentEvents, setRecentEvents] = useState<any[]>([]);

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
    };

    fetchStats();
  }, [user]);

  const statCards = [
    { title: "Total Events", value: stats.events, icon: Calendar, color: "text-titan-green" },
    { title: "Total Attendees", value: stats.attendees, icon: Users, color: "text-titan-blue" },
    { title: "Upcoming Events", value: stats.upcoming, icon: Clock, color: "text-titan-green" },
    { title: "Active Rate", value: stats.events > 0 ? `${Math.round((stats.upcoming / stats.events) * 100)}%` : "0%", icon: TrendingUp, color: "text-titan-blue" },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's your event overview.</p>
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

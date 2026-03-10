import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search, Calendar, MapPin, Users, X, Zap, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useUpgradeModal } from "@/hooks/useUpgradeModal";

const statusFilters = ["all", "draft", "published", "ongoing", "completed", "archived", "cancelled"] as const;
type StatusFilter = (typeof statusFilters)[number];

const Events = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      const { data } = await supabase
        .from("events")
        .select("*")
        .order("created_at", { ascending: false });
      setEvents(data || []);
      setLoading(false);
    };
    fetchEvents();
  }, []);

  const filtered = events.filter(e => {
    const matchesSearch = e.title.toLowerCase().includes(search.toLowerCase()) ||
      (e.description || "").toLowerCase().includes(search.toLowerCase()) ||
      (e.location || "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || e.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = events.reduce<Record<string, number>>((acc, e) => {
    acc[e.status] = (acc[e.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Events</h1>
          <p className="text-muted-foreground">Manage all your events</p>
        </div>
        <div className="flex items-center gap-2">
          <Button className="gradient-titan border-0 text-primary-foreground gap-2" asChild>
            <Link to="/dashboard/events/quick-setup"><Zap className="h-4 w-4" /> Quick Setup</Link>
          </Button>
          <Button variant="outline" className="gap-2" asChild>
            <Link to="/dashboard/templates"><Copy className="h-4 w-4" /> From Template</Link>
          </Button>
          <Button variant="outline" className="gap-2" asChild>
            <Link to="/dashboard/events/new"><Plus className="h-4 w-4" /> Full Setup</Link>
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="mb-6 space-y-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by title, description, or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-8"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {statusFilters.map((status) => {
            const count = status === "all" ? events.length : (statusCounts[status] || 0);
            if (status !== "all" && count === 0) return null;
            return (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  statusFilter === status
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
                <span className="ml-1.5 opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Calendar className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="mb-2 text-lg font-medium">
              {search || statusFilter !== "all" ? "No matching events" : "No events found"}
            </p>
            <p className="mb-4 text-sm text-muted-foreground">
              {search || statusFilter !== "all"
                ? "Try adjusting your search or filters"
                : "Create your first event to get started"}
            </p>
            {!search && statusFilter === "all" && (
              <Button className="gradient-titan border-0 text-primary-foreground" asChild>
                <Link to="/dashboard/events/new">Create Event</Link>
              </Button>
            )}
            {(search || statusFilter !== "all") && (
              <Button variant="outline" size="sm" onClick={() => { setSearch(""); setStatusFilter("all"); }}>
                Clear filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="mb-3 text-xs text-muted-foreground">{filtered.length} event{filtered.length !== 1 ? "s" : ""}</p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((event) => (
              <Link key={event.id} to={`/dashboard/events/${event.id}/hero`}>
                <Card className="cursor-pointer transition-all hover:shadow-lg hover:border-primary/30">
                  <CardContent className="p-6">
                    <div className="mb-3 flex items-center justify-between">
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                        event.status === 'published' ? 'bg-accent text-accent-foreground' :
                        event.status === 'draft' ? 'bg-muted text-muted-foreground' :
                        event.status === 'completed' ? 'bg-secondary/10 text-secondary' :
                        'bg-destructive/10 text-destructive'
                      }`}>
                        {event.status}
                      </span>
                    </div>
                    <h3 className="mb-2 font-display text-lg font-semibold">{event.title}</h3>
                    <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">{event.description || "No description"}</p>
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5" />
                        {format(new Date(event.start_date), "MMM d, yyyy")}
                      </div>
                      {event.location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5" />
                          {event.location}
                        </div>
                      )}
                      {event.max_attendees && (
                        <div className="flex items-center gap-2">
                          <Users className="h-3.5 w-3.5" />
                          {event.max_attendees} max attendees
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Events;

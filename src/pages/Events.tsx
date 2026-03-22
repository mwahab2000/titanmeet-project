import { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus, Search, Calendar, MapPin, Users, X, Zap, Copy, CheckCircle2, AlertCircle,
  Trash2, MoreVertical, ArrowUpDown, BarChart3, MessageSquare, Bot, UserCheck,
  Mail, Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { toast } from "sonner";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useUpgradeModal } from "@/hooks/useUpgradeModal";
import { getWeightedCompletion, type EventRelatedCounts, type WeightedResult } from "@/lib/publishChecks";
import { cn } from "@/lib/utils";

const statusFilters = ["all", "draft", "published", "ongoing", "completed", "archived", "cancelled"] as const;
type StatusFilter = (typeof statusFilters)[number];

type SortKey = "date_desc" | "date_asc" | "name_asc" | "name_desc" | "readiness" | "rsvp";

interface EventMetrics {
  totalAttendees: number;
  confirmed: number;
  checkedIn: number;
  messagesSent: number;
}

const Events = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("date_desc");
  const [loading, setLoading] = useState(true);
  const [completionMap, setCompletionMap] = useState<Record<string, WeightedResult>>({});
  const [metricsMap, setMetricsMap] = useState<Record<string, EventMetrics>>({});
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const planLimits = usePlanLimits();
  const { openUpgradeModal } = useUpgradeModal();
  const navigate = useNavigate();

  const handleCreateEvent = (path: string) => {
    if (!planLimits.canCreate("activeEvents")) {
      openUpgradeModal("events");
      return;
    }
    navigate(path);
  };

  const fetchEvents = useCallback(async () => {
    const { data } = await supabase
      .from("events")
      .select("*")
      .order("created_at", { ascending: false });
    const evts = data || [];
    setEvents(evts);

    if (evts.length > 0) {
      const ids = evts.map((e: any) => e.id);
      const [attRes, agendaRes, invRes, msgRes] = await Promise.all([
        supabase.from("attendees").select("event_id, confirmed, checked_in_at").in("event_id", ids),
        supabase.from("agenda_items").select("event_id").in("event_id", ids),
        supabase.from("event_invites").select("event_id").in("event_id", ids),
        supabase.from("message_logs").select("event_id, status").in("event_id", ids),
      ]);

      const att = attRes.data || [];
      const msgs = msgRes.data || [];

      const count = (rows: any[] | null, eid: string) =>
        (rows || []).filter((r: any) => r.event_id === eid).length;

      const cMap: Record<string, WeightedResult> = {};
      const mMap: Record<string, EventMetrics> = {};

      for (const evt of evts) {
        const evtAtt = att.filter(a => a.event_id === evt.id);
        const evtMsgs = msgs.filter(m => m.event_id === evt.id);
        const counts: EventRelatedCounts = {
          attendees: evtAtt.length,
          agenda: count(agendaRes.data, evt.id),
          invites: count(invRes.data, evt.id),
        };
        cMap[evt.id] = getWeightedCompletion(evt, counts);
        mMap[evt.id] = {
          totalAttendees: evtAtt.length,
          confirmed: evtAtt.filter(a => a.confirmed).length,
          checkedIn: evtAtt.filter(a => a.checked_in_at).length,
          messagesSent: evtMsgs.filter(m => ["sent", "delivered", "read"].includes(m.status)).length,
        };
      }
      setCompletionMap(cMap);
      setMetricsMap(mMap);
    }

    setLoading(false);
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.rpc("delete_draft_event", { _event_id: deleteTarget.id });
    setDeleting(false);
    setDeleteTarget(null);
    if (error) { toast.error(error.message || "Failed to delete event"); return; }
    toast.success(`"${deleteTarget.title}" has been deleted`);
    setEvents(prev => prev.filter(e => e.id !== deleteTarget.id));
  };

  const filtered = useMemo(() => {
    let result = events.filter(e => {
      const matchesSearch = e.title.toLowerCase().includes(search.toLowerCase()) ||
        (e.description || "").toLowerCase().includes(search.toLowerCase()) ||
        (e.location || "").toLowerCase().includes(search.toLowerCase()) ||
        (e.venue_name || "").toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || e.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    result.sort((a, b) => {
      switch (sortKey) {
        case "date_asc": return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
        case "date_desc": return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
        case "name_asc": return (a.title || "").localeCompare(b.title || "");
        case "name_desc": return (b.title || "").localeCompare(a.title || "");
        case "readiness": return (completionMap[b.id]?.pct ?? 0) - (completionMap[a.id]?.pct ?? 0);
        case "rsvp": {
          const rA = metricsMap[a.id]?.confirmed ?? 0;
          const rB = metricsMap[b.id]?.confirmed ?? 0;
          return rB - rA;
        }
        default: return 0;
      }
    });

    return result;
  }, [events, search, statusFilter, sortKey, completionMap, metricsMap]);

  const statusCounts = events.reduce<Record<string, number>>((acc, e) => {
    acc[e.status] = (acc[e.status] || 0) + 1;
    return acc;
  }, {});

  // Portfolio summary stats
  const totalEvents = events.length;
  const liveEvents = events.filter(e => e.status === "published" || e.status === "ongoing").length;
  const totalConfirmed = Object.values(metricsMap).reduce((s, m) => s + m.confirmed, 0);
  const totalCheckedIn = Object.values(metricsMap).reduce((s, m) => s + m.checkedIn, 0);

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold">Event Portfolio</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage and monitor all your events</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button className="gradient-titan border-0 text-primary-foreground gap-2 min-h-[40px]" onClick={() => handleCreateEvent("/dashboard/events/quick-setup")}>
            <Zap className="h-4 w-4" /> Quick Setup
          </Button>
          <Button variant="outline" className="gap-2 min-h-[40px]" asChild>
            <Link to="/dashboard/templates"><Copy className="h-4 w-4" /> Template</Link>
          </Button>
          <Button variant="outline" className="gap-2 min-h-[40px]" onClick={() => handleCreateEvent("/dashboard/events/new")}>
            <Plus className="h-4 w-4" /> Full Setup
          </Button>
        </div>
      </div>

      {/* Portfolio Summary Strip */}
      {!loading && totalEvents > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Total Events</p>
            <p className="text-xl font-display font-bold text-foreground">{totalEvents}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-1.5">
              <Radio className="h-3 w-3 text-primary animate-pulse" />
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Live</p>
            </div>
            <p className="text-xl font-display font-bold text-primary">{liveEvents}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Total RSVPs</p>
            <p className="text-xl font-display font-bold text-foreground">{totalConfirmed}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Checked In</p>
            <p className="text-xl font-display font-bold text-foreground">{totalCheckedIn}</p>
          </div>
        </div>
      )}

      {/* Search, Sort & Filters */}
      <div className="mb-6 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search events, venues, locations..."
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
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
            <SelectTrigger className="w-[180px] shrink-0">
              <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date_desc">Newest First</SelectItem>
              <SelectItem value="date_asc">Oldest First</SelectItem>
              <SelectItem value="name_asc">Name A→Z</SelectItem>
              <SelectItem value="name_desc">Name Z→A</SelectItem>
              <SelectItem value="readiness">Readiness</SelectItem>
              <SelectItem value="rsvp">Most RSVPs</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-2">
          {statusFilters.map((status) => {
            const count = status === "all" ? events.length : (statusCounts[status] || 0);
            if (status !== "all" && count === 0) return null;
            return (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  statusFilter === status
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
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
              {search || statusFilter !== "all" ? "Try adjusting your search or filters" : "Create your first event to get started"}
            </p>
            {!search && statusFilter === "all" && (
              <Button className="gradient-titan border-0 text-primary-foreground" asChild>
                <Link to="/dashboard/events/new">Create Event</Link>
              </Button>
            )}
            {(search || statusFilter !== "all") && (
              <Button variant="outline" size="sm" onClick={() => { setSearch(""); setStatusFilter("all"); }}>Clear filters</Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="mb-3 text-xs text-muted-foreground">{filtered.length} event{filtered.length !== 1 ? "s" : ""}</p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((event) => {
              const completion = completionMap[event.id];
              const metrics = metricsMap[event.id];
              const pct = completion?.pct ?? 0;
              const ready = completion?.ready ?? false;
              const missingItems = completion?.missing ?? [];
              const isDraft = event.status === "draft";
              const isLive = event.status === "published" || event.status === "ongoing";
              const rsvpRate = metrics && metrics.totalAttendees > 0
                ? Math.round((metrics.confirmed / metrics.totalAttendees) * 100) : 0;

              return (
                <Card key={event.id} className="transition-all hover:shadow-lg hover:border-primary/30 relative group overflow-hidden">
                  <Link to={`/dashboard/events/${event.id}/hero`} className="block">
                    <CardContent className="p-5">
                      {/* Status + Live indicator */}
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "rounded-full px-3 py-1 text-xs font-medium",
                            event.status === "published" ? "bg-accent text-accent-foreground" :
                            event.status === "ongoing" ? "bg-primary/15 text-primary" :
                            event.status === "draft" ? "bg-muted text-muted-foreground" :
                            event.status === "completed" ? "bg-secondary/10 text-secondary" :
                            "bg-destructive/10 text-destructive"
                          )}>
                            {event.status}
                          </span>
                          {isLive && <Radio className="h-3 w-3 text-primary animate-pulse" />}
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground">{pct}%</span>
                      </div>

                      <h3 className="mb-1 font-display text-base font-semibold pr-6 truncate">{event.title}</h3>

                      {/* Date & Venue row */}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(event.start_date), "MMM d, yyyy")}
                        </span>
                        {(event.venue_name || event.location) && (
                          <span className="flex items-center gap-1 truncate">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{event.venue_name || event.location}</span>
                          </span>
                        )}
                      </div>

                      {/* Progress bar */}
                      <Progress value={pct} className="mb-3 h-1.5" />

                      {/* Operational metrics row */}
                      <div className="grid grid-cols-4 gap-2 mb-3">
                        <div className="text-center">
                          <p className="text-[10px] text-muted-foreground">Invited</p>
                          <p className="text-sm font-bold text-foreground">{metrics?.totalAttendees ?? 0}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-muted-foreground">RSVP</p>
                          <p className="text-sm font-bold text-foreground">{rsvpRate}%</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-muted-foreground">Checked In</p>
                          <p className="text-sm font-bold text-foreground">{metrics?.checkedIn ?? 0}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-muted-foreground">Msgs</p>
                          <p className="text-sm font-bold text-foreground">{metrics?.messagesSent ?? 0}</p>
                        </div>
                      </div>

                      {/* Ready badge */}
                      <div className="mb-2">
                        {ready ? (
                          <Badge className="gap-1 bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20 dark:text-emerald-400 text-[10px]">
                            <CheckCircle2 className="h-3 w-3" /> Ready to Publish
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 border-destructive/30 text-destructive hover:bg-destructive/5 text-[10px]">
                            <AlertCircle className="h-3 w-3" /> {missingItems.length} items missing
                          </Badge>
                        )}
                      </div>

                      {/* Missing items hint */}
                      {!ready && missingItems.length > 0 && (
                        <p className="text-[10px] text-muted-foreground/60 line-clamp-1">
                          {missingItems.slice(0, 3).join(", ")}
                          {missingItems.length > 3 && ` +${missingItems.length - 3}`}
                        </p>
                      )}
                    </CardContent>
                  </Link>

                  {/* Quick action links */}
                  <div className="border-t border-border/50 px-2 py-1.5 flex items-center gap-0.5 bg-muted/20">
                    <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1 px-2 text-muted-foreground hover:text-foreground" asChild>
                      <Link to={`/dashboard/events/${event.id}/analytics`}>
                        <BarChart3 className="h-3 w-3" /> Analytics
                      </Link>
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1 px-2 text-muted-foreground hover:text-foreground" asChild>
                      <Link to={`/dashboard/events/${event.id}/communications`}>
                        <MessageSquare className="h-3 w-3" /> Comms
                      </Link>
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1 px-2 text-muted-foreground hover:text-foreground" asChild>
                      <Link to={`/dashboard/events/${event.id}/attendees`}>
                        <UserCheck className="h-3 w-3" /> Attendees
                      </Link>
                    </Button>
                    <div className="ml-auto">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="rounded-md p-1 hover:bg-muted transition-colors">
                            <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          {isDraft ? (
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={(e) => { e.preventDefault(); setDeleteTarget(event); }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem disabled className="text-muted-foreground text-xs">
                              Published events cannot be deleted
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event?</AlertDialogTitle>
            <AlertDialogDescription>
              This draft event <strong>"{deleteTarget?.title}"</strong> will be permanently deleted along with all its attendees, agenda, invites, and related data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Events;

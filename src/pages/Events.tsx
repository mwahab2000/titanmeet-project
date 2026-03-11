import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search, Calendar, MapPin, Users, X, Zap, Copy, CheckCircle2, AlertCircle, Trash2, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { toast } from "sonner";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useUpgradeModal } from "@/hooks/useUpgradeModal";
import { getWeightedCompletion, type EventRelatedCounts, type WeightedResult } from "@/lib/publishChecks";

const statusFilters = ["all", "draft", "published", "ongoing", "completed", "archived", "cancelled"] as const;
type StatusFilter = (typeof statusFilters)[number];

const Events = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [completionMap, setCompletionMap] = useState<Record<string, WeightedResult>>({});
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
      const [attRes, agendaRes, invRes] = await Promise.all([
        supabase.from("attendees").select("event_id").in("event_id", ids),
        supabase.from("agenda_items").select("event_id").in("event_id", ids),
        supabase.from("event_invites").select("event_id").in("event_id", ids),
      ]);

      const count = (rows: any[] | null, eid: string) =>
        (rows || []).filter((r: any) => r.event_id === eid).length;

      const map: Record<string, WeightedResult> = {};
      for (const evt of evts) {
        const counts: EventRelatedCounts = {
          attendees: count(attRes.data, evt.id),
          agenda: count(agendaRes.data, evt.id),
          invites: count(invRes.data, evt.id),
        };
        map[evt.id] = getWeightedCompletion(evt, counts);
      }
      setCompletionMap(map);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.rpc("delete_draft_event", { _event_id: deleteTarget.id });
    setDeleting(false);
    setDeleteTarget(null);

    if (error) {
      toast.error(error.message || "Failed to delete event");
      return;
    }

    toast.success(`"${deleteTarget.title}" has been deleted`);
    setEvents(prev => prev.filter(e => e.id !== deleteTarget.id));
  };

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
          <Button className="gradient-titan border-0 text-primary-foreground gap-2" onClick={() => handleCreateEvent("/dashboard/events/quick-setup")}>
            <Zap className="h-4 w-4" /> Quick Setup
          </Button>
          <Button variant="outline" className="gap-2" asChild>
            <Link to="/dashboard/templates"><Copy className="h-4 w-4" /> From Template</Link>
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => handleCreateEvent("/dashboard/events/new")}>
            <Plus className="h-4 w-4" /> Full Setup
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
            {filtered.map((event) => {
              const completion = completionMap[event.id];
              const pct = completion?.pct ?? 0;
              const ready = completion?.ready ?? false;
              const missingItems = completion?.missing ?? [];
              const isDraft = event.status === "draft";

              return (
                <Card key={event.id} className="cursor-pointer transition-all hover:shadow-lg hover:border-primary/30 relative group">
                  <Link to={`/dashboard/events/${event.id}/hero`} className="block">
                    <CardContent className="p-6">
                      {/* Status row + completion % */}
                      <div className="mb-3 flex items-center justify-between">
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                          event.status === 'published' ? 'bg-accent text-accent-foreground' :
                          event.status === 'draft' ? 'bg-muted text-muted-foreground' :
                          event.status === 'completed' ? 'bg-secondary/10 text-secondary' :
                          'bg-destructive/10 text-destructive'
                        }`}>
                          {event.status}
                        </span>
                        <span className="text-xs font-semibold text-muted-foreground">{pct}%</span>
                      </div>

                      <h3 className="mb-2 font-display text-lg font-semibold pr-6">{event.title}</h3>
                      <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">{event.description || "No description"}</p>

                      {/* Progress bar */}
                      <Progress value={pct} className="mb-3 h-1.5" />

                      {/* Ready to publish badge */}
                      <div className="mb-3">
                        {ready ? (
                          <Badge className="gap-1 bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            Ready to Publish
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 border-destructive/30 text-destructive hover:bg-destructive/5">
                            <AlertCircle className="h-3 w-3" />
                            Not Ready
                          </Badge>
                        )}
                      </div>

                      {/* Event details */}
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

                      {/* Missing items hint */}
                      {!ready && missingItems.length > 0 && (
                        <p className="mt-3 text-[11px] text-muted-foreground/70 line-clamp-1">
                          Missing: {missingItems.slice(0, 3).join(", ")}
                          {missingItems.length > 3 && ` +${missingItems.length - 3} more`}
                        </p>
                      )}
                    </CardContent>
                  </Link>

                  {/* Kebab menu */}
                  <div className="absolute top-4 right-4 z-10">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          onClick={(e) => e.preventDefault()}
                          className="rounded-md p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted"
                        >
                          <MoreVertical className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        {isDraft ? (
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => {
                              e.preventDefault();
                              setDeleteTarget(event);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem disabled className="text-muted-foreground text-xs">
                            Published events cannot be deleted
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
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

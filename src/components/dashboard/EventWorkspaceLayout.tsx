import { useState, useEffect, useCallback } from "react";
import { useParams, Outlet, useLocation, Link } from "react-router-dom";
import { EventWorkspaceProvider, useEventWorkspace } from "@/contexts/EventWorkspaceContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Check, AlertCircle, ChevronRight, Copy, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { PUBLISH_CHECKS, getPublishStatus } from "@/lib/publishChecks";
import { SaveAsTemplateDialog } from "@/components/templates/SaveAsTemplateDialog";
import AiChatWidget from "@/components/ai/AiChatWidget";
import { useIsMobile } from "@/hooks/use-mobile";

const sectionLabels: Record<string, string> = {
  hero: "Hero", info: "Event Info", agenda: "Agenda", organizers: "Organizers", speakers: "Speakers",
  attendees: "Attendees", groups: "Groups", "assign-groups": "Assign Groups",
  transportation: "Transportation", venue: "Venue", gallery: "Gallery", announcements: "Announcements",
  "event-announcements": "Event Alerts", analytics: "Analytics",
  survey: "Survey", communications: "Communications Center",
};

const checkKeyToSection: Record<string, string> = {
  hero: "hero",
  title: "info",
  slug: "info",
  date: "info",
  description: "info",
  venue: "venue",
  client: "info",
};

const PublishReadinessStrip = () => {
  const { event } = useEventWorkspace();
  const isMobile = useIsMobile();
  if (!event || event.status === "archived") return null;

  const publishStatus = getPublishStatus(event);
  const { passed, total, pct, allPass, results } = publishStatus;

  let pillLabel = "Incomplete";
  let pillClass = "bg-destructive/10 text-destructive border-destructive/20";
  if (allPass) {
    pillLabel = "✓ Ready";
    pillClass = "bg-primary/10 text-primary border-primary/20";
  } else if (pct >= 50) {
    pillLabel = "Almost Ready";
    pillClass = "bg-accent text-accent-foreground border-accent";
  }

  return (
    <div className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-2 sm:py-3 border-b border-border bg-muted/30">
      <Progress value={pct} className="w-24 sm:w-48 h-1.5" />
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {passed}/{total}
      </span>
      <div className="ml-auto">
        <Dialog>
          <DialogTrigger asChild>
            <button className={`text-xs font-medium px-2.5 sm:px-3 py-1 rounded-full border cursor-pointer transition-colors hover:opacity-80 whitespace-nowrap ${pillClass}`}>
              {pillLabel}
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[80dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">Publish Readiness</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 mt-2">
              {results.map((r) => (
                <div key={r.key} className="flex items-center gap-3 py-1.5">
                  {r.ok ? (
                    <Check className="h-4 w-4 text-primary shrink-0" />
                  ) : (
                    <X className="h-4 w-4 text-destructive shrink-0" />
                  )}
                  <span className={`text-sm flex-1 ${r.ok ? "text-foreground" : "text-muted-foreground"}`}>
                    {r.label}
                  </span>
                  {!r.ok && checkKeyToSection[r.key] && event && (
                    <Link
                      to={`/dashboard/events/${event.id}/${checkKeyToSection[r.key]}`}
                      className="text-xs text-primary hover:underline whitespace-nowrap"
                    >
                      Fix →
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export const EventWorkspaceLayout: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  if (!id) return <div>No event ID</div>;

  return (
    <EventWorkspaceProvider eventId={id}>
      <div className="flex flex-col h-full">
        <WorkspaceHeader />
        <div className="flex-1 overflow-auto p-3 sm:p-6">
          <Outlet />
        </div>
        <AiChatWidget />
      </div>
    </EventWorkspaceProvider>
  );
};

const WorkspaceHeader: React.FC = () => {
  const { event, saveStatus, manualSave, setEvent, isArchived } = useEventWorkspace();
  const { user } = useAuth();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const sectionSlug = location.pathname.split("/").pop() || "";
  const sectionName = sectionLabels[sectionSlug] || sectionSlug;
  if (!event) return null;

  const handlePublish = async () => {
    const failures = PUBLISH_CHECKS.filter(c => !c.check(event));
    if (failures.length > 0) {
      toast.error(`Cannot publish. Missing: ${failures.map(f => f.label).join(", ")}`);
      return;
    }
    const { error } = await supabase.from("events").update({ status: "published" } as any).eq("id", event.id);
    if (error) { toast.error(error.message); return; }
    setEvent(prev => prev ? { ...prev, status: "published" } : prev);
    toast.success("Event published!");
    if (user) {
      await supabase.from("notifications" as any).insert({
        user_id: user.id, type: "event_published", title: "Event published",
        message: `Your event "${event.title}" is now live.`,
        link: `/dashboard/events/${event.id}/website`,
        metadata: { event_id: event.id },
      });
    }
  };

  const handleArchive = async () => {
    const { error } = await supabase.from("events").update({ status: "archived" } as any).eq("id", event.id);
    if (error) { toast.error(error.message); return; }
    setEvent(prev => prev ? { ...prev, status: "archived" } : prev);
    toast.success("Event archived");
  };

  const statusColor = event.status === "published" ? "bg-accent text-accent-foreground" :
    event.status === "archived" ? "bg-muted text-muted-foreground" : "bg-secondary/20 text-secondary";

  return (
    <>
      <div className="border-b border-border px-4 sm:px-6 py-2 sm:py-3 bg-card space-y-1">
        {/* Breadcrumb — hide on mobile */}
        {!isMobile && (
          <nav className="flex items-center gap-1 text-xs text-muted-foreground">
            <Link to="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
            <ChevronRight className="h-3 w-3" />
            <Link to="/dashboard/events" className="hover:text-foreground transition-colors">Events</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium truncate max-w-[200px]">{event.title || "Untitled"}</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium">{sectionName}</span>
          </nav>
        )}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <h2 className="font-display text-base sm:text-lg font-bold truncate">{event.title || "Untitled Event"}</h2>
            <Badge className={`${statusColor} shrink-0 text-[10px] sm:text-xs`}>{event.status}</Badge>
            <span className="text-xs text-muted-foreground items-center gap-1 hidden sm:flex">
              {saveStatus === "saving" && <><Loader2 className="h-3 w-3 animate-spin" /> Saving...</>}
              {saveStatus === "saved" && <><Check className="h-3 w-3" /> Saved</>}
              {saveStatus === "error" && <><AlertCircle className="h-3 w-3 text-destructive" /> Error</>}
            </span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {!isMobile && (
              <Button variant="outline" size="sm" onClick={() => setTemplateDialogOpen(true)}>
                <Copy className="h-4 w-4 mr-1" /> Save as Template
              </Button>
            )}
            {event.status === "draft" && (
              <Button size="sm" className="gradient-titan border-0 text-primary-foreground text-xs sm:text-sm" onClick={handlePublish}>
                Publish
              </Button>
            )}
            {event.status !== "archived" && !isMobile && (
              <Button variant="ghost" size="sm" onClick={handleArchive}>Archive</Button>
            )}
          </div>
        </div>
        <SaveAsTemplateDialog
          open={templateDialogOpen}
          onOpenChange={setTemplateDialogOpen}
          eventId={event.id}
          eventTitle={event.title || "Untitled"}
          clientId={event.client_id}
        />
      </div>
      <PublishReadinessStrip />
    </>
  );
};

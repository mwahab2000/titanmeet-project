import { useState } from "react";
import { useParams, Outlet, useLocation, Link } from "react-router-dom";
import { EventWorkspaceProvider, useEventWorkspace } from "@/contexts/EventWorkspaceContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Check, AlertCircle, ChevronRight, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { PUBLISH_CHECKS } from "@/pages/workspace/WebsiteSection";
import { SaveAsTemplateDialog } from "@/components/templates/SaveAsTemplateDialog";

const sectionLabels: Record<string, string> = {
  hero: "Hero", info: "Event Info", agenda: "Agenda", organizers: "Organizers", speakers: "Speakers",
  attendees: "Attendees", groups: "Groups", "assign-groups": "Assign Groups",
  transportation: "Transportation", venue: "Venue", gallery: "Gallery", announcements: "Announcements",
  "event-announcements": "Event Alerts",
  survey: "Survey", communications: "Communications",
};

const WorkspaceHeader = () => {
  const { event, saveStatus, manualSave, setEvent, isArchived } = useEventWorkspace();
  const { user } = useAuth();
  const location = useLocation();
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
        user_id: user.id,
        type: "event_published",
        title: "Event published",
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
    <div className="border-b border-border px-6 py-3 bg-card space-y-1">
      <nav className="flex items-center gap-1 text-xs text-muted-foreground">
        <Link to="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
        <ChevronRight className="h-3 w-3" />
        <Link to="/dashboard/events" className="hover:text-foreground transition-colors">Events</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium truncate max-w-[200px]">{event.title || "Untitled"}</span>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium">{sectionName}</span>
      </nav>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-lg font-bold truncate max-w-[300px]">{event.title || "Untitled Event"}</h2>
          <Badge className={statusColor}>{event.status}</Badge>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            {saveStatus === "saving" && <><Loader2 className="h-3 w-3 animate-spin" /> Saving...</>}
            {saveStatus === "saved" && <><Check className="h-3 w-3" /> Saved</>}
            {saveStatus === "error" && <><AlertCircle className="h-3 w-3 text-destructive" /> Error</>}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setTemplateDialogOpen(true)}>
            <Copy className="h-4 w-4 mr-1" /> Save as Template
          </Button>
          {event.status === "draft" && (
            <Button size="sm" className="gradient-titan border-0 text-primary-foreground" onClick={handlePublish}>
              Publish
            </Button>
          )}
          {event.status !== "archived" && (
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
  );
};

export const EventWorkspaceLayout: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  if (!id) return <div>No event ID</div>;

  return (
    <EventWorkspaceProvider eventId={id}>
      <div className="flex flex-col h-full">
        <WorkspaceHeader />
        <div className="flex-1 overflow-auto p-6">
          <Outlet />
        </div>
      </div>
    </EventWorkspaceProvider>
  );
};

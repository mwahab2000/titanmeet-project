import { Link, useLocation } from "react-router-dom";
import { Calendar, LayoutDashboard, Settings, LogOut, Plus, Building2, Image, Images, Info, ListOrdered, UserCog, UsersRound, Layers, Bus, MapPin, Megaphone, ClipboardList, MessageSquare, Users, Mic, Globe, Shirt } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import logo from "@/assets/logo.png";
import { useState, useEffect, useCallback, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEventWorkspaceOptional } from "@/contexts/EventWorkspaceContext";

type CompletionStatus = "empty" | "partial" | "done";

const workspaceSections = [
  { icon: Image, label: "Hero", path: "hero" },
  { icon: Info, label: "Event Info", path: "info" },
  { icon: Mic, label: "Speakers", path: "speakers" },
  { icon: ListOrdered, label: "Agenda", path: "agenda" },
  { icon: UserCog, label: "Organizers", path: "organizers" },
  { icon: UsersRound, label: "Attendees", path: "attendees" },
  { icon: Layers, label: "Groups", path: "groups" },
  { icon: Users, label: "Assign Groups", path: "assign-groups" },
  { icon: Bus, label: "Transportation", path: "transportation" },
  { icon: Shirt, label: "Dress Code", path: "dress-code" },
  { icon: Images, label: "Gallery", path: "gallery" },
  { icon: MapPin, label: "Venue", path: "venue" },
  { icon: Megaphone, label: "Announcements", path: "announcements" },
  { icon: ClipboardList, label: "Survey", path: "survey" },
  { icon: MessageSquare, label: "Communications", path: "communications" },
  { icon: Globe, label: "Website", path: "website" },
];

const dotColor: Record<CompletionStatus, string> = {
  empty: "bg-muted-foreground/40",
  partial: "bg-yellow-400",
  done: "bg-green-400",
};

function computeCompletion(event: any, counts: Record<string, number>): Record<string, CompletionStatus> {
  if (!event) return {};
  const hasTitle = !!event.title?.trim();
  const heroImages = Array.isArray(event.hero_images) ? event.hero_images : [];
  return {
    hero: hasTitle && heroImages.length > 0 ? "done" : hasTitle ? "partial" : "empty",
    info: (hasTitle && event.description && event.event_date) ? "done" : (hasTitle || event.description || event.event_date) ? "partial" : "empty",
    agenda: counts.agenda > 0 ? "done" : "empty",
    organizers: counts.organizers > 0 ? "done" : "empty",
    speakers: counts.speakers > 0 ? "done" : "empty",
    attendees: counts.attendees > 0 ? "done" : "empty",
    groups: counts.groups > 0 ? "done" : "empty",
    "assign-groups": counts.groups > 0 ? "done" : "empty",
    transportation: counts.transportRoutes > 0 ? "done" : "empty",
    "dress-code": counts.dressCode > 0 ? "done" : "empty",
    gallery: (Array.isArray(event.gallery_images) ? event.gallery_images : []).length > 0 ? "done" : "empty",
    venue: event.venue_name ? "done" : "empty",
    announcements: counts.announcements > 0 ? "done" : "empty",
    survey: counts.survey > 0 ? "done" : "empty",
    communications: "done",
    website: "done",
  };
}

export const DashboardSidebar = () => {
  const location = useLocation();
  const { signOut } = useAuth();
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [activeEventTitle, setActiveEventTitle] = useState<string>("");
  const [localCompletionMap, setLocalCompletionMap] = useState<Record<string, CompletionStatus>>({});

  // Use workspace context when available (inside EventWorkspaceLayout)
  const workspaceCtx = useEventWorkspaceOptional();

  // Detect active event from URL
  useEffect(() => {
    const match = location.pathname.match(/\/dashboard\/events\/([^/]+)\//);
    if (match && match[1] !== "new") {
      setActiveEventId(match[1]);
    } else {
      setActiveEventId(null);
    }
  }, [location.pathname]);

  // Load active event data (only when workspace context is NOT available)
  useEffect(() => {
    if (!activeEventId || workspaceCtx) {
      if (!activeEventId) {
        setActiveEventTitle("");
        setLocalCompletionMap({});
      }
      return;
    }
    const load = async () => {
      const [eventRes, a, o, sp, at, g, an, s, tr, dc] = await Promise.all([
        supabase.from("events").select("title, description, event_date, hero_images, venue_name, gallery_images").eq("id", activeEventId).single(),
        supabase.from("agenda_items").select("id", { count: "exact", head: true }).eq("event_id", activeEventId),
        supabase.from("organizers").select("id", { count: "exact", head: true }).eq("event_id", activeEventId),
        supabase.from("speakers" as any).select("id", { count: "exact", head: true }).eq("event_id", activeEventId),
        supabase.from("attendees").select("id", { count: "exact", head: true }).eq("event_id", activeEventId),
        supabase.from("groups").select("id", { count: "exact", head: true }).eq("event_id", activeEventId),
        supabase.from("announcements").select("id", { count: "exact", head: true }).eq("event_id", activeEventId),
        supabase.from("surveys" as any).select("id", { count: "exact", head: true }).eq("event_id", activeEventId),
        supabase.from("transport_routes").select("id", { count: "exact", head: true }).eq("event_id", activeEventId),
        supabase.from("dress_codes" as any).select("id", { count: "exact", head: true }).eq("event_id", activeEventId),
      ]);
      if (eventRes.data) {
        setActiveEventTitle(eventRes.data.title || "Untitled Event");
        setLocalCompletionMap(computeCompletion(eventRes.data, {
          agenda: a.count ?? 0, organizers: o.count ?? 0, speakers: (sp as any).count ?? 0, attendees: at.count ?? 0,
          groups: g.count ?? 0, announcements: an.count ?? 0, survey: s.count ?? 0,
          transportRoutes: tr.count ?? 0, dressCode: (dc as any).count ?? 0,
        }));
      }
    };
    load();
  }, [activeEventId, workspaceCtx]);

  // Use workspace context's completion map when available, otherwise fall back to local
  const completionMap = workspaceCtx?.completionMap ?? localCompletionMap;
  const eventTitle = workspaceCtx?.event?.title || activeEventTitle;
  const isActive = (path: string) => location.pathname === path;

  const isWorkspaceActive = (section: string) =>
    activeEventId && location.pathname === `/dashboard/events/${activeEventId}/${section}`;

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col bg-sidebar border-r border-sidebar-border overflow-y-auto">
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
        <img src={logo} alt="TitanMeet" className="h-8 w-8" />
        <span className="font-display text-lg font-bold text-sidebar-primary">TitanMeet</span>
      </div>

      <div className="p-4">
        <Button className="w-full gradient-titan border-0 text-primary-foreground gap-2" asChild>
          <Link to="/dashboard/events/new">
            <Plus className="h-4 w-4" /> Create Event
          </Link>
        </Button>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        <Link
          to="/dashboard"
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            isActive("/dashboard") ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          }`}
        >
          <LayoutDashboard className="h-4 w-4" /> Dashboard
        </Link>

        <Link
          to="/dashboard/clients/new"
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            isActive("/dashboard/clients/new") ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          }`}
        >
          <Building2 className="h-4 w-4" /> Create Client
        </Link>

        <Link
          to="/dashboard/events"
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            (isActive("/dashboard/events") || activeEventId) ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          }`}
        >
          <Calendar className="h-4 w-4" /> Events
        </Link>

        {/* Contextual workspace sections for the active event */}
        {activeEventId && (
          <div className="ml-4 space-y-0.5 border-l border-sidebar-border pl-2">
            <div className="px-3 py-1.5 text-xs font-semibold text-sidebar-foreground/60 truncate">
              {eventTitle}
            </div>
            {workspaceSections.map((section) => {
              const status = completionMap[section.path];
              return (
                <Link
                  key={section.path}
                  to={`/dashboard/events/${activeEventId}/${section.path}`}
                  className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    isWorkspaceActive(section.path)
                      ? "bg-sidebar-accent text-sidebar-primary"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <section.icon className="h-3.5 w-3.5" />
                  {section.label}
                  {status && <span className={`ml-auto h-1.5 w-1.5 rounded-full ${dotColor[status]}`} />}
                </Link>
              );
            })}
          </div>
        )}

        <Link
          to="/dashboard/settings"
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            isActive("/dashboard/settings") ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          }`}
        >
          <Settings className="h-4 w-4" /> Settings
        </Link>
      </nav>

      <div className="border-t border-sidebar-border p-3 space-y-1">
        <div className="flex items-center justify-between rounded-lg px-3 py-2">
          <span className="text-sm font-medium text-sidebar-foreground">Theme</span>
          <ThemeToggle className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
        </div>
        <button
          onClick={() => signOut()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-destructive"
        >
          <LogOut className="h-4 w-4" /> Sign Out
        </button>
      </div>
    </aside>
  );
};

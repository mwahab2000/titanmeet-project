import { Link, useLocation } from "react-router-dom";
import { Calendar, LayoutDashboard, Settings, LogOut, Plus, Building2, Image, Images, Info, ListOrdered, UserCog, UsersRound, Layers, Bus, MapPin, Megaphone, ClipboardList, MessageSquare, Users, Mic, Globe, Shirt, CreditCard, LifeBuoy, Shield, FileEdit, Copy, MailPlus, ChevronDown, ChevronRight as ChevronRightIcon, Palette, UserCheck, Truck, Sparkles, Send, Bot, BarChart3, Tag, type LucideIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import logo from "@/assets/logo.png";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEventWorkspaceOptional } from "@/contexts/EventWorkspaceContext";
import { useBilling } from "@/hooks/useBilling";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useIsMobile, useIsTablet } from "@/hooks/use-mobile";

type CompletionStatus = "empty" | "partial" | "done";

interface WorkspaceSection {
  icon: LucideIcon;
  label: string;
  path: string;
}

interface SectionGroup {
  label: string;
  icon: LucideIcon;
  sections: WorkspaceSection[];
  step?: number;
}

const sectionGroups: SectionGroup[] = [
  {
    label: "Content",
    icon: Palette,
    step: 1,
    sections: [
      { icon: Image, label: "Hero", path: "hero" },
      { icon: Info, label: "Event Info", path: "info" },
      { icon: Mic, label: "Speakers", path: "speakers" },
      { icon: ListOrdered, label: "Agenda", path: "agenda" },
      { icon: UserCog, label: "Organizers", path: "organizers" },
    ],
  },
  {
    label: "Attendees",
    icon: UserCheck,
    step: 2,
    sections: [
      { icon: UsersRound, label: "Attendees", path: "attendees" },
      { icon: Layers, label: "Groups", path: "groups" },
      { icon: Users, label: "Assign Groups", path: "assign-groups" },
    ],
  },
  {
    label: "Logistics",
    icon: Truck,
    step: 3,
    sections: [
      { icon: Bus, label: "Transportation", path: "transportation" },
      { icon: MapPin, label: "Venue", path: "venue" },
      { icon: Shirt, label: "Dress Code", path: "dress-code" },
    ],
  },
  {
    label: "Publish",
    icon: Send,
    step: 4,
    sections: [
      { icon: Globe, label: "Website", path: "website" },
    ],
  },
  {
    label: "Engagement",
    icon: Sparkles,
    step: 5,
    sections: [
      { icon: Images, label: "Gallery", path: "gallery" },
      { icon: Megaphone, label: "Announcements", path: "announcements" },
      { icon: Megaphone, label: "Event Alerts", path: "event-announcements" },
      { icon: ClipboardList, label: "Survey", path: "survey" },
      { icon: MessageSquare, label: "Communications Center", path: "communications" },
      { icon: BarChart3, label: "Analytics", path: "analytics" },
    ],
  },
];

// Flatten for compatibility
const workspaceSections = sectionGroups.flatMap(g => g.sections);

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
    "event-announcements": "done",
    survey: counts.survey > 0 ? "done" : "empty",
    communications: "done",
    website: "done",
  };
}

function getGroupDotColor(group: SectionGroup, completionMap: Record<string, CompletionStatus>): string {
  const statuses = group.sections.map(s => completionMap[s.path]).filter(Boolean);
  if (statuses.length === 0) return dotColor.empty;
  if (statuses.every(s => s === "done")) return dotColor.done;
  if (statuses.some(s => s === "done" || s === "partial")) return dotColor.partial;
  return dotColor.empty;
}

interface GroupedSectionsProps {
  activeEventId: string;
  completionMap: Record<string, CompletionStatus>;
  eventTitle: string;
  isWorkspaceActive: (section: string) => boolean;
  isIconOnly?: boolean;
}

export const GroupedWorkspaceSections = ({ activeEventId, completionMap, eventTitle, isWorkspaceActive, isIconOnly }: GroupedSectionsProps) => {
  const location = useLocation();
  const currentSection = location.pathname.split("/").pop() || "";

  // Determine which group should be open based on current section
  const activeGroupIndex = sectionGroups.findIndex(g => g.sections.some(s => s.path === currentSection));

  const [openGroups, setOpenGroups] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    sectionGroups.forEach((_, i) => { initial[i] = true; });
    return initial;
  });

  const toggleGroup = (index: number) => {
    setOpenGroups(prev => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <div className="space-y-1">
      <div className="px-3 py-1.5 text-xs font-semibold text-sidebar-foreground/60 truncate">
        {eventTitle}
      </div>
      {sectionGroups.map((group, groupIdx) => {
        const isOpen = openGroups[groupIdx] ?? true;
        const groupDot = getGroupDotColor(group, completionMap);

        return (
          <div key={group.label}>
            <button
              onClick={() => toggleGroup(groupIdx)}
              className="flex w-full items-center justify-between px-3 py-1.5 group"
            >
              <div className="flex items-center gap-1.5">
                {group.step && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-sidebar-accent text-[9px] font-bold text-sidebar-foreground/70">
                    {group.step}
                  </span>
                )}
                <span className={`h-1.5 w-1.5 rounded-full ${groupDot}`} />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/50">
                  {group.label}
                </span>
              </div>
              <ChevronDown
                className="h-3 w-3 text-sidebar-foreground/40 transition-transform duration-200"
                style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-180deg)" }}
              />
            </button>
            <div
              className="overflow-hidden transition-all duration-200"
              style={{ maxHeight: isOpen ? "500px" : "0px" }}
            >
              {group.sections.map((section) => {
                const status = completionMap[section.path];
                if (isIconOnly) {
                  return (
                    <TooltipProvider key={section.path} delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link
                            to={`/dashboard/events/${activeEventId}/${section.path}`}
                            className={`flex items-center justify-center rounded-md px-2 py-1.5 transition-colors ${
                              isWorkspaceActive(section.path)
                                ? "bg-sidebar-accent text-sidebar-primary"
                                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                            }`}
                          >
                            <section.icon className="h-3.5 w-3.5" />
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent side="right">{section.label}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                }
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
          </div>
        );
      })}
    </div>
  );
};

export const DashboardSidebar = () => {
  const location = useLocation();
  const { signOut } = useAuth();
  const { currentPlan } = useBilling();
  const { isAdmin } = useAdminRole();
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [activeEventTitle, setActiveEventTitle] = useState<string>("");
  const [localCompletionMap, setLocalCompletionMap] = useState<Record<string, CompletionStatus>>({});
  const [tabletExpanded, setTabletExpanded] = useState(false);

  const workspaceCtx = useEventWorkspaceOptional();

  useEffect(() => {
    const match = location.pathname.match(/\/dashboard\/events\/([^/]+)\//);
    if (match && match[1] !== "new") {
      setActiveEventId(match[1]);
    } else {
      setActiveEventId(null);
    }
  }, [location.pathname]);

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

  const completionMap = workspaceCtx?.completionMap ?? localCompletionMap;
  const eventTitle = workspaceCtx?.event?.title || activeEventTitle;
  const isActive = (path: string) => location.pathname === path;

  const isWorkspaceActive = (section: string) =>
    activeEventId ? location.pathname === `/dashboard/events/${activeEventId}/${section}` : false;

  // Hide sidebar entirely on mobile
  if (isMobile) return null;

  const isIconOnly = isTablet && !tabletExpanded;
  const sidebarWidth = isIconOnly ? "w-16" : "w-64";

  const navLinks = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard", active: isActive("/dashboard") },
    { to: "/dashboard/ai-builder", icon: Bot, label: "AI Builder", active: isActive("/dashboard/ai-builder") },
    { to: "/dashboard/clients", icon: Building2, label: "Clients", active: location.pathname.startsWith("/dashboard/clients") },
    { to: "/dashboard/events", icon: Calendar, label: "Events", active: isActive("/dashboard/events") || !!activeEventId },
    { to: "/dashboard/events/drafts", icon: FileEdit, label: "Drafts", active: isActive("/dashboard/events/drafts") },
    { to: "/dashboard/templates", icon: Copy, label: "Templates", active: isActive("/dashboard/templates") },
  ];

  const bottomLinks = [
    { to: "/dashboard/billing", icon: CreditCard, label: "Billing", active: isActive("/dashboard/billing"), badge: currentPlan?.name },
    { to: "/dashboard/support", icon: LifeBuoy, label: "Support", active: location.pathname.startsWith("/dashboard/support") },
    ...(isAdmin ? [
      { to: "/dashboard/admin/support", icon: Shield, label: "Manage Tickets", active: isActive("/dashboard/admin/support") },
      { to: "/dashboard/admin/discounts", icon: Tag, label: "Discount Codes", active: isActive("/dashboard/admin/discounts") },
    ] : []),
    { to: "/dashboard/settings", icon: Settings, label: "Settings", active: isActive("/dashboard/settings") },
  ];

  const tourIdMap: Record<string, string> = {
    "/dashboard/clients": "tour-clients",
    "/dashboard/events": "tour-events",
    "/dashboard/billing": "tour-billing",
    "/dashboard/support": "tour-support",
  };

  const renderLink = (link: { to: string; icon: LucideIcon; label: string; active: boolean; badge?: string }) => {
    const inner = (
      <Link
        to={link.to}
        data-tour={tourIdMap[link.to] || undefined}
        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
          isIconOnly ? "justify-center" : ""
        } ${
          link.active ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        }`}
      >
        <link.icon className="h-4 w-4 shrink-0" />
        {!isIconOnly && (
          <>
            {link.label}
            {link.badge && (
              <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0 h-5 border-sidebar-border text-sidebar-foreground/60">
                {link.badge}
              </Badge>
            )}
          </>
        )}
      </Link>
    );

    if (isIconOnly) {
      return (
        <TooltipProvider key={link.to} delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>{inner}</TooltipTrigger>
            <TooltipContent side="right">{link.label}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return <div key={link.to}>{inner}</div>;
  };

  return (
    <aside className={`fixed left-0 top-0 z-40 flex h-screen ${sidebarWidth} flex-col bg-sidebar border-r border-sidebar-border overflow-y-auto transition-all duration-200`}>
      <div className={`flex h-16 items-center gap-2 border-b border-sidebar-border ${isIconOnly ? "justify-center px-2" : "px-6"}`}>
        <img src={logo} alt="TitanMeet" className="h-8 w-8" />
        {!isIconOnly && <span className="font-display text-lg font-bold text-sidebar-primary">TitanMeet</span>}
      </div>

      {!isIconOnly && (
        <div className="p-4">
          <Button className="w-full gradient-titan border-0 text-primary-foreground gap-2" asChild>
            <Link to="/dashboard/events/new">
              <Plus className="h-4 w-4" /> Create Event
            </Link>
          </Button>
        </div>
      )}
      {isIconOnly && (
        <div className="p-2">
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button className="w-full gradient-titan border-0 text-primary-foreground p-0 h-10 w-10 mx-auto" size="icon" asChild>
                  <Link to="/dashboard/events/new"><Plus className="h-4 w-4" /></Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Create Event</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      <nav className="flex-1 space-y-1 px-3">
        {navLinks.map(renderLink)}

        {activeEventId && (
          <div className={`${isIconOnly ? "" : "ml-4"} space-y-0.5 ${isIconOnly ? "" : "border-l border-sidebar-border pl-2"}`}>
            <GroupedWorkspaceSections
              activeEventId={activeEventId}
              completionMap={completionMap}
              eventTitle={isIconOnly ? "" : eventTitle}
              isWorkspaceActive={isWorkspaceActive}
              isIconOnly={isIconOnly}
            />
          </div>
        )}

        {bottomLinks.map(renderLink)}
      </nav>

      <div className="border-t border-sidebar-border p-3 space-y-1">
        {!isIconOnly && (
          <div className="flex items-center justify-between rounded-lg px-3 py-2">
            <span className="text-sm font-medium text-sidebar-foreground">Theme</span>
            <ThemeToggle className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
          </div>
        )}
        {isIconOnly && (
          <div className="flex justify-center py-2">
            <ThemeToggle className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
          </div>
        )}
        <button
          onClick={() => signOut()}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-destructive ${isIconOnly ? "justify-center" : ""}`}
        >
          <LogOut className="h-4 w-4" />
          {!isIconOnly && "Sign Out"}
        </button>
        {isTablet && (
          <button
            onClick={() => setTabletExpanded(!tabletExpanded)}
            className="flex w-full items-center justify-center rounded-lg px-3 py-2.5 text-sidebar-foreground/60 hover:bg-sidebar-accent transition-colors"
          >
            <ChevronRightIcon
              className="h-4 w-4 transition-transform duration-200"
              style={{ transform: tabletExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          </button>
        )}
      </div>
    </aside>
  );
};

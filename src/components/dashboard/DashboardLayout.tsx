import { useState, useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { DashboardSidebar, GroupedWorkspaceSections } from "./DashboardSidebar";
import { NotificationBell } from "./NotificationBell";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile, useIsTablet } from "@/hooks/use-mobile";
import { LayoutDashboard, Building2, Calendar, CreditCard, Settings, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useEventWorkspaceOptional } from "@/contexts/EventWorkspaceContext";
import { FirstLoginTour } from "@/components/onboarding/FirstLoginTour";
import UsageWarningBanner from "@/components/billing/UsageWarningBanner";

const mobileNavItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/dashboard/clients", icon: Building2, label: "Clients" },
  { to: "/dashboard/events", icon: Calendar, label: "Events" },
  { to: "/dashboard/billing", icon: CreditCard, label: "Billing" },
  { to: "/dashboard/settings", icon: Settings, label: "Settings" },
];

export const DashboardLayout = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const location = useLocation();
  const workspaceCtx = useEventWorkspaceOptional();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Detect active event ID from URL
  const eventMatch = location.pathname.match(/\/dashboard\/events\/([^/]+)\//);
  const activeEventId = eventMatch && eventMatch[1] !== "new" ? eventMatch[1] : null;

  const isNavActive = (path: string) => {
    if (path === "/dashboard") return location.pathname === "/dashboard";
    return location.pathname.startsWith(path);
  };

  const isWorkspaceActive = (section: string) =>
    activeEventId ? location.pathname === `/dashboard/events/${activeEventId}/${section}` : false;

  // Determine main content margin
  let mainMargin = "ml-64"; // desktop
  if (isMobile) mainMargin = "ml-0";
  else if (isTablet) mainMargin = "ml-16";

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar />
      <FirstLoginTour />
      <div className={`${mainMargin} min-h-screen transition-all duration-200 ${isMobile ? "pb-16" : ""}`}>
        <header className="flex items-center justify-end border-b border-border px-8 py-3">
          <NotificationBell />
        </header>
        <main className="p-8">
          <UsageWarningBanner />
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom navigation */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 bg-sidebar border-t border-sidebar-border flex items-center justify-around px-2">
          {mobileNavItems.map((item) => {
            // If in workspace, replace Events with Sections sheet trigger
            if (item.to === "/dashboard/events" && activeEventId) {
              return (
                <Sheet key="sections-sheet" open={sheetOpen} onOpenChange={setSheetOpen}>
                  <SheetTrigger asChild>
                    <button className="flex flex-col items-center gap-0.5 text-sidebar-foreground/70 hover:text-sidebar-primary transition-colors">
                      <Menu className="h-5 w-5" />
                      <span className="text-[10px]">Sections</span>
                    </button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="bg-sidebar border-sidebar-border max-h-[70vh] overflow-y-auto">
                    <SheetTitle className="text-sidebar-foreground font-display text-base mb-2">
                      Event Sections
                    </SheetTitle>
                    <div onClick={() => setSheetOpen(false)}>
                      <GroupedWorkspaceSections
                        activeEventId={activeEventId}
                        completionMap={workspaceCtx?.completionMap ?? {}}
                        eventTitle={workspaceCtx?.event?.title || "Event"}
                        isWorkspaceActive={isWorkspaceActive}
                      />
                    </div>
                  </SheetContent>
                </Sheet>
              );
            }

            const active = isNavActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center gap-0.5 transition-colors ${
                  active ? "text-sidebar-primary" : "text-sidebar-foreground/70 hover:text-sidebar-primary"
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px]">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
};

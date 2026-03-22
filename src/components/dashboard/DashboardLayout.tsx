import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { DashboardSidebar, GroupedWorkspaceSections } from "./DashboardSidebar";
import { NotificationBell } from "./NotificationBell";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile, useIsTablet } from "@/hooks/use-mobile";
import { LayoutDashboard, Building2, Calendar, CreditCard, Settings, Menu, Bot } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useEventWorkspaceOptional } from "@/contexts/EventWorkspaceContext";
import { FirstLoginTour } from "@/components/onboarding/FirstLoginTour";
import UsageWarningBanner from "@/components/billing/UsageWarningBanner";

const mobileNavItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Home" },
  { to: "/dashboard/ai-builder", icon: Bot, label: "AI" },
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

  const eventMatch = location.pathname.match(/\/dashboard\/events\/([^/]+)\//);
  const activeEventId = eventMatch && eventMatch[1] !== "new" ? eventMatch[1] : null;

  const isNavActive = (path: string) => {
    if (path === "/dashboard") return location.pathname === "/dashboard";
    return location.pathname.startsWith(path);
  };

  const isWorkspaceActive = (section: string) =>
    activeEventId ? location.pathname === `/dashboard/events/${activeEventId}/${section}` : false;

  let mainMargin = "ml-64";
  if (isMobile) mainMargin = "ml-0";
  else if (isTablet) mainMargin = "ml-16";

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar />
      <FirstLoginTour />
      <div className={`${mainMargin} min-h-screen transition-all duration-200 ${isMobile ? "pb-[4.5rem]" : ""}`}>
        <header className="flex items-center justify-end border-b border-border px-4 sm:px-8 py-2 sm:py-3">
          <NotificationBell />
        </header>
        <main className="p-4 sm:p-8">
          <UsageWarningBanner />
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom navigation */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-sidebar border-t border-sidebar-border flex items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom,0px)]" style={{ minHeight: "56px" }}>
          {mobileNavItems.map((item) => {
            if (item.to === "/dashboard/events" && activeEventId) {
              return (
                <Sheet key="sections-sheet" open={sheetOpen} onOpenChange={setSheetOpen}>
                  <SheetTrigger asChild>
                    <button className="flex flex-col items-center justify-center gap-0.5 text-sidebar-foreground/70 hover:text-sidebar-primary transition-colors min-w-[48px] min-h-[48px] px-1">
                      <Menu className="h-5 w-5" />
                      <span className="text-[10px] leading-tight">Sections</span>
                    </button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="bg-sidebar border-sidebar-border max-h-[70dvh] overflow-y-auto">
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
                className={`flex flex-col items-center justify-center gap-0.5 transition-colors min-w-[48px] min-h-[48px] px-1 ${
                  active ? "text-sidebar-primary" : "text-sidebar-foreground/70 hover:text-sidebar-primary"
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] leading-tight">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
};

import { useState, useEffect, useCallback } from "react";
import { useEventWorkspace } from "@/contexts/EventWorkspaceContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { CommsSidebar, type CommsView } from "@/components/comms/CommsSidebar";
import { CommsOverview } from "@/components/comms/CommsOverview";
import { CommsInboxView } from "@/components/comms/CommsInboxView";
import { CommsSentView } from "@/components/comms/CommsSentView";
import { CommsLogView } from "@/components/comms/CommsLogView";
import { CommsThreadView } from "@/components/comms/CommsThreadView";
import { CommsUsageBadge } from "@/components/comms/CommsUsageBadge";
import { CommsMessageList, type CommsMessage } from "@/components/comms/CommsMessageList";
import { ScheduledMessagesPanel } from "@/components/comms/ScheduledMessagesPanel";
import { CheckinPanel } from "@/components/comms/CheckinPanel";
import { CampaignsView } from "@/components/comms/CampaignsView";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Construction, Clock, FileText, Settings, QrCode } from "lucide-react";

const CommunicationsSection = () => {
  const { event } = useEventWorkspace();
  const isMobile = useIsMobile();
  const [activeView, setActiveView] = useState<CommsView>("overview");
  const [selectedMessage, setSelectedMessage] = useState<CommsMessage | null>(null);
  const [counts, setCounts] = useState({ inbox: 0, unassigned: 0 });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Load counts for badges
  const loadCounts = useCallback(async () => {
    if (!event) return;
    const [inboxRes, unassignedRes] = await Promise.all([
      supabase.from("inbound_messages" as any).select("id", { count: "exact", head: true }).eq("event_id", event.id).eq("resolved_status", "resolved"),
      supabase.from("inbound_messages" as any).select("id", { count: "exact", head: true }).is("event_id", null),
    ]);
    setCounts({
      inbox: (inboxRes as any).count ?? 0,
      unassigned: (unassignedRes as any).count ?? 0,
    });
  }, [event?.id]);

  useEffect(() => { loadCounts(); }, [loadCounts]);

  if (!event) return null;

  const handleNavigate = (view: string) => {
    setActiveView(view as CommsView);
    setSelectedMessage(null);
  };

  const handleSelectMessage = (msg: CommsMessage) => {
    setSelectedMessage(msg);
  };

  const renderMiddlePane = () => {
    switch (activeView) {
      case "overview":
        return <CommsOverview onNavigate={handleNavigate} />;
      case "inbox":
        return (
          <CommsInboxView
            filter="resolved"
            onSelectMessage={handleSelectMessage}
            selectedId={selectedMessage?.id || null}
          />
        );
      case "unassigned":
        return (
          <CommsInboxView
            filter="unassigned"
            onSelectMessage={handleSelectMessage}
            selectedId={selectedMessage?.id || null}
          />
        );
      case "sent":
        return (
          <CommsSentView
            onSelectMessage={handleSelectMessage}
            selectedId={selectedMessage?.id || null}
          />
        );
      case "log":
        return <CommsLogView />;
      case "scheduled":
        return <ScheduledMessagesPanel />;
      case "checkin":
        return <CheckinPanel />;
      case "templates":
      case "settings":
        return (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 p-8">
            {activeView === "templates" && <FileText className="h-8 w-8" />}
            {activeView === "settings" && <Settings className="h-8 w-8" />}
            <p className="text-sm font-medium capitalize">{activeView}</p>
            <p className="text-xs text-center">Coming soon — this feature is under development.</p>
          </div>
        );
      default:
        return null;
    }
  };

  const renderRightPane = () => {
    if (!selectedMessage) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 p-8">
          <p className="text-sm">Select a message to view the conversation</p>
        </div>
      );
    }
    return (
      <CommsThreadView
        message={selectedMessage}
        onBack={() => setSelectedMessage(null)}
      />
    );
  };

  // Mobile layout: drawer sidebar + single pane
  if (isMobile) {
    return (
      <div className="h-[calc(100vh-120px)] flex flex-col">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-52 p-0">
              <CommsSidebar
                activeView={activeView}
                onViewChange={(v) => { setActiveView(v); setSelectedMessage(null); setSidebarOpen(false); }}
                counts={counts}
              />
              <CommsUsageBadge />
            </SheetContent>
          </Sheet>
          <span className="text-sm font-medium capitalize">{activeView}</span>
        </div>
        <div className="flex-1 overflow-hidden">
          {selectedMessage ? renderRightPane() : renderMiddlePane()}
        </div>
      </div>
    );
  }

  // Desktop: 3-pane layout
  return (
    <div className="h-[calc(100vh-120px)] flex rounded-lg border border-border overflow-hidden bg-background">
      {/* Left sidebar */}
      <div className="flex flex-col shrink-0">
        <CommsSidebar
          activeView={activeView}
          onViewChange={(v) => { setActiveView(v); setSelectedMessage(null); }}
          counts={counts}
        />
        <CommsUsageBadge />
      </div>

      {/* Middle pane */}
      <div className="flex-1 min-w-0 border-r border-border overflow-hidden" style={{ maxWidth: ["overview", "log", "scheduled", "checkin"].includes(activeView) ? "100%" : "380px" }}>
        {renderMiddlePane()}
      </div>

      {/* Right pane - only for views that support thread selection */}
      {!["overview", "log", "scheduled", "checkin", "templates", "settings"].includes(activeView) && (
        <div className="flex-1 min-w-0 overflow-hidden">
          {renderRightPane()}
        </div>
      )}
    </div>
  );
};

export default CommunicationsSection;

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Inbox, Send, Clock, FileText, ScrollText,
  AlertCircle, Settings, Mail,
} from "lucide-react";

export type CommsView =
  | "overview"
  | "inbox"
  | "sent"
  | "scheduled"
  | "templates"
  | "log"
  | "unassigned"
  | "settings";

interface CommsSidebarProps {
  activeView: CommsView;
  onViewChange: (view: CommsView) => void;
  counts?: {
    inbox?: number;
    unassigned?: number;
  };
  collapsed?: boolean;
}

const viewItems: { id: CommsView; icon: any; label: string; countKey?: "inbox" | "unassigned" }[] = [
  { id: "overview", icon: LayoutDashboard, label: "Overview" },
  { id: "inbox", icon: Inbox, label: "Inbox", countKey: "inbox" },
  { id: "sent", icon: Send, label: "Sent" },
  { id: "scheduled", icon: Clock, label: "Scheduled" },
  { id: "templates", icon: FileText, label: "Templates" },
  { id: "log", icon: ScrollText, label: "Message Log" },
  { id: "unassigned", icon: AlertCircle, label: "Unassigned", countKey: "unassigned" },
  { id: "settings", icon: Settings, label: "Settings" },
];

export function CommsSidebar({ activeView, onViewChange, counts = {}, collapsed = false }: CommsSidebarProps) {
  return (
    <div className={cn(
      "flex flex-col bg-card border-r border-border h-full",
      collapsed ? "w-12" : "w-48"
    )}>
      <div className={cn("px-3 py-3 border-b border-border", collapsed && "px-1")}>
        {!collapsed && (
          <h3 className="font-display text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Comms Center
          </h3>
        )}
        {collapsed && <Mail className="h-4 w-4 mx-auto text-muted-foreground" />}
      </div>

      <nav className="flex-1 py-1 space-y-0.5 overflow-y-auto">
        {viewItems.map((item) => {
          const isActive = activeView === item.id;
          const count = item.countKey ? counts[item.countKey] : undefined;

          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={cn(
                "flex items-center gap-2 w-full rounded-md transition-colors text-sm",
                collapsed ? "justify-center px-1 py-2" : "px-3 py-1.5",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="h-3.5 w-3.5 shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left truncate">{item.label}</span>
                  {count !== undefined && count > 0 && (
                    <Badge variant="destructive" className="text-[9px] h-4 px-1 min-w-[16px] justify-center">
                      {count}
                    </Badge>
                  )}
                </>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

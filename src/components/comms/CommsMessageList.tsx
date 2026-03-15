import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Search, Mail, MessageSquare, Filter } from "lucide-react";

export interface CommsMessage {
  id: string;
  attendeeName: string;
  attendeeId: string | null;
  channel: "whatsapp" | "email" | "sms";
  preview: string;
  subject?: string;
  lastActivity: string;
  status: "sent" | "delivered" | "opened" | "replied" | "failed" | "unresolved" | "queued";
  direction: "inbound" | "outbound";
  eventName?: string;
  hasSurvey?: boolean;
  fromPhone?: string;
}

type FilterChip = "all" | "whatsapp" | "email" | "replied" | "failed" | "unresolved";

interface CommsMessageListProps {
  messages: CommsMessage[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (msg: CommsMessage) => void;
  emptyMessage?: string;
}

const channelIcon = (ch: string) => {
  if (ch === "whatsapp") return <MessageSquare className="h-3 w-3 text-emerald-500" />;
  return <Mail className="h-3 w-3 text-blue-500" />;
};

const statusBadge = (status: string) => {
  const map: Record<string, { variant: "default" | "secondary" | "outline" | "destructive"; label: string }> = {
    sent: { variant: "secondary", label: "Sent" },
    delivered: { variant: "secondary", label: "Delivered" },
    opened: { variant: "default", label: "Opened" },
    replied: { variant: "default", label: "Replied" },
    failed: { variant: "destructive", label: "Failed" },
    unresolved: { variant: "outline", label: "Unresolved" },
    queued: { variant: "outline", label: "Queued" },
  };
  const cfg = map[status] || { variant: "outline" as const, label: status };
  return <Badge variant={cfg.variant} className="text-[9px] h-4 px-1">{cfg.label}</Badge>;
};

const filterChips: { id: FilterChip; label: string }[] = [
  { id: "all", label: "All" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "email", label: "Email" },
  { id: "replied", label: "Replied" },
  { id: "failed", label: "Failed" },
  { id: "unresolved", label: "Unresolved" },
];

export function CommsMessageList({ messages, loading, selectedId, onSelect, emptyMessage = "No messages" }: CommsMessageListProps) {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterChip>("all");

  const filtered = messages.filter(m => {
    if (activeFilter === "whatsapp" && m.channel !== "whatsapp") return false;
    if (activeFilter === "email" && m.channel !== "email") return false;
    if (activeFilter === "replied" && m.status !== "replied" && m.direction !== "inbound") return false;
    if (activeFilter === "failed" && m.status !== "failed") return false;
    if (activeFilter === "unresolved" && m.status !== "unresolved") return false;
    if (search) {
      const q = search.toLowerCase();
      return m.attendeeName.toLowerCase().includes(q) ||
        m.preview.toLowerCase().includes(q) ||
        (m.subject || "").toLowerCase().includes(q) ||
        (m.fromPhone || "").includes(q);
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      {/* Search */}
      <div className="p-2 border-b border-border space-y-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search messages..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        {/* Filter chips */}
        <div className="flex gap-1 flex-wrap">
          {filterChips.map(f => (
            <Button
              key={f.id}
              variant={activeFilter === f.id ? "default" : "ghost"}
              size="sm"
              className="h-6 text-[10px] px-2"
              onClick={() => setActiveFilter(f.id)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-2 p-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-md" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8 px-4">{emptyMessage}</p>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(msg => (
              <button
                key={msg.id}
                onClick={() => onSelect(msg)}
                className={cn(
                  "w-full text-left px-3 py-2.5 transition-colors hover:bg-muted/50",
                  selectedId === msg.id && "bg-primary/5 border-l-2 border-l-primary"
                )}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  {channelIcon(msg.channel)}
                  <span className="text-xs font-medium truncate flex-1">
                    {msg.attendeeName}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {format(new Date(msg.lastActivity), "MMM d")}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <p className="text-[11px] text-muted-foreground truncate flex-1">
                    {msg.subject || msg.preview}
                  </p>
                  {statusBadge(msg.status)}
                  {msg.hasSurvey && (
                    <Badge variant="outline" className="text-[8px] h-3.5 px-1">Survey</Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

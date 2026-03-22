import { Building2, CalendarDays, MapPin, UserCog, UsersRound, ListOrdered, MessageSquare, Rocket, CheckCircle2, Circle, AlertCircle } from "lucide-react";
import type { DraftState } from "@/hooks/useAIBuilderSession";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

const statusIcon = {
  empty: <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />,
  partial: <AlertCircle className="h-3.5 w-3.5 text-yellow-400" />,
  done: <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />,
};

interface SectionRowProps {
  icon: React.ReactNode;
  label: string;
  status: "empty" | "partial" | "done";
  details?: string;
}

const SectionRow = ({ icon, label, status, details }: SectionRowProps) => (
  <div className={cn(
    "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
    status === "done" ? "bg-green-400/5" : status === "partial" ? "bg-yellow-400/5" : "bg-muted/30"
  )}>
    <span className="text-muted-foreground">{icon}</span>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-medium text-foreground">{label}</p>
      {details && <p className="text-[10px] text-muted-foreground truncate">{details}</p>}
    </div>
    {statusIcon[status]}
  </div>
);

export const AIBuilderDraftPanel = ({ draft }: { draft: DraftState }) => {
  const readyCount = Object.values(draft).filter((s) => s.status === "done").length;
  const totalSections = Object.keys(draft).length;
  const pct = Math.round((readyCount / totalSections) * 100);

  return (
    <div className="flex flex-col h-full border-l border-border bg-card/50 sm:border-l-0 sm:border-t-0">
      <div className="p-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Draft Summary</h3>
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[10px] font-medium text-muted-foreground">{pct}%</span>
        </div>
      </div>

      <ScrollArea className="flex-1 p-3">
        <div className="space-y-1.5">
          <SectionRow icon={<Building2 className="h-4 w-4" />} label="Client" status={draft.client.status} details={draft.client.name || "Not set"} />
          <SectionRow icon={<CalendarDays className="h-4 w-4" />} label="Event Basics" status={draft.eventBasics.status} details={draft.eventBasics.title || "Not set"} />
          <SectionRow icon={<MapPin className="h-4 w-4" />} label="Venue" status={draft.venue.status} details={draft.venue.name || "Not set"} />
          <SectionRow icon={<UserCog className="h-4 w-4" />} label="Organizers" status={draft.organizers.status} details={draft.organizers.count > 0 ? `${draft.organizers.count} added` : "None"} />
          <SectionRow icon={<UsersRound className="h-4 w-4" />} label="Attendees" status={draft.attendees.status} details={draft.attendees.count > 0 ? `${draft.attendees.count} added` : "None"} />
          <SectionRow icon={<ListOrdered className="h-4 w-4" />} label="Agenda" status={draft.agenda.status} details={draft.agenda.items > 0 ? `${draft.agenda.items} items` : "No items"} />
          <SectionRow icon={<MessageSquare className="h-4 w-4" />} label="Communications" status={draft.communications.status} details={draft.communications.status === "done" ? "Ready" : "Not configured"} />
          <SectionRow icon={<Rocket className="h-4 w-4" />} label="Publish Readiness" status={draft.publishReadiness.status} details={draft.publishReadiness.score > 0 ? `${draft.publishReadiness.score}% ready` : "Incomplete"} />
        </div>

        {draft.publishReadiness.missing.length > 0 && (
          <div className="mt-4 rounded-lg border border-yellow-400/20 bg-yellow-400/5 p-3">
            <p className="text-[10px] font-semibold text-yellow-400 uppercase tracking-wider mb-1.5">Missing for publish</p>
            <ul className="space-y-1">
              {draft.publishReadiness.missing.map((item, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-yellow-400 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

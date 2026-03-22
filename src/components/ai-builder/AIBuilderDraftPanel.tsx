import {
  Building2, CalendarDays, MapPin, UserCog, UsersRound, ListOrdered,
  MessageSquare, Rocket, CheckCircle2, Circle, AlertCircle, Mic2,
  FileText, Palette, CircleDot
} from "lucide-react";
import type { DraftState } from "@/hooks/useAIBuilderSession";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AIBuilderRecommendations } from "./AIBuilderRecommendations";
import { Badge } from "@/components/ui/badge";

/* ── Status helpers ── */

const statusIcon = {
  empty: <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />,
  partial: <AlertCircle className="h-3.5 w-3.5 text-yellow-400" />,
  done: <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />,
};

const eventStatusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-yellow-400/10 text-yellow-500 border-yellow-400/20" },
  published: { label: "Published", color: "bg-green-400/10 text-green-500 border-green-400/20" },
  ongoing: { label: "Live", color: "bg-blue-400/10 text-blue-500 border-blue-400/20" },
  completed: { label: "Completed", color: "bg-muted text-muted-foreground border-border" },
  archived: { label: "Archived", color: "bg-muted text-muted-foreground border-border" },
};

/* ── Section Row ── */

interface SectionRowProps {
  icon: React.ReactNode;
  label: string;
  status: "empty" | "partial" | "done";
  details?: string;
}

const SectionRow = ({ icon, label, status, details }: SectionRowProps) => (
  <div className={cn(
    "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
    status === "done" ? "bg-green-400/5" : status === "partial" ? "bg-yellow-400/5" : "bg-muted/20"
  )}>
    <span className="text-muted-foreground">{icon}</span>
    <div className="flex-1 min-w-0">
      <p className="text-[11px] font-medium text-foreground">{label}</p>
      {details && <p className="text-[10px] text-muted-foreground truncate">{details}</p>}
    </div>
    {statusIcon[status]}
  </div>
);

/* ── Main Panel ── */

export const AIBuilderDraftPanel = ({
  draft,
  onApplyRecommendation,
  isLoading,
}: {
  draft: DraftState;
  onApplyRecommendation?: (prompt: string) => void;
  isLoading?: boolean;
}) => {
  const ctx = draft.eventContext;
  const hasContext = !!ctx.eventId || !!ctx.clientId;
  const readyCount = [
    draft.client, draft.eventBasics, draft.venue,
    draft.organizers, draft.attendees, draft.agenda,
  ].filter((s) => s.status === "done").length;
  const totalSections = 6;
  const pct = Math.round((readyCount / totalSections) * 100);

  const statusCfg = eventStatusConfig[ctx.eventStatus || ""] || eventStatusConfig.draft;

  // Compute completed and missing items
  const completedItems: Array<{ label: string; value: string }> = [];
  const missingItems: Array<{ label: string; priority: "required" | "recommended" }> = [];

  if (draft.client.status === "done" && draft.client.name) {
    completedItems.push({ label: "Client", value: draft.client.name });
  } else {
    missingItems.push({ label: "Client", priority: "required" });
  }

  if (draft.eventBasics.title) {
    completedItems.push({ label: "Title", value: draft.eventBasics.title });
  } else {
    missingItems.push({ label: "Event title", priority: "required" });
  }

  if (draft.eventBasics.date) {
    completedItems.push({ label: "Date", value: new Date(draft.eventBasics.date).toLocaleDateString() });
  } else {
    missingItems.push({ label: "Event date", priority: "required" });
  }

  if (draft.eventBasics.location) {
    completedItems.push({ label: "Location", value: draft.eventBasics.location });
  } else {
    missingItems.push({ label: "Location", priority: "recommended" });
  }

  if (draft.venue.status === "done" && draft.venue.name) {
    completedItems.push({ label: "Venue", value: draft.venue.name });
  } else {
    missingItems.push({ label: "Venue", priority: "recommended" });
  }

  if (draft.attendees.count > 0) {
    completedItems.push({ label: "Attendees", value: `${draft.attendees.count}` });
  } else {
    missingItems.push({ label: "Attendees", priority: "recommended" });
  }

  if (draft.organizers.count > 0) {
    completedItems.push({ label: "Organizers", value: `${draft.organizers.count}` });
  }

  if (draft.agenda.items > 0) {
    completedItems.push({ label: "Agenda", value: `${draft.agenda.items} items` });
  } else {
    missingItems.push({ label: "Agenda", priority: "recommended" });
  }

  if (draft.description) {
    completedItems.push({ label: "Description", value: "Set" });
  }

  const requiredMissing = missingItems.filter(m => m.priority === "required");
  const recommendedMissing = missingItems.filter(m => m.priority === "recommended");

  return (
    <div className="flex flex-col h-full border-l border-border bg-card/50 sm:border-l-0 sm:border-t-0">
      {/* Event Context Header */}
      <div className="p-4 border-b border-border space-y-3">
        {hasContext ? (
          <>
            {/* Client */}
            {ctx.clientName && (
              <div className="flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">Client:</span>
                <span className="text-xs font-medium text-foreground truncate">{ctx.clientName}</span>
              </div>
            )}
            {/* Event */}
            {ctx.eventName && (
              <div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-foreground truncate">{ctx.eventName}</span>
                </div>
                {ctx.eventStatus && (
                  <Badge variant="outline" className={cn("mt-1.5 ml-5.5 text-[10px] px-2 py-0", statusCfg.color)}>
                    {statusCfg.label}
                  </Badge>
                )}
              </div>
            )}
            {/* Progress bar */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground">{pct}%</span>
            </div>
          </>
        ) : (
          <div className="text-center py-2">
            <CircleDot className="h-5 w-5 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-xs font-semibold text-foreground">No Event Selected</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Select a client and event to see live status here
            </p>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1 p-3">
        {hasContext ? (
          <div className="space-y-4">
            {/* Sections overview */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">Sections</p>
              <div className="space-y-1">
                <SectionRow icon={<Building2 className="h-3.5 w-3.5" />} label="Client" status={draft.client.status} details={draft.client.name || "Not set"} />
                <SectionRow icon={<CalendarDays className="h-3.5 w-3.5" />} label="Event Basics" status={draft.eventBasics.status} details={draft.eventBasics.title || "Not set"} />
                <SectionRow icon={<MapPin className="h-3.5 w-3.5" />} label="Venue" status={draft.venue.status} details={draft.venue.name || "Not set"} />
                <SectionRow icon={<UserCog className="h-3.5 w-3.5" />} label="Organizers" status={draft.organizers.status} details={draft.organizers.count > 0 ? `${draft.organizers.count} added` : "None"} />
                <SectionRow icon={<UsersRound className="h-3.5 w-3.5" />} label="Attendees" status={draft.attendees.status} details={draft.attendees.count > 0 ? `${draft.attendees.count} added` : "None"} />
                <SectionRow icon={<ListOrdered className="h-3.5 w-3.5" />} label="Agenda" status={draft.agenda.status} details={draft.agenda.items > 0 ? `${draft.agenda.items} items` : "No items"} />
                <SectionRow icon={<MessageSquare className="h-3.5 w-3.5" />} label="Communications" status={draft.communications.status} details={draft.communications.status === "done" ? "Ready" : "Not configured"} />
              </div>
            </div>

            {/* Completed content */}
            {completedItems.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-green-500 uppercase tracking-wider px-1 mb-2">
                  Completed ({completedItems.length})
                </p>
                <div className="space-y-1">
                  {completedItems.map((item) => (
                    <div key={item.label} className="flex items-center justify-between px-3 py-1.5 rounded-md bg-green-400/5">
                      <span className="text-[11px] text-muted-foreground">{item.label}</span>
                      <span className="text-[11px] font-medium text-foreground truncate max-w-[120px]">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Missing items */}
            {missingItems.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-yellow-500 uppercase tracking-wider px-1 mb-2">
                  Missing ({missingItems.length})
                </p>
                <div className="space-y-1">
                  {requiredMissing.map((item) => (
                    <div key={item.label} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-red-400/5">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
                      <span className="text-[11px] text-foreground">{item.label}</span>
                      <span className="text-[9px] text-red-400 ml-auto">Required</span>
                    </div>
                  ))}
                  {recommendedMissing.map((item) => (
                    <div key={item.label} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-yellow-400/5">
                      <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 shrink-0" />
                      <span className="text-[11px] text-foreground">{item.label}</span>
                      <span className="text-[9px] text-yellow-400 ml-auto">Recommended</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Readiness */}
            {draft.publishReadiness.score > 0 && (
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Rocket className="h-3.5 w-3.5 text-primary" />
                  <p className="text-[11px] font-semibold text-foreground">Publish Readiness</p>
                  <span className="text-[10px] font-medium text-primary ml-auto">{draft.publishReadiness.score}%</span>
                </div>
                {draft.publishReadiness.missing.length > 0 && (
                  <ul className="space-y-0.5">
                    {draft.publishReadiness.missing.map((item, i) => (
                      <li key={i} className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                        <span className="h-1 w-1 rounded-full bg-yellow-400 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
                {draft.publishReadiness.missing.length === 0 && (
                  <p className="text-[10px] text-green-500">Ready to publish! 🎉</p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-[11px] text-muted-foreground leading-relaxed max-w-[200px]">
              Start by selecting a client and event in the chat. The event status will appear here.
            </p>
          </div>
        )}
      </ScrollArea>

      {onApplyRecommendation && hasContext && (
        <AIBuilderRecommendations
          draft={draft}
          onApply={onApplyRecommendation}
          disabled={isLoading}
        />
      )}
    </div>
  );
};

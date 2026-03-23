import { useState } from "react";
import { MapPin, ListOrdered, Lightbulb, ChevronDown, ChevronUp, Check, X, RefreshCw, Send, Image, BarChart3, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DraftState } from "@/hooks/useAIBuilderSession";

export interface Recommendation {
  id: string;
  type: "venue" | "agenda" | "comms" | "media" | "analytics" | "lifecycle";
  title: string;
  description: string;
  prompt: string;
  priority: "high" | "medium" | "low";
  reason?: string;
}

function generateRecommendations(draft: DraftState): Recommendation[] {
  const recs: Recommendation[] = [];

  // --- Venue ---
  if (draft.eventBasics.status !== "empty" && draft.venue.status === "empty") {
    recs.push({
      id: "venue-search",
      type: "venue",
      title: "Find a venue",
      description: draft.eventBasics.location
        ? `Search for venues near "${draft.eventBasics.location}"`
        : "Search for a venue that fits your event",
      prompt: draft.eventBasics.location
        ? `Search for venues near ${draft.eventBasics.location} for this event`
        : "Help me find a suitable venue for this event",
      priority: "high",
      reason: "No venue set yet",
    });
  }

  if (draft.venue.status === "done" && !draft.venue.photo_count) {
    recs.push({
      id: "venue-photos",
      type: "venue",
      title: "Add venue photos",
      description: `Browse photos for ${draft.venue.name || "the venue"}`,
      prompt: `Fetch photos for the venue "${draft.venue.name}" so I can pick ones for the event page`,
      priority: "medium",
      reason: "Venue set but no photos added",
    });
  }

  // --- Agenda ---
  if (draft.eventBasics.status !== "empty" && draft.agenda.status === "empty") {
    const eventType = draft.eventBasics.title?.toLowerCase() || "";
    let agendaPrompt = "Generate a suggested agenda for this event";
    let agendaDesc = "Create a structured agenda based on your event details";

    if (eventType.includes("summit") || eventType.includes("conference")) {
      agendaPrompt = "Generate a multi-session conference agenda with keynotes, panels, and networking breaks";
      agendaDesc = "Build a conference-style agenda with keynotes and panels";
    } else if (eventType.includes("workshop") || eventType.includes("training")) {
      agendaPrompt = "Generate a hands-on workshop agenda with sessions, exercises, and Q&A";
      agendaDesc = "Build a workshop agenda with interactive sessions";
    } else if (eventType.includes("gala") || eventType.includes("dinner") || eventType.includes("ceremony")) {
      agendaPrompt = "Generate an event program with reception, ceremony, dinner, and entertainment";
      agendaDesc = "Build a formal program with reception and ceremony";
    }

    recs.push({
      id: "agenda-generate",
      type: "agenda",
      title: "Generate agenda",
      description: agendaDesc,
      prompt: agendaPrompt,
      priority: "high",
      reason: "No agenda items yet",
    });
  }

  if (draft.agenda.status === "partial" && draft.agenda.items < 4) {
    recs.push({
      id: "agenda-expand",
      type: "agenda",
      title: "Expand agenda",
      description: `${draft.agenda.items} item${draft.agenda.items === 1 ? "" : "s"} — add more for a complete program`,
      prompt: "The current agenda is thin. Suggest additional sessions to fill it out.",
      priority: "medium",
      reason: "Agenda has few items",
    });
  }

  if (draft.attendees.count > 50 && draft.agenda.items > 0 && draft.agenda.items < 3) {
    recs.push({
      id: "agenda-scale",
      type: "agenda",
      title: "Scale agenda for audience",
      description: `${draft.attendees.count} attendees but only ${draft.agenda.items} sessions`,
      prompt: `This event has ${draft.attendees.count} attendees but only ${draft.agenda.items} agenda items. Suggest parallel tracks or breakout sessions.`,
      priority: "medium",
      reason: "Large audience, few sessions",
    });
  }

  // --- Media ---
  if (draft.eventBasics.status !== "empty" && draft.media.heroCount === 0) {
    recs.push({
      id: "media-hero",
      type: "media",
      title: "Add hero image",
      description: "Generate or upload a hero image for the event page",
      prompt: "Generate a premium hero image for this event",
      priority: "high",
      reason: "No hero image set",
    });
  }

  if (draft.media.heroCount > 0 && !draft.media.hasBanner && draft.eventBasics.status !== "empty") {
    recs.push({
      id: "media-banner",
      type: "media",
      title: "Add event banner",
      description: "Generate a banner for social sharing and communications",
      prompt: "Generate a banner image for this event",
      priority: "low",
      reason: "Hero set but no banner",
    });
  }

  // --- Communications ---
  if (draft.attendees.count > 0 && draft.communications.status === "empty") {
    recs.push({
      id: "comms-confirm",
      type: "comms",
      title: "Send attendance confirmation",
      description: `${draft.attendees.count} attendees added — send confirmation requests`,
      prompt: "Send attendance confirmation to all attendees via WhatsApp and email",
      priority: "high",
      reason: "Attendees added but no confirmations sent",
    });
  }

  if (draft.communications.status === "partial" && draft.attendees.count > 10) {
    recs.push({
      id: "comms-reminder",
      type: "comms",
      title: "Send reminder to pending",
      description: "Follow up with attendees who haven't confirmed yet",
      prompt: "Send a reminder to all pending attendees who haven't confirmed yet",
      priority: "high",
      reason: "Some attendees still pending",
    });
  }

  // --- Analytics ---
  if (draft.attendees.count > 0 && draft.communications.status !== "empty") {
    recs.push({
      id: "analytics-check",
      type: "analytics",
      title: "Check confirmation stats",
      description: "See RSVP rate and pending breakdown",
      prompt: "Show me the confirmation stats for this event",
      priority: "medium",
      reason: "Communications sent — review results",
    });
  }

  // --- Lifecycle / Readiness ---
  if (draft.publishReadiness.score >= 70 && draft.publishReadiness.score < 100 && draft.eventContext.eventStatus === "draft") {
    recs.push({
      id: "lifecycle-readiness",
      type: "lifecycle",
      title: "Check publish readiness",
      description: `${draft.publishReadiness.score}% ready — review remaining items`,
      prompt: "Check what's still needed to publish this event",
      priority: "medium",
      reason: `Event is ${draft.publishReadiness.score}% ready`,
    });
  }

  if (draft.publishReadiness.score >= 100 && draft.eventContext.eventStatus === "draft") {
    recs.push({
      id: "lifecycle-publish",
      type: "lifecycle",
      title: "Publish event",
      description: "All checks passed — ready to go live",
      prompt: "Publish this event",
      priority: "high",
      reason: "Event meets all publish requirements",
    });
  }

  // --- Organizers ---
  if (draft.eventBasics.status !== "empty" && draft.organizers.count === 0) {
    recs.push({
      id: "organizers-add",
      type: "lifecycle",
      title: "Add organizers",
      description: "Add team members managing this event",
      prompt: "Help me add organizers for this event",
      priority: "medium",
      reason: "No organizers added yet",
    });
  }

  // --- Attendees ---
  if (draft.eventBasics.status !== "empty" && draft.attendees.count === 0 && draft.agenda.items > 0) {
    recs.push({
      id: "attendees-add",
      type: "lifecycle",
      title: "Add attendees",
      description: "Import or add attendees to this event",
      prompt: "Help me add attendees for this event",
      priority: "high",
      reason: "Agenda set but no attendees yet",
    });
  }

  // Sort by priority
  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  recs.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // Limit to top 3
  return recs.slice(0, 3);
}

const typeIcons: Record<string, typeof MapPin> = {
  venue: MapPin,
  agenda: ListOrdered,
  comms: Send,
  media: Image,
  analytics: BarChart3,
  lifecycle: Rocket,
};

const priorityColors: Record<string, string> = {
  high: "border-primary/30 bg-primary/5",
  medium: "border-border bg-card/50",
  low: "border-border/50 bg-muted/20",
};

interface RecommendationCardProps {
  rec: Recommendation;
  onApply: (prompt: string) => void;
  onDismiss: (id: string) => void;
  onAlternative: (prompt: string) => void;
  disabled?: boolean;
}

const RecommendationCard = ({ rec, onApply, onDismiss, onAlternative, disabled }: RecommendationCardProps) => {
  const Icon = typeIcons[rec.type] || Lightbulb;

  return (
    <div className={cn("rounded-lg border p-3 transition-colors", priorityColors[rec.priority])}>
      <div className="flex items-start gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
          <Icon className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground">{rec.title}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{rec.description}</p>
          {rec.reason && (
            <p className="text-[10px] text-muted-foreground/70 mt-0.5 italic">{rec.reason}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-2.5 ml-9">
        <Button
          size="sm"
          variant="default"
          className="h-7 text-[11px] gap-1 px-2.5"
          onClick={() => onApply(rec.prompt)}
          disabled={disabled}
        >
          <Check className="h-3 w-3" />
          Apply
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-[11px] gap-1 px-2"
          onClick={() => onAlternative(`Give me alternative suggestions for: ${rec.title.toLowerCase()}`)}
          disabled={disabled}
        >
          <RefreshCw className="h-3 w-3" />
          Alt
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          onClick={() => onDismiss(rec.id)}
          disabled={disabled}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};

interface AIBuilderRecommendationsProps {
  draft: DraftState;
  onApply: (prompt: string) => void;
  disabled?: boolean;
}

export const AIBuilderRecommendations = ({ draft, onApply, disabled }: AIBuilderRecommendationsProps) => {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(true);

  // Check user preference
  const autoCompleteMode = (() => {
    try { return localStorage.getItem("titanmeet_autocomplete") || "on"; } catch { return "on"; }
  })();

  if (autoCompleteMode === "off") return null;

  const allRecs = generateRecommendations(draft);
  const visibleRecs = allRecs.filter((r) => !dismissed.has(r.id));

  // In "reduced" mode, only show high priority
  const filteredRecs = autoCompleteMode === "reduced"
    ? visibleRecs.filter(r => r.priority === "high")
    : visibleRecs;

  if (filteredRecs.length === 0) return null;

  const handleDismiss = (id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
  };

  return (
    <div className="border-t border-border">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted/30 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Lightbulb className="h-3.5 w-3.5 text-primary" />
          Suggested Next
          <span className="text-[10px] font-normal text-muted-foreground/70">({filteredRecs.length})</span>
        </span>
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {filteredRecs.map((rec) => (
            <RecommendationCard
              key={rec.id}
              rec={rec}
              onApply={onApply}
              onDismiss={handleDismiss}
              onAlternative={onApply}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </div>
  );
};

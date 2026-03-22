import { useState } from "react";
import { MapPin, ListOrdered, Lightbulb, ChevronDown, ChevronUp, Check, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DraftState } from "@/hooks/useAIBuilderSession";

export interface Recommendation {
  id: string;
  type: "venue" | "agenda";
  title: string;
  description: string;
  prompt: string;
  priority: "high" | "medium" | "low";
}

function generateRecommendations(draft: DraftState): Recommendation[] {
  const recs: Recommendation[] = [];

  // --- Venue recommendations ---
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
    });
  }

  if (draft.venue.status === "done" && !draft.venue.photo_count) {
    recs.push({
      id: "venue-photos",
      type: "venue",
      title: "Add venue photos",
      description: `Browse and select photos for ${draft.venue.name || "the venue"}`,
      prompt: `Fetch photos for the venue "${draft.venue.name}" so I can pick ones for the event page`,
      priority: "medium",
    });
  }

  // --- Agenda recommendations ---
  if (draft.eventBasics.status !== "empty" && draft.agenda.status === "empty") {
    const eventType = draft.eventBasics.title?.toLowerCase() || "";
    let agendaPrompt = "Generate a suggested agenda for this event";
    let agendaDesc = "Create a structured agenda based on your event details";

    if (eventType.includes("summit") || eventType.includes("conference")) {
      agendaPrompt = "Generate a multi-session conference agenda with keynotes, panels, and networking breaks";
      agendaDesc = "Build a conference-style agenda with keynotes, panels, and breaks";
    } else if (eventType.includes("workshop") || eventType.includes("training")) {
      agendaPrompt = "Generate a hands-on workshop agenda with sessions, exercises, and Q&A";
      agendaDesc = "Build a workshop agenda with interactive sessions and exercises";
    } else if (eventType.includes("gala") || eventType.includes("dinner") || eventType.includes("ceremony")) {
      agendaPrompt = "Generate an event program with reception, ceremony, dinner, and entertainment";
      agendaDesc = "Build a formal program with reception, ceremony, and entertainment";
    }

    recs.push({
      id: "agenda-generate",
      type: "agenda",
      title: "Generate agenda",
      description: agendaDesc,
      prompt: agendaPrompt,
      priority: "high",
    });
  }

  if (draft.agenda.status === "partial" && draft.agenda.items < 4) {
    recs.push({
      id: "agenda-expand",
      type: "agenda",
      title: "Expand agenda",
      description: `You have ${draft.agenda.items} item${draft.agenda.items === 1 ? "" : "s"} — add more sessions for a complete program`,
      prompt: "The current agenda is thin. Suggest additional sessions to fill it out and make it more complete.",
      priority: "medium",
    });
  }

  if (draft.attendees.count > 50 && draft.agenda.items > 0 && draft.agenda.items < 3) {
    recs.push({
      id: "agenda-scale",
      type: "agenda",
      title: "Scale agenda for audience",
      description: `With ${draft.attendees.count} attendees, consider adding parallel tracks or breakout sessions`,
      prompt: `This event has ${draft.attendees.count} attendees but only ${draft.agenda.items} agenda items. Suggest parallel tracks or breakout sessions to improve the experience.`,
      priority: "medium",
    });
  }

  return recs;
}

const typeIcons: Record<string, typeof MapPin> = {
  venue: MapPin,
  agenda: ListOrdered,
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

  const allRecs = generateRecommendations(draft);
  const visibleRecs = allRecs.filter((r) => !dismissed.has(r.id));

  if (visibleRecs.length === 0) return null;

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
          Recommendations
          <span className="text-[10px] font-normal text-muted-foreground/70">({visibleRecs.length})</span>
        </span>
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {visibleRecs.map((rec) => (
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

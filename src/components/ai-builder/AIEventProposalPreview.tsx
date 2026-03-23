import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Building2, CalendarDays, MapPin, ListOrdered, Users, Palette,
  Mail, Check, Pencil, ChevronDown, ChevronUp, Sparkles,
  Clock, MessageSquare, CheckCircle2, Layers,
} from "lucide-react";

export interface EventProposal {
  client: { name: string; slug: string };
  event: {
    title: string;
    slug: string;
    description: string;
    start_date: string;
    end_date: string;
    location: string;
    theme_id: string;
    max_attendees: number;
  };
  agenda: Array<{
    title: string;
    description?: string;
    start_time: string;
    end_time: string;
    day_number: number;
  }>;
  venue_suggestion?: string;
  attendee_structure?: {
    target_count: number;
    suggested_groups: string[];
    audience_description: string;
  };
  communications?: {
    invitation_subject: string;
    invitation_body: string;
    reminder_subject: string;
    reminder_body: string;
    recommended_channels?: string[];
  };
  branding?: {
    theme_id: string;
    color_mood: string;
    tagline: string;
    visual_style?: string;
  };
  readiness_summary?: {
    completed: string[];
    still_needed: string[];
    next_actions: string[];
  };
  publish_guidance?: string[];
}

export type ProposalSection = "client" | "event" | "agenda" | "communications" | "branding";

interface Props {
  proposal: EventProposal;
  onApprove: () => void;
  onReject: () => void;
  onPartialApply?: (sections: ProposalSection[]) => void;
  disabled?: boolean;
}

interface SectionProps {
  icon: React.ReactNode;
  title: string;
  sectionKey: ProposalSection;
  children: React.ReactNode;
  defaultOpen?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  partialMode?: boolean;
}

const Section = ({ icon, title, children, defaultOpen = true, selected, onToggleSelect, partialMode, sectionKey }: SectionProps) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted/30 transition-colors min-h-[44px]"
      >
        {partialMode && (
          <span
            onClick={(e) => { e.stopPropagation(); onToggleSelect?.(); }}
            className={`h-4 w-4 rounded border shrink-0 flex items-center justify-center cursor-pointer transition-colors ${
              selected ? "bg-primary border-primary" : "border-muted-foreground/40"
            }`}
          >
            {selected && <Check className="h-3 w-3 text-primary-foreground" />}
          </span>
        )}
        <span className="text-muted-foreground">{icon}</span>
        <span className="flex-1 text-left">{title}</span>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {open && <div className="px-3 pb-3 border-t border-border/50">{children}</div>}
    </div>
  );
};

const InfoRow = ({ label, value }: { label: string; value: string | number | undefined | null }) => {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 py-1">
      <span className="text-[11px] text-muted-foreground min-w-[80px] shrink-0">{label}</span>
      <span className="text-xs text-foreground">{String(value)}</span>
    </div>
  );
};

export const AIEventProposalPreview = ({ proposal, onApprove, onReject, onPartialApply, disabled }: Props) => {
  const p = proposal;
  const [partialMode, setPartialMode] = useState(false);
  const [selectedSections, setSelectedSections] = useState<Set<ProposalSection>>(new Set());

  const toggleSection = (s: ProposalSection) => {
    setSelectedSections(prev => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  };

  const handlePartialApply = () => {
    if (selectedSections.size > 0) {
      onPartialApply?.(Array.from(selectedSections));
    }
  };

  return (
    <div className="w-full max-w-lg rounded-2xl border-2 border-primary/20 bg-card shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 to-secondary/10 px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Event Proposal Preview</h3>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">Review before saving — nothing is saved yet.</p>
      </div>

      <ScrollArea className="max-h-[400px]">
        <div className="p-3 space-y-2">
          {/* Client */}
          <Section icon={<Building2 className="h-4 w-4" />} title="Client" sectionKey="client" partialMode={partialMode} selected={selectedSections.has("client")} onToggleSelect={() => toggleSection("client")}>
            <InfoRow label="Name" value={p.client?.name} />
            <InfoRow label="Slug" value={p.client?.slug} />
          </Section>

          {/* Event Basics */}
          <Section icon={<CalendarDays className="h-4 w-4" />} title="Event" sectionKey="event" partialMode={partialMode} selected={selectedSections.has("event")} onToggleSelect={() => toggleSection("event")}>
            <InfoRow label="Title" value={p.event?.title} />
            <InfoRow label="Description" value={p.event?.description} />
            <InfoRow label="Dates" value={p.event?.start_date ? `${new Date(p.event.start_date).toLocaleDateString()} – ${new Date(p.event.end_date).toLocaleDateString()}` : undefined} />
            <InfoRow label="Location" value={p.event?.location} />
            <InfoRow label="Theme" value={p.event?.theme_id} />
            <InfoRow label="Max attendees" value={p.event?.max_attendees} />
          </Section>

          {/* Agenda */}
          {p.agenda?.length > 0 && (
            <Section icon={<ListOrdered className="h-4 w-4" />} title={`Agenda (${p.agenda.length} items)`} sectionKey="agenda" partialMode={partialMode} selected={selectedSections.has("agenda")} onToggleSelect={() => toggleSection("agenda")}>
              <div className="space-y-1.5 mt-1">
                {p.agenda.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg bg-muted/30 px-2.5 py-1.5">
                    <Clock className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {item.start_time && (
                          <span className="text-[10px] font-mono text-muted-foreground">{item.start_time}–{item.end_time}</span>
                        )}
                        {item.day_number > 1 && (
                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 rounded">Day {item.day_number}</span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-foreground">{item.title}</p>
                      {item.description && <p className="text-[10px] text-muted-foreground">{item.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Venue */}
          {p.venue_suggestion && (
            <Section icon={<MapPin className="h-4 w-4" />} title="Venue Suggestion" sectionKey="event" defaultOpen={false} partialMode={false}>
              <p className="text-xs text-foreground mt-1">{p.venue_suggestion}</p>
              <p className="text-[10px] text-muted-foreground mt-1 italic">You can search and select the exact venue after saving.</p>
            </Section>
          )}

          {/* Attendees */}
          {p.attendee_structure && (
            <Section icon={<Users className="h-4 w-4" />} title="Audience" sectionKey="event" defaultOpen={false} partialMode={false}>
              <InfoRow label="Target" value={`${p.attendee_structure.target_count} attendees`} />
              <InfoRow label="Audience" value={p.attendee_structure.audience_description} />
              {p.attendee_structure.suggested_groups?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {p.attendee_structure.suggested_groups.map((g, i) => (
                    <span key={i} className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{g}</span>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* Branding */}
          {p.branding && (
            <Section icon={<Palette className="h-4 w-4" />} title="Branding" sectionKey="branding" defaultOpen={false} partialMode={partialMode} selected={selectedSections.has("branding")} onToggleSelect={() => toggleSection("branding")}>
              <InfoRow label="Theme" value={p.branding.theme_id} />
              <InfoRow label="Mood" value={p.branding.color_mood} />
              <InfoRow label="Tagline" value={p.branding.tagline} />
              {p.branding.visual_style && <InfoRow label="Visual style" value={p.branding.visual_style} />}
            </Section>
          )}

          {/* Communications */}
          {p.communications && (
            <Section icon={<Mail className="h-4 w-4" />} title="Communications Draft" sectionKey="communications" defaultOpen={false} partialMode={partialMode} selected={selectedSections.has("communications")} onToggleSelect={() => toggleSection("communications")}>
              <div className="mt-1 space-y-2">
                {p.communications.recommended_channels && (
                  <div className="flex gap-1.5">
                    {p.communications.recommended_channels.map((ch, i) => (
                      <span key={i} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full capitalize">{ch}</span>
                    ))}
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Invitation</p>
                  <p className="text-xs font-medium text-foreground">{p.communications.invitation_subject}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-3">{p.communications.invitation_body}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Reminder</p>
                  <p className="text-xs font-medium text-foreground">{p.communications.reminder_subject}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-3">{p.communications.reminder_body}</p>
                </div>
              </div>
            </Section>
          )}

          {/* Readiness Summary */}
          {p.readiness_summary && (
            <Section icon={<CheckCircle2 className="h-4 w-4" />} title="Readiness Summary" sectionKey="event" defaultOpen={true} partialMode={false}>
              {p.readiness_summary.completed?.length > 0 && (
                <div className="mt-1">
                  <p className="text-[10px] font-medium text-green-500 uppercase tracking-wider mb-1">Covered by this proposal</p>
                  <ul className="space-y-0.5">
                    {p.readiness_summary.completed.map((item, i) => (
                      <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                        <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {p.readiness_summary.still_needed?.length > 0 && (
                <div className="mt-2">
                  <p className="text-[10px] font-medium text-amber-500 uppercase tracking-wider mb-1">Still needed</p>
                  <ul className="space-y-0.5">
                    {p.readiness_summary.still_needed.map((item, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <span className="h-1 w-1 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {p.readiness_summary.next_actions?.length > 0 && (
                <div className="mt-2">
                  <p className="text-[10px] font-medium text-primary uppercase tracking-wider mb-1">Recommended next</p>
                  <ul className="space-y-0.5">
                    {p.readiness_summary.next_actions.map((item, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <span className="text-[10px] font-mono text-primary">{i + 1}.</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Section>
          )}

          {/* Publish guidance */}
          {p.publish_guidance && p.publish_guidance.length > 0 && !p.readiness_summary && (
            <Section icon={<MessageSquare className="h-4 w-4" />} title="Next Steps" sectionKey="event" defaultOpen={false} partialMode={false}>
              <ul className="mt-1 space-y-1">
                {p.publish_guidance.map((g, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-primary mt-1.5 shrink-0" />
                    {g}
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </ScrollArea>

      {/* Actions */}
      <div className="flex flex-col gap-2 p-3 border-t border-border bg-card">
        {!partialMode ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onReject}
              disabled={disabled}
              className="flex-1 min-h-[44px] gap-1.5"
            >
              <Pencil className="h-3.5 w-3.5" />
              Request Changes
            </Button>
            <Button
              size="sm"
              onClick={onApprove}
              disabled={disabled}
              className="flex-1 min-h-[44px] gap-1.5"
            >
              <Check className="h-3.5 w-3.5" />
              Save Event
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setPartialMode(false); setSelectedSections(new Set()); }}
              disabled={disabled}
              className="flex-1 min-h-[44px] gap-1.5 text-xs"
            >
              Back
            </Button>
            <Button
              size="sm"
              onClick={handlePartialApply}
              disabled={disabled || selectedSections.size === 0}
              className="flex-1 min-h-[44px] gap-1.5 text-xs"
            >
              <Layers className="h-3.5 w-3.5" />
              Apply Selected ({selectedSections.size})
            </Button>
          </div>
        )}
        {!partialMode && onPartialApply && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPartialMode(true)}
            disabled={disabled}
            className="w-full min-h-[36px] gap-1.5 text-xs text-muted-foreground"
          >
            <Layers className="h-3.5 w-3.5" />
            Apply Partially
          </Button>
        )}
      </div>
    </div>
  );
};

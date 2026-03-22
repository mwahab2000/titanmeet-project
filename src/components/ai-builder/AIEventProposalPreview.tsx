import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Building2, CalendarDays, MapPin, ListOrdered, Users, Palette,
  Mail, Check, X, Pencil, ChevronDown, ChevronUp, Sparkles,
  Clock, MessageSquare,
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
  };
  branding?: {
    theme_id: string;
    color_mood: string;
    tagline: string;
  };
  publish_guidance?: string[];
}

interface Props {
  proposal: EventProposal;
  onApprove: () => void;
  onReject: () => void;
  disabled?: boolean;
}

interface SectionProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const Section = ({ icon, title, children, defaultOpen = true }: SectionProps) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted/30 transition-colors min-h-[44px]"
      >
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

export const AIEventProposalPreview = ({ proposal, onApprove, onReject, disabled }: Props) => {
  const p = proposal;

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
          <Section icon={<Building2 className="h-4 w-4" />} title="Client">
            <InfoRow label="Name" value={p.client?.name} />
            <InfoRow label="Slug" value={p.client?.slug} />
          </Section>

          {/* Event Basics */}
          <Section icon={<CalendarDays className="h-4 w-4" />} title="Event">
            <InfoRow label="Title" value={p.event?.title} />
            <InfoRow label="Description" value={p.event?.description} />
            <InfoRow label="Dates" value={p.event?.start_date ? `${new Date(p.event.start_date).toLocaleDateString()} – ${new Date(p.event.end_date).toLocaleDateString()}` : undefined} />
            <InfoRow label="Location" value={p.event?.location} />
            <InfoRow label="Theme" value={p.event?.theme_id} />
            <InfoRow label="Max attendees" value={p.event?.max_attendees} />
          </Section>

          {/* Agenda */}
          {p.agenda?.length > 0 && (
            <Section icon={<ListOrdered className="h-4 w-4" />} title={`Agenda (${p.agenda.length} items)`}>
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
            <Section icon={<MapPin className="h-4 w-4" />} title="Venue Suggestion" defaultOpen={false}>
              <p className="text-xs text-foreground mt-1">{p.venue_suggestion}</p>
              <p className="text-[10px] text-muted-foreground mt-1 italic">You can search and select the exact venue after saving.</p>
            </Section>
          )}

          {/* Attendees */}
          {p.attendee_structure && (
            <Section icon={<Users className="h-4 w-4" />} title="Audience" defaultOpen={false}>
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
            <Section icon={<Palette className="h-4 w-4" />} title="Branding" defaultOpen={false}>
              <InfoRow label="Theme" value={p.branding.theme_id} />
              <InfoRow label="Mood" value={p.branding.color_mood} />
              <InfoRow label="Tagline" value={p.branding.tagline} />
            </Section>
          )}

          {/* Communications */}
          {p.communications && (
            <Section icon={<Mail className="h-4 w-4" />} title="Communications Draft" defaultOpen={false}>
              <div className="mt-1 space-y-2">
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

          {/* Publish guidance */}
          {p.publish_guidance?.length > 0 && (
            <Section icon={<MessageSquare className="h-4 w-4" />} title="Next Steps" defaultOpen={false}>
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
      <div className="flex gap-2 p-3 border-t border-border bg-card">
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
    </div>
  );
};

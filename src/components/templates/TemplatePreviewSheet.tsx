import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Star, Calendar, Users, MapPin, ListOrdered, Mic, UserCog, Bus, ClipboardList, Globe, Mail, Tag } from "lucide-react";
import { SECTION_LABELS, CATEGORY_LABELS, IncludedSection, TemplateCategory, MarketplaceTemplate } from "@/lib/template-api";
import { format } from "date-fns";

interface Props {
  template: MarketplaceTemplate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUseTemplate: () => void;
}

const SECTION_ICONS: Record<string, typeof Calendar> = {
  website: Globe,
  agenda: ListOrdered,
  speakers: Mic,
  organizers: UserCog,
  dress_codes: Star,
  transport: Bus,
  surveys: ClipboardList,
};

export const TemplatePreviewSheet = ({ template, open, onOpenChange, onUseTemplate }: Props) => {
  const td = template.template_data || {};
  const comm = template.comm_templates || {};
  const hasComm = Object.values(comm).some(v => !!v);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg p-0">
        <ScrollArea className="h-full">
          <div className="p-6 space-y-6">
            <SheetHeader>
              <div className="flex items-center gap-2">
                {template.is_featured && <Star className="h-5 w-5 text-primary fill-primary/30" />}
                <SheetTitle className="font-display text-xl">{template.name}</SheetTitle>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="capitalize">
                  {CATEGORY_LABELS[template.category as TemplateCategory] || template.category}
                </Badge>
                {template.event_type && template.event_type !== "other" && (
                  <Badge variant="secondary" className="capitalize">{template.event_type}</Badge>
                )}
                {template.expected_attendees && (
                  <Badge variant="secondary">
                    <Users className="h-3 w-3 mr-1" />{template.expected_attendees} attendees
                  </Badge>
                )}
              </div>
            </SheetHeader>

            {template.description && (
              <p className="text-sm text-muted-foreground">{template.description}</p>
            )}

            {/* Tags */}
            {(template.tags || []).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {template.tags.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                    <Tag className="h-2.5 w-2.5" />{tag}
                  </span>
                ))}
              </div>
            )}

            <Separator />

            {/* Included Sections */}
            <div>
              <h3 className="font-semibold text-sm mb-3">Included Sections</h3>
              <div className="grid grid-cols-2 gap-2">
                {(template.included_sections || []).map((s: string) => {
                  const Icon = SECTION_ICONS[s] || Globe;
                  return (
                    <div key={s} className="flex items-center gap-2 rounded-md border border-border p-2.5 text-sm">
                      <Icon className="h-4 w-4 text-primary shrink-0" />
                      <span>{SECTION_LABELS[s as IncludedSection] || s}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Content Preview */}
            {td.title && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold text-sm mb-2">Content Preview</h3>
                  <div className="space-y-2 text-sm">
                    {td.title && <p><span className="text-muted-foreground">Title pattern:</span> {td.title}</p>}
                    {td.theme_id && <p><span className="text-muted-foreground">Theme:</span> <Badge variant="outline" className="capitalize">{td.theme_id}</Badge></p>}
                    {td.venue_name && (
                      <p className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">Venue:</span> {td.venue_name}
                      </p>
                    )}
                    {td.agenda_items && td.agenda_items.length > 0 && (
                      <p><span className="text-muted-foreground">Agenda items:</span> {td.agenda_items.length}</p>
                    )}
                    {td.speakers && td.speakers.length > 0 && (
                      <p><span className="text-muted-foreground">Speaker slots:</span> {td.speakers.length}</p>
                    )}
                    {td.organizers && td.organizers.length > 0 && (
                      <p><span className="text-muted-foreground">Organizer roles:</span> {td.organizers.length}</p>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Agenda Preview */}
            {td.agenda_items && td.agenda_items.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                    <ListOrdered className="h-4 w-4 text-primary" /> Agenda ({td.agenda_items.length} items)
                  </h3>
                  <div className="space-y-1.5">
                    {td.agenda_items.slice(0, 6).map((item: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-sm p-2 rounded bg-muted/50">
                        {item.start_time && <span className="text-xs text-muted-foreground font-mono w-14 shrink-0">{item.start_time}</span>}
                        <span className="truncate">{item.title}</span>
                      </div>
                    ))}
                    {td.agenda_items.length > 6 && (
                      <p className="text-xs text-muted-foreground">+{td.agenda_items.length - 6} more items</p>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Communication Templates */}
            {hasComm && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                    <Mail className="h-4 w-4 text-primary" /> Communication Templates
                  </h3>
                  <div className="space-y-2">
                    {comm.invitation_subject && (
                      <div className="rounded border border-border p-3">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Invitation</p>
                        <p className="text-sm font-medium">{comm.invitation_subject}</p>
                        {comm.invitation_body && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{comm.invitation_body}</p>}
                      </div>
                    )}
                    {comm.reminder_subject && (
                      <div className="rounded border border-border p-3">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Reminder</p>
                        <p className="text-sm font-medium">{comm.reminder_subject}</p>
                      </div>
                    )}
                    {comm.followup_subject && (
                      <div className="rounded border border-border p-3">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Follow-up</p>
                        <p className="text-sm font-medium">{comm.followup_subject}</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Meta */}
            <Separator />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Created {format(new Date(template.created_at), "MMM d, yyyy")}</span>
              {template.clients?.name && <span>Client: {template.clients.name}</span>}
            </div>

            {/* CTA */}
            <Button className="w-full" size="lg" onClick={onUseTemplate}>
              Use This Template
            </Button>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

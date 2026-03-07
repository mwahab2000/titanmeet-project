import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useEventWorkspace } from "@/contexts/EventWorkspaceContext";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Lock, Copy, Check } from "lucide-react";
import { useState } from "react";

const EventInfoSection = () => {
  const { event, autosave, isArchived } = useEventWorkspace();
  const [copied, setCopied] = useState(false);

  const copySlug = () => {
    if (event?.slug) {
      navigator.clipboard.writeText(event.slug);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  if (!event) return null;

  const date = event.event_date ? new Date(event.event_date + "T00:00:00") : undefined;

  return (
    <Card>
      <CardHeader><CardTitle className="font-display">Event Info</CardTitle></CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>Event Name</Label>
          <Input value={event.title || ""} onChange={e => autosave({ title: e.target.value })} disabled={isArchived} />
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea rows={5} value={event.description || ""} onChange={e => autosave({ description: e.target.value })} disabled={isArchived} />
        </div>
        <div className="space-y-2">
          <Label>Event Date *</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[240px] justify-start text-left font-normal", !date && "text-muted-foreground")} disabled={isArchived}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={date} onSelect={d => { if (d) autosave({ event_date: format(d, "yyyy-MM-dd") }); }} className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label>Event Slug</Label>
          <Input value={event.slug || ""} onChange={e => autosave({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} disabled={isArchived} />
          <p className="text-xs text-muted-foreground">Used in the public URL</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default EventInfoSection;

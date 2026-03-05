import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { createEventFromTemplate, SECTION_LABELS, IncludedSection } from "@/lib/template-api";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  templateName: string;
  includedSections: string[];
  defaultClientId?: string | null;
}

export const UseTemplateDialog = ({ open, onOpenChange, templateId, templateName, includedSections, defaultClientId }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [clientId, setClientId] = useState(defaultClientId || "");
  const [eventDate, setEventDate] = useState("");
  const [clients, setClients] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [slugError, setSlugError] = useState("");

  useEffect(() => {
    if (!open) return;
    supabase.from("clients").select("id, name, slug").order("name").then(({ data }) => setClients(data || []));
  }, [open]);

  // Auto-generate slug from title
  useEffect(() => {
    setSlug(title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
  }, [title]);

  // Validate slug uniqueness
  useEffect(() => {
    if (!slug || !clientId) { setSlugError(""); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase.from("events").select("id").eq("client_id", clientId).eq("slug", slug).maybeSingle();
      setSlugError(data ? "Slug already exists for this client" : "");
    }, 400);
    return () => clearTimeout(t);
  }, [slug, clientId]);

  const handleCreate = async () => {
    if (!title.trim() || !slug.trim() || !clientId || !eventDate || !user || slugError) return;
    setCreating(true);
    try {
      const newEvent = await createEventFromTemplate(templateId, {
        title: title.trim(),
        slug: slug.trim(),
        client_id: clientId,
        start_date: new Date(eventDate).toISOString(),
        end_date: new Date(eventDate).toISOString(),
        event_date: eventDate,
      }, user.id);
      toast.success("Event created from template!");
      onOpenChange(false);
      navigate(`/dashboard/events/${newEvent.id}/hero`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create event");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Event from Template</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Using: <strong>{templateName}</strong></p>
        <div className="flex flex-wrap gap-1 mb-2">
          {includedSections.map(s => (
            <Badge key={s} variant="secondary" className="text-[10px]">
              {SECTION_LABELS[s as IncludedSection] || s}
            </Badge>
          ))}
        </div>
        <div className="space-y-4">
          <div>
            <Label>Event Name *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="My New Event" />
          </div>
          <div>
            <Label>Slug *</Label>
            <Input value={slug} onChange={e => setSlug(e.target.value)} placeholder="my-new-event" />
            {slugError && <p className="text-xs text-destructive mt-1">{slugError}</p>}
          </div>
          <div>
            <Label>Client *</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
              <SelectContent>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Event Date *</Label>
            <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={creating || !title.trim() || !slug.trim() || !clientId || !eventDate || !!slugError}>
            {creating ? "Creating…" : "Create Event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

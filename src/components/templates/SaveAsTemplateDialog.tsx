import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { buildTemplateFromEvent, SECTION_LABELS, IncludedSection } from "@/lib/template-api";
import { toast } from "sonner";

const ALL_SECTIONS: IncludedSection[] = ["website", "agenda", "speakers", "organizers", "dress_codes", "transport", "surveys"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventTitle: string;
  clientId?: string | null;
}

export const SaveAsTemplateDialog = ({ open, onOpenChange, eventId, eventTitle, clientId }: Props) => {
  const { user } = useAuth();
  const [name, setName] = useState(`${eventTitle} Template`);
  const [description, setDescription] = useState("");
  const [sections, setSections] = useState<IncludedSection[]>(["website", "agenda", "speakers", "organizers", "transport", "surveys"]);
  const [saving, setSaving] = useState(false);

  const toggle = (s: IncludedSection) => {
    setSections(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const handleSave = async () => {
    if (!name.trim() || !user) return;
    setSaving(true);
    try {
      const templateData = await buildTemplateFromEvent(eventId, sections);
      const { error } = await supabase.from("event_templates" as any).insert({
        user_id: user.id,
        client_id: clientId || null,
        name: name.trim(),
        description: description.trim() || null,
        template_data: templateData,
        included_sections: sections,
      });
      if (error) throw error;
      toast.success("Template saved successfully");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Save as Template</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Template Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Annual Conference" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional notes about this template" rows={2} />
          </div>
          <div>
            <Label className="mb-2 block">Include Sections</Label>
            <div className="space-y-2">
              {ALL_SECTIONS.map(s => (
                <label key={s} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={sections.includes(s)} onCheckedChange={() => toggle(s)} />
                  {SECTION_LABELS[s]}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? "Saving…" : "Save Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

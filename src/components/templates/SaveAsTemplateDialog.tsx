import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { buildTemplateFromEvent, SECTION_LABELS, CATEGORY_LABELS, IncludedSection, TemplateCategory } from "@/lib/template-api";
import { toast } from "sonner";

const ALL_SECTIONS: IncludedSection[] = ["website", "agenda", "speakers", "organizers", "dress_codes", "transport", "surveys"];
const ALL_CATEGORIES: TemplateCategory[] = ["general", "corporate", "social", "conference", "workshop", "gala", "retreat"];

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
  const [category, setCategory] = useState<TemplateCategory>("general");
  const [tags, setTags] = useState("");
  const [sections, setSections] = useState<IncludedSection[]>(["website", "agenda", "speakers", "organizers", "transport", "surveys"]);
  const [invitationSubject, setInvitationSubject] = useState("");
  const [invitationBody, setInvitationBody] = useState("");
  const [reminderSubject, setReminderSubject] = useState("");
  const [saving, setSaving] = useState(false);

  const toggle = (s: IncludedSection) => {
    setSections(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const handleSave = async () => {
    if (!name.trim() || !user) return;
    setSaving(true);
    try {
      const templateData = await buildTemplateFromEvent(eventId, sections);
      const commTemplates: Record<string, string> = {};
      if (invitationSubject) commTemplates.invitation_subject = invitationSubject;
      if (invitationBody) commTemplates.invitation_body = invitationBody;
      if (reminderSubject) commTemplates.reminder_subject = reminderSubject;

      const parsedTags = tags.split(",").map(t => t.trim()).filter(Boolean);

      const { error } = await supabase.from("event_templates" as any).insert({
        user_id: user.id,
        client_id: clientId || null,
        name: name.trim(),
        description: description.trim() || null,
        template_data: templateData,
        included_sections: sections,
        category,
        tags: parsedTags,
        comm_templates: commTemplates,
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
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as TemplateCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALL_CATEGORIES.map(c => (
                    <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tags</Label>
              <Input value={tags} onChange={e => setTags(e.target.value)} placeholder="sales, kickoff, annual" />
              <p className="text-[10px] text-muted-foreground mt-0.5">Comma-separated</p>
            </div>
          </div>
          <div>
            <Label className="mb-2 block">Include Sections</Label>
            <div className="grid grid-cols-2 gap-2">
              {ALL_SECTIONS.map(s => (
                <label key={s} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={sections.includes(s)} onCheckedChange={() => toggle(s)} />
                  {SECTION_LABELS[s]}
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label className="mb-2 block">Communication Templates (optional)</Label>
            <div className="space-y-2">
              <Input value={invitationSubject} onChange={e => setInvitationSubject(e.target.value)} placeholder="Invitation subject line" />
              <Textarea value={invitationBody} onChange={e => setInvitationBody(e.target.value)} placeholder="Invitation email body" rows={2} />
              <Input value={reminderSubject} onChange={e => setReminderSubject(e.target.value)} placeholder="Reminder subject line" />
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

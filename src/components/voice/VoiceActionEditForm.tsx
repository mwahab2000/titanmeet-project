import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { VoiceActionEnvelope } from "@/types/voice";

interface VoiceActionEditFormProps {
  action: VoiceActionEnvelope;
  onSave: (actionId: string, payload: Record<string, unknown>) => void;
  onCancel: () => void;
}

const fieldDefs: Record<string, { key: string; label: string; type: "text" | "textarea" | "date" | "time" }[]> = {
  add_agenda_item: [
    { key: "title", label: "Title", type: "text" },
    { key: "start_time", label: "Start Time (HH:MM)", type: "time" },
    { key: "end_time", label: "End Time (HH:MM)", type: "time" },
    { key: "description", label: "Notes", type: "textarea" },
  ],
  update_agenda_item: [
    { key: "title", label: "Title", type: "text" },
    { key: "start_time", label: "Start Time (HH:MM)", type: "time" },
    { key: "end_time", label: "End Time (HH:MM)", type: "time" },
    { key: "description", label: "Notes", type: "textarea" },
  ],
  add_speaker: [
    { key: "name", label: "Name", type: "text" },
    { key: "title", label: "Title", type: "text" },
    { key: "linkedin_url", label: "LinkedIn URL", type: "text" },
  ],
  update_speaker: [
    { key: "name", label: "Name", type: "text" },
    { key: "title", label: "Title", type: "text" },
    { key: "linkedin_url", label: "LinkedIn URL", type: "text" },
  ],
  update_event_fields: [
    { key: "title", label: "Event Title", type: "text" },
    { key: "start_date", label: "Start Date", type: "date" },
    { key: "description", label: "Description", type: "textarea" },
  ],
  set_venue: [{ key: "venue_name", label: "Venue Name", type: "text" }],
};

const VoiceActionEditForm: React.FC<VoiceActionEditFormProps> = ({ action, onSave, onCancel }) => {
  const fields = fieldDefs[action.type] || [];
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of fields) {
      init[f.key] = String(action.payload[f.key] ?? "");
    }
    return init;
  });

  if (fields.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-2">
        This action type cannot be edited inline.
        <Button variant="ghost" size="sm" onClick={onCancel} className="ml-2">Close</Button>
      </div>
    );
  }

  const handleSave = () => {
    const payload: Record<string, unknown> = {};
    for (const f of fields) {
      if (values[f.key]?.trim()) payload[f.key] = values[f.key].trim();
    }
    onSave(action.id, payload);
  };

  return (
    <div className="space-y-3 pt-2 pb-1 border-t border-border mt-2 animate-fade-in">
      {fields.map((f) => (
        <div key={f.key} className="space-y-1">
          <Label className="text-xs">{f.label}</Label>
          {f.type === "textarea" ? (
            <Textarea
              value={values[f.key] || ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              className="text-sm min-h-[60px]"
            />
          ) : (
            <Input
              type={f.type === "date" ? "date" : f.type === "time" ? "time" : "text"}
              value={values[f.key] || ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              className="text-sm h-8"
            />
          )}
        </div>
      ))}
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave}>Save</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
};

export default VoiceActionEditForm;

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import type { QuestionType } from "@/lib/survey-api";

interface Props {
  type: QuestionType;
  settings: Record<string, any>;
  onChange: (settings: Record<string, any>) => void;
  disabled?: boolean;
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "option";
}

export function QuestionSettings({ type, settings, onChange, disabled }: Props) {
  if (type === "yes_no" || type === "date") return null;

  if (type === "single_choice" || type === "multi_choice") {
    const options: { label: string; value: string }[] = settings.options || [];
    const setOpts = (opts: typeof options) => onChange({ ...settings, options: opts });
    return (
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Options</Label>
        {options.map((opt, i) => (
          <div key={i} className="flex gap-2 items-center">
            <Input
              className="flex-1 h-8 text-sm"
              value={opt.label}
              placeholder={`Option ${i + 1}`}
              disabled={disabled}
              onChange={e => {
                const newOpts = [...options];
                newOpts[i] = { label: e.target.value, value: slugify(e.target.value) };
                setOpts(newOpts);
              }}
            />
            {!disabled && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpts(options.filter((_, j) => j !== i))}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            )}
          </div>
        ))}
        {!disabled && (
          <Button variant="outline" size="sm" className="gap-1" onClick={() => setOpts([...options, { label: "", value: `option_${options.length + 1}` }])}>
            <Plus className="h-3.5 w-3.5" /> Add Option
          </Button>
        )}
      </div>
    );
  }

  if (type === "rating_stars") {
    return (
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">Max stars</Label>
        <Input
          type="number" min={1} max={10} className="w-20 h-8 text-sm"
          value={settings.max ?? 5} disabled={disabled}
          onChange={e => onChange({ ...settings, max: Number(e.target.value) })}
        />
      </div>
    );
  }

  if (type === "likert") {
    const labels = settings.labels || {};
    return (
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs text-muted-foreground">Min</Label><Input type="number" className="h-8 text-sm" value={settings.min ?? 1} disabled={disabled} onChange={e => onChange({ ...settings, min: Number(e.target.value) })} /></div>
        <div><Label className="text-xs text-muted-foreground">Max</Label><Input type="number" className="h-8 text-sm" value={settings.max ?? 5} disabled={disabled} onChange={e => onChange({ ...settings, max: Number(e.target.value) })} /></div>
        <div><Label className="text-xs text-muted-foreground">Min label</Label><Input className="h-8 text-sm" value={labels[String(settings.min ?? 1)] ?? ""} disabled={disabled} onChange={e => onChange({ ...settings, labels: { ...labels, [String(settings.min ?? 1)]: e.target.value } })} /></div>
        <div><Label className="text-xs text-muted-foreground">Max label</Label><Input className="h-8 text-sm" value={labels[String(settings.max ?? 5)] ?? ""} disabled={disabled} onChange={e => onChange({ ...settings, labels: { ...labels, [String(settings.max ?? 5)]: e.target.value } })} /></div>
      </div>
    );
  }

  if (type === "short_text" || type === "long_text") {
    return (
      <div className="flex gap-4 items-center">
        <div className="flex-1"><Label className="text-xs text-muted-foreground">Placeholder</Label><Input className="h-8 text-sm" value={settings.placeholder ?? ""} disabled={disabled} onChange={e => onChange({ ...settings, placeholder: e.target.value })} /></div>
        <div className="w-24"><Label className="text-xs text-muted-foreground">Max length</Label><Input type="number" className="h-8 text-sm" value={settings.maxLength ?? 0} disabled={disabled} onChange={e => onChange({ ...settings, maxLength: Number(e.target.value) })} /></div>
      </div>
    );
  }

  if (type === "number") {
    return (
      <div className="grid grid-cols-3 gap-2">
        <div><Label className="text-xs text-muted-foreground">Min</Label><Input type="number" className="h-8 text-sm" value={settings.min ?? 0} disabled={disabled} onChange={e => onChange({ ...settings, min: Number(e.target.value) })} /></div>
        <div><Label className="text-xs text-muted-foreground">Max</Label><Input type="number" className="h-8 text-sm" value={settings.max ?? 100} disabled={disabled} onChange={e => onChange({ ...settings, max: Number(e.target.value) })} /></div>
        <div><Label className="text-xs text-muted-foreground">Step</Label><Input type="number" className="h-8 text-sm" value={settings.step ?? 1} disabled={disabled} onChange={e => onChange({ ...settings, step: Number(e.target.value) })} /></div>
      </div>
    );
  }

  return null;
}

import { useState, useRef, useEffect, useCallback } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { GripVertical, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { QuestionSettings } from "./QuestionSettings";
import { QUESTION_TYPES, defaultSettings, type QuestionType, type SurveyQuestion } from "@/lib/survey-api";

interface Props {
  question: SurveyQuestion;
  onUpdate: (id: string, patch: Partial<SurveyQuestion>) => void;
  onDelete: (id: string) => void;
  disabled?: boolean;
}

export function QuestionCard({ question, onUpdate, onDelete, disabled }: Props) {
  const [open, setOpen] = useState(true);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: question.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const pendingRef = useRef<Partial<SurveyQuestion>>({});

  const debouncedUpdate = useCallback((patch: Partial<SurveyQuestion>) => {
    pendingRef.current = { ...pendingRef.current, ...patch };
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onUpdate(question.id, pendingRef.current);
      pendingRef.current = {};
    }, 800);
  }, [question.id, onUpdate]);

  // Flush on unmount
  useEffect(() => () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      if (Object.keys(pendingRef.current).length) onUpdate(question.id, pendingRef.current);
    }
  }, [question.id, onUpdate]);

  const [localText, setLocalText] = useState(question.question_text);
  const [localType, setLocalType] = useState(question.type);
  const [localRequired, setLocalRequired] = useState(question.required);
  const [localSettings, setLocalSettings] = useState(question.settings);

  // Sync from parent when question changes externally
  useEffect(() => { setLocalText(question.question_text); }, [question.question_text]);
  useEffect(() => { setLocalType(question.type); }, [question.type]);
  useEffect(() => { setLocalRequired(question.required); }, [question.required]);
  useEffect(() => { setLocalSettings(question.settings); }, [question.settings]);

  const typeLabel = QUESTION_TYPES.find(t => t.value === localType)?.label ?? localType;

  return (
    <div ref={setNodeRef} style={style}>
      <Card className={`border border-border ${isDragging ? "shadow-lg" : ""}`}>
        <Collapsible open={open} onOpenChange={setOpen}>
          <div className="flex items-center gap-2 px-4 py-3">
            {!disabled && (
              <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground">
                <GripVertical className="h-4 w-4" />
              </button>
            )}
            <CollapsibleTrigger asChild>
              <button className="text-muted-foreground hover:text-foreground">
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            </CollapsibleTrigger>
            <span className="flex-1 text-sm font-medium truncate">{localText || "Untitled Question"}</span>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{typeLabel}</span>
            {!disabled && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(question.id)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            )}
          </div>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label className="text-xs">Question Text</Label>
                  <Input
                    value={localText}
                    disabled={disabled}
                    onChange={e => { setLocalText(e.target.value); debouncedUpdate({ question_text: e.target.value }); }}
                  />
                </div>
                <div className="w-44">
                  <Label className="text-xs">Type</Label>
                  <Select
                    value={localType}
                    disabled={disabled}
                    onValueChange={v => {
                      setLocalType(v);
                      const newSettings = defaultSettings(v as QuestionType);
                      setLocalSettings(newSettings);
                      onUpdate(question.id, { type: v, settings: newSettings });
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {QUESTION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <QuestionSettings
                type={localType as QuestionType}
                settings={localSettings}
                disabled={disabled}
                onChange={s => { setLocalSettings(s); debouncedUpdate({ settings: s }); }}
              />
              <div className="flex items-center gap-2">
                <Switch
                  checked={localRequired}
                  disabled={disabled}
                  onCheckedChange={v => { setLocalRequired(v); onUpdate(question.id, { required: v }); }}
                />
                <span className="text-xs">Required</span>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  );
}

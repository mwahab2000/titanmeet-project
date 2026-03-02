import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Star } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { SurveyQuestion } from "@/lib/survey-api";

interface Props {
  question: SurveyQuestion;
}

export function QuestionPreview({ question }: Props) {
  const [value, setValue] = useState<any>(null);
  const s = question.settings || {};

  return (
    <div className="space-y-2">
      <Label className="font-medium">
        {question.question_text || "Untitled Question"}
        {question.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {question.type === "yes_no" && (
        <RadioGroup value={value ?? ""} onValueChange={setValue}>
          <div className="flex items-center gap-2"><RadioGroupItem value="yes" id={`${question.id}-yes`} /><Label htmlFor={`${question.id}-yes`}>Yes</Label></div>
          <div className="flex items-center gap-2"><RadioGroupItem value="no" id={`${question.id}-no`} /><Label htmlFor={`${question.id}-no`}>No</Label></div>
        </RadioGroup>
      )}
      {question.type === "single_choice" && (
        <RadioGroup value={value ?? ""} onValueChange={setValue}>
          {(s.options || []).map((opt: any) => (
            <div key={opt.value} className="flex items-center gap-2">
              <RadioGroupItem value={opt.value} id={`${question.id}-${opt.value}`} />
              <Label htmlFor={`${question.id}-${opt.value}`}>{opt.label}</Label>
            </div>
          ))}
        </RadioGroup>
      )}
      {question.type === "multi_choice" && (
        <div className="space-y-2">
          {(s.options || []).map((opt: any) => (
            <div key={opt.value} className="flex items-center gap-2">
              <Checkbox
                checked={(value || []).includes(opt.value)}
                onCheckedChange={checked => {
                  const cur = value || [];
                  setValue(checked ? [...cur, opt.value] : cur.filter((v: string) => v !== opt.value));
                }}
              />
              <Label>{opt.label}</Label>
            </div>
          ))}
        </div>
      )}
      {question.type === "rating_stars" && (
        <div className="flex gap-1">
          {Array.from({ length: s.max || 5 }, (_, i) => (
            <button key={i} type="button" onClick={() => setValue(i + 1)}>
              <Star className={cn("h-6 w-6 transition-colors", (value ?? 0) > i ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40")} />
            </button>
          ))}
        </div>
      )}
      {question.type === "likert" && (
        <div className="flex items-center gap-1">
          {Array.from({ length: (s.max || 5) - (s.min || 1) + 1 }, (_, i) => {
            const v = (s.min || 1) + i;
            const label = s.labels?.[String(v)];
            return (
              <div key={v} className="flex flex-col items-center gap-1">
                <Button
                  variant={value === v ? "default" : "outline"}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setValue(v)}
                >
                  {v}
                </Button>
                {label && <span className="text-[10px] text-muted-foreground max-w-[60px] text-center leading-tight">{label}</span>}
              </div>
            );
          })}
        </div>
      )}
      {question.type === "short_text" && (
        <Input placeholder={s.placeholder || ""} maxLength={s.maxLength || undefined} value={value ?? ""} onChange={e => setValue(e.target.value)} />
      )}
      {question.type === "long_text" && (
        <Textarea placeholder={s.placeholder || ""} maxLength={s.maxLength || undefined} value={value ?? ""} onChange={e => setValue(e.target.value)} />
      )}
      {question.type === "number" && (
        <Input type="number" min={s.min} max={s.max} step={s.step} value={value ?? ""} onChange={e => setValue(e.target.value)} className="w-40" />
      )}
      {question.type === "date" && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-[240px] justify-start text-left font-normal", !value && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {value ? format(value, "PPP") : "Pick a date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={value} onSelect={setValue} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

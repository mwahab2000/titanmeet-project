import { useState } from "react";
import { Lightbulb, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { demoPrompts } from "./AIBuilderEmptyState";
import { cn } from "@/lib/utils";

interface AIBuilderExamplesTriggerProps {
  onSelectPrompt: (prompt: string) => void;
}

export const AIBuilderExamplesTrigger = ({ onSelectPrompt }: AIBuilderExamplesTriggerProps) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-border bg-card/40">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 sm:px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-1.5 font-medium">
          <Lightbulb className="h-3.5 w-3.5" />
          Try examples
        </span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {open && (
        <div className="px-3 sm:px-4 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[240px] overflow-y-auto">
          {demoPrompts.map((item) => (
            <button
              key={item.title}
              onClick={() => {
                onSelectPrompt(item.prompt);
                setOpen(false);
              }}
              className="flex items-center gap-2 text-left rounded-lg px-2.5 py-2 text-[11px] hover:bg-accent transition-colors"
            >
              <item.icon className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="font-medium text-foreground truncate">{item.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

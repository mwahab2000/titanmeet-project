import { Bot, Sparkles, Building2, FilePlus, FileSearch, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const quickActions = [
  {
    icon: Building2,
    label: "Select a client to start",
    prompt: "List my clients so I can pick one to work with",
  },
  {
    icon: FilePlus,
    label: "Create a new event",
    prompt: "I want to create a new event — let's start by choosing a client",
  },
  {
    icon: FileSearch,
    label: "Continue a draft event",
    prompt: "Show me my draft events so I can continue working on one",
  },
  {
    icon: Wand2,
    label: "Generate full event with AI",
    prompt: "Generate a complete event from scratch — guide me through it step by step",
  },
];

const advancedPrompts = [
  "Check what's missing before publishing",
  "List all my events",
  "Add attendees from pasted text",
  "Draft invitation emails for my event",
];

interface AIBuilderEmptyStateProps {
  onSelectPrompt: (prompt: string) => void;
}

export const AIBuilderEmptyState = ({ onSelectPrompt }: AIBuilderEmptyStateProps) => (
  <div className="flex flex-1 flex-col items-center justify-center px-4 sm:px-6 py-8 sm:py-12">
    <div className="relative mb-5 sm:mb-6">
      <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/20">
        <Bot className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
      </div>
      <div className="absolute -top-1 -right-1 flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Sparkles className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
      </div>
    </div>

    <h2 className="text-lg sm:text-xl font-display font-bold text-foreground mb-1">AI Event Builder</h2>
    <p className="text-xs sm:text-sm text-muted-foreground text-center max-w-md mb-6 sm:mb-8 leading-relaxed">
      Start by selecting a client, then create or continue an event. I'll guide you through every step.
    </p>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-lg mb-6">
      {quickActions.map((action) => (
        <button
          key={action.label}
          onClick={() => onSelectPrompt(action.prompt)}
          className="flex items-center gap-3 text-left rounded-xl border border-border bg-card/60 px-4 py-3.5 text-xs hover:bg-accent hover:text-accent-foreground hover:border-primary/30 transition-all duration-200 active:scale-[0.98] min-h-[52px]"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <action.icon className="h-4 w-4 text-primary" />
          </div>
          <span className="font-medium text-foreground">{action.label}</span>
        </button>
      ))}
    </div>

    <p className="text-[11px] text-muted-foreground mb-3">Or try a specific task:</p>

    <div className="flex flex-wrap justify-center gap-2 max-w-lg">
      {advancedPrompts.map((prompt) => (
        <button
          key={prompt}
          onClick={() => onSelectPrompt(prompt)}
          className="rounded-full border border-border bg-card/40 px-3 py-1.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:border-primary/30 transition-all"
        >
          {prompt}
        </button>
      ))}
    </div>
  </div>
);

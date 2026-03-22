import { Bot, Sparkles } from "lucide-react";

const suggestedPrompts = [
  "Create a new event for Titan Cement Egypt",
  "Build an executive summit from scratch",
  "Add attendees from pasted text",
  "Check what is missing before publishing",
  "Generate an agenda for a 2-day conference",
  "Draft invitation emails for my event",
];

interface AIBuilderEmptyStateProps {
  onSelectPrompt: (prompt: string) => void;
}

export const AIBuilderEmptyState = ({ onSelectPrompt }: AIBuilderEmptyStateProps) => (
  <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
    <div className="relative mb-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/20">
        <Bot className="h-8 w-8 text-primary" />
      </div>
      <div className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Sparkles className="h-3 w-3" />
      </div>
    </div>

    <h2 className="text-xl font-display font-bold text-foreground mb-2">AI Event Builder</h2>
    <p className="text-sm text-muted-foreground text-center max-w-md mb-8">
      Build complete events conversationally. I'll guide you through clients, events, attendees, agendas, and everything needed to publish.
    </p>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
      {suggestedPrompts.map((prompt) => (
        <button
          key={prompt}
          onClick={() => onSelectPrompt(prompt)}
          className="text-left rounded-xl border border-border bg-card/60 px-4 py-3 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:border-primary/30 transition-all duration-200"
        >
          {prompt}
        </button>
      ))}
    </div>
  </div>
);

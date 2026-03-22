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
  <div className="flex flex-1 flex-col items-center justify-center px-4 sm:px-6 py-8 sm:py-12">
    <div className="relative mb-5 sm:mb-6">
      <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/20">
        <Bot className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
      </div>
      <div className="absolute -top-1 -right-1 flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Sparkles className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
      </div>
    </div>

    <h2 className="text-lg sm:text-xl font-display font-bold text-foreground mb-2">AI Event Builder</h2>
    <p className="text-xs sm:text-sm text-muted-foreground text-center max-w-md mb-6 sm:mb-8 leading-relaxed">
      Build complete events conversationally. I'll guide you through clients, events, attendees, agendas, and everything needed to publish.
    </p>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
      {suggestedPrompts.map((prompt) => (
        <button
          key={prompt}
          onClick={() => onSelectPrompt(prompt)}
          className="text-left rounded-xl border border-border bg-card/60 px-3 sm:px-4 py-2.5 sm:py-3 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:border-primary/30 transition-all duration-200 active:scale-[0.98] min-h-[44px] flex items-center"
        >
          {prompt}
        </button>
      ))}
    </div>
  </div>
);

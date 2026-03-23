import { Bot, Sparkles, Rocket, Building2, Palette, ImagePlus, Users, ClipboardCheck, BarChart3, MessageSquare, LayoutList, Lightbulb, GraduationCap } from "lucide-react";

const demoPrompts = [
  {
    icon: Rocket,
    title: "Full Event Creation",
    description: "One command → complete event draft",
    prompt:
      "Create a two-day digital transformation summit for Titan Cement in New Cairo for 250 attendees, with a premium corporate look, AI-generated visuals, WhatsApp and email confirmations, and a draft agenda.",
  },
  {
    icon: Building2,
    title: "Quick Corporate Event",
    description: "Board meeting with RSVP tracking",
    prompt:
      "Set up a board meeting in Cairo for 40 executives with RSVP tracking and reminders.",
  },
  {
    icon: Palette,
    title: "Visual Identity",
    description: "Hero, banner, colors & typography",
    prompt:
      "Generate a full visual identity for this event including hero image, banner, colors, and typography in a premium corporate style.",
  },
  {
    icon: ImagePlus,
    title: "AI Image + Refinement",
    description: "Generate and iterate on hero images",
    prompt:
      "Generate a hero image for a tech conference in Cairo, then make it more futuristic and use darker blue tones.",
  },
  {
    icon: Users,
    title: "Attendees & Comms Setup",
    description: "Add attendees and prepare confirmations",
    prompt:
      "Add 100 attendees and prepare confirmation messages via WhatsApp and email, then show who needs reminders.",
  },
  {
    icon: ClipboardCheck,
    title: "Readiness Check",
    description: "What's missing before publishing?",
    prompt:
      "Check what's missing in this event and tell me what I need to complete before publishing.",
  },
  {
    icon: BarChart3,
    title: "Analytics Insight",
    description: "RSVP rates and attendance forecast",
    prompt:
      "Show me RSVP rate, attendance forecast, and who hasn't confirmed yet.",
  },
  {
    icon: MessageSquare,
    title: "WhatsApp Campaign",
    description: "Send reminders to pending attendees",
    prompt:
      "Send a reminder to all attendees who haven't confirmed yet via WhatsApp and email.",
  },
  {
    icon: LayoutList,
    title: "Multi-Event Overview",
    description: "Review all drafts and readiness",
    prompt:
      "Show me all my draft events and which ones are closest to being ready.",
  },
  {
    icon: Lightbulb,
    title: "AI Recommendations",
    description: "Next best actions for engagement",
    prompt:
      "Based on this event, what should I do next to improve attendance and engagement?",
  },
];

interface AIBuilderEmptyStateProps {
  onSelectPrompt: (prompt: string) => void;
  isNewUser?: boolean;
}

export const AIBuilderEmptyState = ({ onSelectPrompt, isNewUser }: AIBuilderEmptyStateProps) => (
  <div className="flex flex-1 flex-col items-center justify-center px-4 sm:px-6 py-8 sm:py-12">
    {/* Header */}
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
      {isNewUser
        ? "Welcome! I'll help you create your first event in a few guided steps."
        : "Describe what you need and I'll handle the rest. Try one of these to get started:"}
    </p>

    {/* Guided onboarding CTA for new users */}
    {isNewUser && (
      <button
        onClick={() => onSelectPrompt("__ONBOARDING_START__")}
        className="group flex items-center gap-3 rounded-xl border-2 border-primary/30 bg-primary/5 px-5 py-4 mb-5 hover:bg-primary/10 hover:border-primary/50 transition-all duration-200 active:scale-[0.98] w-full max-w-md"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <GraduationCap className="h-5 w-5" />
        </div>
        <div className="text-left">
          <span className="block text-sm font-semibold text-foreground">Start guided setup</span>
          <span className="block text-xs text-muted-foreground">Create your first event in under 3 minutes</span>
        </div>
      </button>
    )}

    {/* Demo prompts grid */}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-2xl">
      {demoPrompts.map((item) => (
        <button
          key={item.title}
          onClick={() => onSelectPrompt(item.prompt)}
          className="group flex items-start gap-3 text-left rounded-xl border border-border bg-card/60 px-3.5 py-3 hover:bg-accent hover:border-primary/30 transition-all duration-200 active:scale-[0.98] min-h-[52px]"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors">
            <item.icon className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <span className="block text-xs font-semibold text-foreground leading-tight">{item.title}</span>
            <span className="block text-[11px] text-muted-foreground leading-snug mt-0.5">{item.description}</span>
          </div>
        </button>
      ))}
    </div>
  </div>
);

export { demoPrompts };

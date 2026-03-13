import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Ear, MessageSquare, CheckCircle, Rocket } from "lucide-react";
import { DEMO_SITE_URL } from "@/config/pricing";

const steps = [
  {
    icon: Ear,
    title: "Speak naturally",
    description: "Open Voice Studio and describe your event — agenda, speakers, venue — in any language.",
  },
  {
    icon: MessageSquare,
    title: "Review AI actions",
    description: "TitanMeet turns your words into structured actions: add agenda items, set venues, invite guests.",
  },
  {
    icon: CheckCircle,
    title: "Confirm & edit",
    description: "Approve, tweak, or discard each action before anything touches your event.",
  },
  {
    icon: Rocket,
    title: "Publish in seconds",
    description: "One tap to go live — your polished event site is ready to share.",
  },
];

interface VoiceStudioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VoiceStudioModal({ open, onOpenChange }: VoiceStudioModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-[hsl(var(--landing-bg))] border-[hsl(var(--landing-border)/0.3)] text-[hsl(var(--landing-fg))]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-bold text-center">
            Voice Studio in 60 seconds
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {steps.map((step, i) => (
            <div key={step.title} className="flex gap-4 items-start">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--titan-green)/0.12)]">
                <step.icon className="h-5 w-5 text-[hsl(var(--titan-green))]" />
              </div>
              <div>
                <p className="font-display font-semibold text-sm">
                  <span className="text-[hsl(var(--titan-green))] mr-1.5">{i + 1}.</span>
                  {step.title}
                </p>
                <p className="text-sm text-[hsl(var(--landing-fg-muted))] mt-0.5">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        <Button className="w-full gradient-titan border-0 text-white font-semibold" asChild>
          <a href={DEMO_SITE_URL} target="_blank" rel="noopener noreferrer">
            View Demo Site <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </DialogContent>
    </Dialog>
  );
}

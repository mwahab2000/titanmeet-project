import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

const TOUR_KEY = "titan_tour_done";

interface TourStep {
  selector: string;
  title: string;
  body: string;
  cta: string;
}

const tourSteps: TourStep[] = [
  {
    selector: '[data-tour="tour-clients"]',
    title: "Start with a Client",
    body: "Everything in TitanMeet lives inside a Client — the organisation you're managing events for. Create your first client here before creating any events.",
    cta: "Next →",
  },
  {
    selector: '[data-tour="tour-events"]',
    title: "Your events live here",
    body: "Once you have a client, create events inside it. Each event gets its own 18-section workspace and a fully-designed public website.",
    cta: "Next →",
  },
  {
    selector: '[data-tour="tour-quick-setup"]',
    title: "The fastest way to start",
    body: "The Quick Event Wizard walks you through the 6 essential steps in order. Most users have a live event page in under 10 minutes. Start here.",
    cta: "Got it →",
  },
  {
    selector: '[data-tour="tour-billing"]',
    title: "Keep an eye on your usage",
    body: "Your plan has limits on clients, active events, attendees, and emails. The usage bars on the Dashboard and in Billing show how close you are to each limit.",
    cta: "Next →",
  },
  {
    selector: '[data-tour="tour-support"]',
    title: "Need help? We're here.",
    body: "Submit a support ticket directly from the app. We respond within 1 business day. You can also access the Help Center from this section.",
    cta: "Finish Tour ✓",
  },
];

interface TooltipPos {
  top: number;
  left: number;
  arrowSide: "left" | "right" | "top" | "bottom";
}

function getTooltipPos(el: HTMLElement): TooltipPos {
  const rect = el.getBoundingClientRect();
  const scrollY = window.scrollY;
  const scrollX = window.scrollX;

  // Default: place tooltip to the right of the element
  let top = rect.top + scrollY + rect.height / 2 - 60;
  let left = rect.right + scrollX + 12;
  let arrowSide: TooltipPos["arrowSide"] = "left";

  // If tooltip would overflow right edge, place it below
  if (left + 340 > window.innerWidth) {
    left = rect.left + scrollX + rect.width / 2 - 170;
    top = rect.bottom + scrollY + 12;
    arrowSide = "top";
  }

  // Clamp
  if (left < 8) left = 8;
  if (top < 8) top = 8;

  return { top, left, arrowSide };
}

export const FirstLoginTour = () => {
  const { user } = useAuth();
  const [showWelcome, setShowWelcome] = useState(false);
  const [currentStep, setCurrentStep] = useState<number | null>(null);
  const [pos, setPos] = useState<TooltipPos | null>(null);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!user) return;
    const done = localStorage.getItem(TOUR_KEY);
    if (!done) {
      // Small delay so sidebar renders first
      const t = setTimeout(() => setShowWelcome(true), 600);
      return () => clearTimeout(t);
    }
  }, [user]);

  const finishTour = useCallback(() => {
    setCurrentStep(null);
    setPos(null);
    setHighlightRect(null);
    localStorage.setItem(TOUR_KEY, "true");
  }, []);

  const goToStep = useCallback((step: number) => {
    if (step >= tourSteps.length) {
      finishTour();
      return;
    }
    setCurrentStep(step);

    // Wait a tick for DOM
    requestAnimationFrame(() => {
      const el = document.querySelector(tourSteps[step].selector) as HTMLElement | null;
      if (!el) {
        // If element not found (e.g. mobile), skip to next
        goToStep(step + 1);
        return;
      }
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });

      // Position after scroll
      setTimeout(() => {
        const el2 = document.querySelector(tourSteps[step].selector) as HTMLElement | null;
        if (!el2) return;
        setPos(getTooltipPos(el2));
        setHighlightRect(el2.getBoundingClientRect());
      }, 300);
    });
  }, [finishTour]);

  const startTour = () => {
    setShowWelcome(false);
    goToStep(0);
  };

  const skipAll = () => {
    setShowWelcome(false);
    finishTour();
  };

  // Reposition on resize
  useEffect(() => {
    if (currentStep === null) return;
    const onResize = () => {
      const el = document.querySelector(tourSteps[currentStep].selector) as HTMLElement | null;
      if (el) {
        setPos(getTooltipPos(el));
        setHighlightRect(el.getBoundingClientRect());
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [currentStep]);

  const firstName = user?.user_metadata?.full_name?.split(" ")[0] || "";

  // Welcome modal
  if (showWelcome) {
    return (
      <Dialog open onOpenChange={(open) => { if (!open) skipAll(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              Welcome to TitanMeet{firstName ? `, ${firstName}` : ""}.
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed pt-2">
              You're set up to create professional event websites, manage attendees, and send communications — all from one workspace.
              <br /><br />
              Would you like a 2-minute guided tour of the platform?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2 sm:justify-end">
            <Button variant="ghost" onClick={skipAll}>
              I'll explore on my own
            </Button>
            <Button onClick={startTour}>
              Show me around →
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Tour tooltip
  if (currentStep === null || !pos) return null;

  const step = tourSteps[currentStep];

  return createPortal(
    <>
      {/* Overlay with spotlight cutout */}
      <div
        className="fixed inset-0 z-[9998]"
        style={{
          background: "rgba(0,0,0,0.45)",
          ...(highlightRect
            ? {
                clipPath: `polygon(
                  0% 0%, 0% 100%, 100% 100%, 100% 0%,
                  0% 0%,
                  ${highlightRect.left - 4}px ${highlightRect.top - 4}px,
                  ${highlightRect.left - 4}px ${highlightRect.bottom + 4}px,
                  ${highlightRect.right + 4}px ${highlightRect.bottom + 4}px,
                  ${highlightRect.right + 4}px ${highlightRect.top - 4}px,
                  ${highlightRect.left - 4}px ${highlightRect.top - 4}px
                )`,
              }
            : {}),
        }}
        onClick={finishTour}
      />

      {/* Tooltip card */}
      <div
        className="fixed z-[9999] w-[340px] rounded-xl border border-border bg-popover p-5 shadow-xl"
        style={{ top: pos.top, left: pos.left }}
      >
        <button
          onClick={finishTour}
          className="absolute right-3 top-3 rounded-sm text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close tour"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-1 flex items-center gap-2">
          <span className="text-[11px] font-medium text-muted-foreground">
            {currentStep + 1} / {tourSteps.length}
          </span>
        </div>

        <h3 className="font-display text-base font-bold mb-1">{step.title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">{step.body}</p>

        <div className="flex items-center justify-between">
          <button
            onClick={finishTour}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip tour
          </button>
          <Button size="sm" onClick={() => goToStep(currentStep + 1)}>
            {step.cta}
          </Button>
        </div>

        {/* Step dots */}
        <div className="flex justify-center gap-1.5 mt-3">
          {tourSteps.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                i === currentStep ? "bg-primary" : i < currentStep ? "bg-primary/40" : "bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>
      </div>
    </>,
    document.body
  );
};

import type { PublicEventData } from "@/lib/publicSite/types";
import { ClipboardList } from "lucide-react";
import { MotionReveal } from "./MotionReveal";

interface Props { data: PublicEventData; className?: string; }

export const PublicSurveyCtaSection: React.FC<Props> = ({ data, className = "" }) => {
  if (!data.surveys.hasSurvey) return null;
  return (
    <MotionReveal className={`max-w-4xl mx-auto px-6 py-12 ${className}`} variant="scale">
      <div className="rounded-xl border border-border bg-card p-8 text-center space-y-4">
        <ClipboardList className="h-10 w-10 mx-auto text-primary" />
        <h3 className="text-xl font-semibold font-display">Share Your Feedback</h3>
        <p className="text-muted-foreground text-sm">We'd love to hear from you. Please take a moment to complete our event survey.</p>
        <button className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity">
          Take Survey
        </button>
      </div>
    </MotionReveal>
  );
};

import type { PublicEventData } from "@/lib/publicSite/types";
import { MotionReveal } from "./MotionReveal";

interface Props { data: PublicEventData; className?: string; }

export const PublicEventInfoSection: React.FC<Props> = ({ data, className = "" }) => {
  if (!data.event.description) return null;
  return (
    <MotionReveal id="about" className={`max-w-5xl mx-auto px-4 sm:px-8 py-16 sm:py-24 ${className}`}>
      <div className="flex items-center gap-3 sm:gap-4 mb-8 sm:mb-10">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold font-display tracking-tight">About This Event</h2>
        <div className="flex-1 h-px bg-border" />
      </div>
      <div className="max-w-3xl">
        <p className="text-base sm:text-lg lg:text-xl leading-relaxed text-muted-foreground whitespace-pre-line">{data.event.description}</p>
      </div>
    </MotionReveal>
  );
};

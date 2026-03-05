import type { PublicEventData } from "@/lib/publicSite/types";
import { MotionReveal } from "./MotionReveal";

interface Props { data: PublicEventData; className?: string; }

export const PublicEventInfoSection: React.FC<Props> = ({ data, className = "" }) => {
  if (!data.event.description) return null;
  return (
    <MotionReveal id="about" className={`max-w-4xl mx-auto px-6 py-20 ${className}`}>
      <h2 className="text-3xl md:text-4xl font-bold font-display mb-8 tracking-tight">About This Event</h2>
      <p className="text-base md:text-lg lg:text-xl leading-relaxed text-muted-foreground whitespace-pre-line">{data.event.description}</p>
    </MotionReveal>
  );
};

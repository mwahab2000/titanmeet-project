import type { PublicEventData } from "@/lib/publicSite/types";
import { PublicCountdown } from "./PublicCountdown";
import { Clock } from "lucide-react";

interface Props { data: PublicEventData; className?: string; }

export const PublicCountdownSection: React.FC<Props> = ({ data, className = "" }) => {
  if (!data.hero.date) return null;

  return (
    <section id="countdown" className={`py-16 sm:py-20 ${className}`}>
      <div className="max-w-5xl mx-auto px-6 sm:px-8 flex flex-col items-center text-center gap-6">
        <div className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground bg-muted/50 px-5 py-2 rounded-full border border-border/50">
          <Clock className="h-3.5 w-3.5" />
          <span>Event Starts In</span>
        </div>
        <PublicCountdown targetDate={data.hero.date} />
      </div>
    </section>
  );
};

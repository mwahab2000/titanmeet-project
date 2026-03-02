import type { PublicEventData } from "@/lib/publicSite/types";
import { PublicCountdown } from "./PublicCountdown";
import { Clock } from "lucide-react";

interface Props {
  data: PublicEventData;
  className?: string;
}

export const PublicCountdownSection: React.FC<Props> = ({ data, className = "" }) => {
  if (!data.hero.date) return null;

  return (
    <section id="countdown" className={`py-12 sm:py-16 ${className}`}>
      <div className="max-w-5xl mx-auto px-6 flex flex-col items-center text-center gap-4">
        <div className="flex items-center gap-2 text-muted-foreground text-sm uppercase tracking-widest font-medium">
          <Clock className="h-4 w-4" />
          <span>Event Starts In</span>
        </div>
        <PublicCountdown targetDate={data.hero.date} />
      </div>
    </section>
  );
};

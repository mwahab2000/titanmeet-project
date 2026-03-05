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
    <section id="countdown" className={`py-14 sm:py-20 ${className}`}>
      <div className="max-w-5xl mx-auto px-6 flex flex-col items-center text-center gap-5">
        <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-[0.2em] font-semibold">
          <Clock className="h-4 w-4" />
          <span>Event Starts In</span>
        </div>
        <PublicCountdown targetDate={data.hero.date} />
      </div>
    </section>
  );
};

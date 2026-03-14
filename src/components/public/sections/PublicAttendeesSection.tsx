import { useMemo } from "react";
import type { PublicEventData } from "@/lib/publicSite/types";
import { cn } from "@/lib/utils";
import { Users } from "lucide-react";

interface MarqueeProps {
  names: string[];
  direction?: "left" | "right";
  speedPxPerSec?: number;
}

const AttendeeMarquee = ({ names, direction = "left", speedPxPerSec = 28 }: MarqueeProps) => {
  // We render the list twice for seamless loop
  const duration = useMemo(() => {
    // Estimate width: ~120px per chip on average
    const estimatedWidth = names.length * 130;
    return Math.max(estimatedWidth / speedPxPerSec, 15);
  }, [names.length, speedPxPerSec]);

  const chips = names.map((name, i) => (
    <span
      key={i}
      className="inline-flex items-center shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border border-border/40 bg-card/60 text-foreground/80 backdrop-blur-sm whitespace-nowrap"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-primary/50 mr-2 shrink-0" />
      {name}
    </span>
  ));

  const animClass = direction === "left" ? "animate-marquee-left" : "animate-marquee-right";

  return (
    <div className="overflow-hidden relative">
      <div
        className={cn("flex gap-3 w-max motion-reduce:flex-wrap motion-reduce:w-auto motion-reduce:justify-center motion-reduce:[animation:none]", animClass)}
        style={{ animationDuration: `${duration}s` }}
      >
        {chips}
        {/* Duplicate for seamless loop */}
        <div className="contents motion-reduce:hidden" aria-hidden="true">
          {chips}
        </div>
      </div>
    </div>
  );
};

interface Props {
  data: PublicEventData;
  className?: string;
}

export const PublicAttendeesSection = ({ data, className }: Props) => {
  const { attendees } = data;
  
  // Don't render if no attendee names at all
  const totalNames = attendees.groups.reduce((sum, g) => sum + g.names.length, 0);
  if (totalNames === 0) return null;

  const sectionTitle = attendees.hasGroups ? "Groups & Attendees" : "Attendees";

  return (
    <section id="attendees" className={cn("py-16 sm:py-20 overflow-hidden", className)}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Section header */}
        <div className="flex items-center gap-3 mb-10">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">{sectionTitle}</h2>
        </div>

        {/* Marquee rows */}
        <div className="space-y-8">
          {attendees.groups.map((group, idx) => (
            <div key={idx}>
              {attendees.hasGroups && group.name && (
                <div className="mb-3 ml-1">
                  <span className="inline-block text-xs font-semibold uppercase tracking-widest text-muted-foreground px-3 py-1 rounded-full border border-border/30 bg-muted/30">
                    {group.name}
                  </span>
                </div>
              )}
              <AttendeeMarquee
                names={group.names}
                direction={idx % 2 === 0 ? "left" : "right"}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

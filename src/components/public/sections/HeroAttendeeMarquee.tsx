import { useMemo } from "react";
import type { PublicEventData } from "@/lib/publicSite/types";
import { cn } from "@/lib/utils";

interface MarqueeRowProps {
  names: string[];
  direction?: "left" | "right";
  speedPxPerSec?: number;
  variant?: "glass" | "light";
}

const MarqueeRow = ({ names, direction = "left", speedPxPerSec = 28, variant = "glass" }: MarqueeRowProps) => {
  const duration = useMemo(() => {
    const estimatedWidth = names.length * 130;
    return Math.max(estimatedWidth / speedPxPerSec, 15);
  }, [names.length, speedPxPerSec]);

  const chipClass = variant === "glass"
    ? "border-white/15 bg-white/10 backdrop-blur-md text-white/80"
    : "border-black/10 bg-black/5 backdrop-blur-sm text-black/70";

  const dotClass = variant === "glass" ? "bg-white/40" : "bg-black/30";

  const chips = names.map((name, i) => (
    <span
      key={i}
      className={cn("inline-flex items-center shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border whitespace-nowrap", chipClass)}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full mr-2 shrink-0", dotClass)} />
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
        <div className="contents motion-reduce:hidden" aria-hidden="true">
          {chips}
        </div>
      </div>
    </div>
  );
};

interface Props {
  data: PublicEventData;
  variant?: "glass" | "light";
  className?: string;
}

export const HeroAttendeeMarquee = ({ data, variant = "glass", className }: Props) => {
  const { attendees } = data;

  const totalNames = attendees.groups.reduce((sum, g) => sum + g.names.length, 0);
  if (totalNames === 0) return null;

  const labelClass = variant === "glass" ? "text-white/50" : "text-black/40";

  return (
    <div className={cn("w-full space-y-4", className)}>
      {attendees.groups.map((group, idx) => (
        <div key={idx}>
          {group.name && (
            <div className="mb-2 ml-1">
              <span className={cn("text-[10px] font-semibold uppercase tracking-[0.15em]", labelClass)}>
                {group.name}
              </span>
            </div>
          )}
          <MarqueeRow
            names={group.names}
            direction={idx % 2 === 0 ? "left" : "right"}
            variant={variant}
          />
        </div>
      ))}
    </div>
  );
};

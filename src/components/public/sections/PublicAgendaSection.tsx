import type { PublicEventData } from "@/lib/publicSite/types";
import { MotionReveal, MotionRevealItem } from "./MotionReveal";

interface Props { data: PublicEventData; className?: string; }

export const PublicAgendaSection: React.FC<Props> = ({ data, className = "" }) => {
  if (data.agenda.length === 0) return null;

  const grouped = data.agenda.reduce<Record<number, typeof data.agenda>>((acc, item) => {
    const day = item.dayNumber ?? 1;
    if (!acc[day]) acc[day] = [];
    acc[day].push(item);
    return acc;
  }, {});

  const days = Object.keys(grouped).map(Number).sort((a, b) => a - b);

  return (
    <MotionReveal id="agenda" className={`max-w-5xl mx-auto px-6 sm:px-8 py-24 ${className}`}>
      <div className="flex items-center gap-4 mb-12">
        <h2 className="text-3xl md:text-4xl font-bold font-display tracking-tight">Agenda</h2>
        <div className="flex-1 h-px bg-border" />
      </div>

      {days.map((day) => (
        <div key={day} className="mb-12 last:mb-0">
          {days.length > 1 && (
            <div className="mb-6">
              <span className="inline-flex items-center text-xs font-bold uppercase tracking-[0.15em] text-primary bg-primary/8 border border-primary/15 px-4 py-1.5 rounded-full">
                Day {day}
              </span>
            </div>
          )}
          <div className="space-y-3">
            {grouped[day].map((item, i) => (
              <MotionRevealItem
                key={item.id}
                index={i}
                className="group relative flex gap-5 p-5 sm:p-6 rounded-2xl border border-border bg-card hover:shadow-[var(--shadow-elevated)] hover:border-primary/15 transition-all duration-300"
              >
                {/* Time chip */}
                {(item.startTime || item.endTime) && (
                  <div className="shrink-0 pt-0.5">
                    <div className="inline-flex items-center text-xs font-semibold text-primary bg-primary/8 px-3 py-1.5 rounded-lg font-display tabular-nums whitespace-nowrap">
                      {item.startTime?.slice(0, 5)}{item.endTime ? ` – ${item.endTime.slice(0, 5)}` : ""}
                    </div>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-base sm:text-lg group-hover:text-primary transition-colors leading-snug">{item.title}</h4>
                  {item.description && <p className="text-sm text-muted-foreground mt-2 leading-relaxed line-clamp-2">{item.description}</p>}
                  {item.speakerName && (
                    <p className="text-xs text-primary/80 mt-2.5 font-medium flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                      {item.speakerName}
                    </p>
                  )}
                </div>
              </MotionRevealItem>
            ))}
          </div>
        </div>
      ))}
    </MotionReveal>
  );
};

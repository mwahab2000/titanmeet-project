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
    <MotionReveal id="agenda" className={`max-w-4xl mx-auto px-6 py-20 ${className}`}>
      <h2 className="text-3xl md:text-4xl font-bold font-display mb-10 tracking-tight">Agenda</h2>
      {days.map((day) => (
        <div key={day} className="mb-10 last:mb-0">
          {days.length > 1 && <h3 className="text-lg font-semibold mb-5 text-primary tracking-wide uppercase text-sm">Day {day}</h3>}
          <div className="space-y-3">
            {grouped[day].map((item, i) => (
              <MotionRevealItem
                key={item.id}
                index={i}
                className="flex gap-4 p-5 rounded-xl border border-border bg-card hover:shadow-md transition-all duration-300 hover:border-primary/20 group"
              >
                {(item.startTime || item.endTime) && (
                  <div className="text-sm font-semibold text-primary/80 whitespace-nowrap min-w-[90px] pt-0.5 font-display tabular-nums">
                    {item.startTime?.slice(0, 5)}{item.endTime ? ` – ${item.endTime.slice(0, 5)}` : ""}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-base group-hover:text-primary transition-colors">{item.title}</h4>
                  {item.description && <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{item.description}</p>}
                  {item.speakerName && <p className="text-xs text-primary mt-2 font-medium">{item.speakerName}</p>}
                </div>
              </MotionRevealItem>
            ))}
          </div>
        </div>
      ))}
    </MotionReveal>
  );
};

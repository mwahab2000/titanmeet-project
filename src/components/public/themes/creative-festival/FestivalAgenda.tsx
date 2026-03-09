import { useState } from "react";
import type { PublicEventData } from "@/lib/publicSite/types";

interface Props { data: PublicEventData; }

export const FestivalAgenda: React.FC<Props> = ({ data }) => {
  const grouped = data.agenda.reduce<Record<number, typeof data.agenda>>((acc, item) => {
    const day = item.dayNumber || 1;
    if (!acc[day]) acc[day] = [];
    acc[day].push(item);
    return acc;
  }, {});
  const days = Object.keys(grouped).map(Number).sort((a, b) => a - b);
  const [activeDay, setActiveDay] = useState(days[0] ?? 1);

  if (data.agenda.length === 0) return null;

  const font = "'Cabinet Grotesk', 'Plus Jakarta Sans', sans-serif";
  const tabColors = ["#7C3AED", "#DB2777", "#FACC15", "#10B981", "#F97316"];

  return (
    <section id="agenda" className="relative py-20 sm:py-28" style={{ background: "#FAFAFA", clipPath: "polygon(0 0, 100% 40px, 100% 100%, 0 100%)" }}>
      <div className="max-w-5xl mx-auto px-6 sm:px-10 pt-10">
        <h2 className="mb-10" style={{ fontFamily: font, fontWeight: 900, fontSize: "clamp(2.5rem, 6vw, 4.5rem)", color: "#0A0A0A", lineHeight: 0.95, letterSpacing: "-0.03em" }}>
          What's On
        </h2>

        {days.length > 1 && (
          <div className="flex gap-2 mb-10 flex-wrap">
            {days.map((d, i) => (
              <button
                key={d}
                onClick={() => setActiveDay(d)}
                className="px-5 py-2 text-xs font-bold uppercase tracking-[0.08em] transition-all"
                style={{
                  fontFamily: font,
                  borderRadius: 999,
                  color: activeDay === d ? "#FFFFFF" : tabColors[i % tabColors.length],
                  background: activeDay === d ? tabColors[i % tabColors.length] : "transparent",
                  border: `2px solid ${tabColors[i % tabColors.length]}`,
                }}
              >
                Day {d}
              </button>
            ))}
          </div>
        )}

        <div>
          {(grouped[activeDay] || []).map((item, idx) => (
            <div
              key={item.id}
              className="py-5 px-4 -mx-4"
              style={{ background: idx % 2 === 0 ? "#FFFFFF" : "#FAF5FF", borderBottom: "1px solid rgba(0,0,0,0.06)" }}
            >
              <h3 style={{ fontFamily: font, fontWeight: 800, fontSize: "1.15rem", color: "#0A0A0A" }}>
                {item.title}
              </h3>
              <div className="flex items-center gap-3 mt-1">
                {item.startTime && <span style={{ fontFamily: font, fontSize: "0.8rem", fontWeight: 500, color: "#7C3AED" }}>{item.startTime}{item.endTime ? ` – ${item.endTime}` : ""}</span>}
                {item.speakerName && <span style={{ fontFamily: font, fontSize: "0.75rem", fontWeight: 500, color: "rgba(0,0,0,0.4)" }}>• {item.speakerName}</span>}
              </div>
              {item.description && (
                <p className="mt-2" style={{ fontFamily: font, fontSize: "0.85rem", color: "rgba(0,0,0,0.5)", lineHeight: 1.6 }}>
                  {item.description}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

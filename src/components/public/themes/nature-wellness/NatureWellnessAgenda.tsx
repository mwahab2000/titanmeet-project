import type { PublicEventData } from "@/lib/publicSite/types";
import { Leaf } from "lucide-react";

interface Props { data: PublicEventData; }

export const NatureWellnessAgenda: React.FC<Props> = ({ data }) => {
  if (data.agenda.length === 0) return null;

  const grouped = data.agenda.reduce<Record<number, typeof data.agenda>>((acc, item) => {
    const day = item.dayNumber || 1;
    if (!acc[day]) acc[day] = [];
    acc[day].push(item);
    return acc;
  }, {});
  const days = Object.keys(grouped).map(Number).sort((a, b) => a - b);

  return (
    <section id="agenda" className="py-20 sm:py-28" style={{ background: "#FAF7F2" }}>
      <div className="max-w-4xl mx-auto px-6 sm:px-10">
        {/* Heading */}
        <div className="text-center mb-14">
          <Leaf className="h-5 w-5 mx-auto mb-3" style={{ color: "#2D6A4F" }} />
          <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontStyle: "italic", fontWeight: 600, fontSize: "clamp(2rem, 4vw, 3rem)", color: "#1C2B1A" }}>
            The Programme
          </h2>
        </div>

        {days.map((day) => (
          <div key={day} className="mb-12 last:mb-0">
            {days.length > 1 && (
              <div className="mb-6">
                <span className="inline-block px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] rounded-full" style={{ background: "rgba(45,106,79,0.08)", color: "#2D6A4F", border: "1px solid rgba(45,106,79,0.15)", fontFamily: "'DM Sans', sans-serif" }}>
                  Day {day}
                </span>
              </div>
            )}

            <div className="space-y-4">
              {grouped[day].map((item) => (
                <div key={item.id} className="rounded-2xl p-5 sm:p-6" style={{ background: "#F0EBE3", boxShadow: "0 2px 12px rgba(28,43,26,0.04)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Leaf className="h-3.5 w-3.5" style={{ color: "#8BB07A" }} />
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.75rem", fontWeight: 500, color: "#C1784F" }}>
                      {item.startTime || ""}{item.endTime ? ` — ${item.endTime}` : ""}
                    </span>
                  </div>
                  <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: "1.05rem", color: "#1C2B1A" }}>
                    {item.title}
                  </h3>
                  {item.description && (
                    <p className="mt-1.5" style={{ color: "rgba(28,43,26,0.55)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem", lineHeight: 1.65, fontWeight: 300 }}>
                      {item.description}
                    </p>
                  )}
                  {item.speakerName && (
                    <p className="mt-2" style={{ color: "#2D6A4F", fontFamily: "'DM Sans', sans-serif", fontSize: "0.75rem", fontWeight: 500 }}>
                      {item.speakerName}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

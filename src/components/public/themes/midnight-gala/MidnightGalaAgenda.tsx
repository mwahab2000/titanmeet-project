import type { PublicEventData } from "@/lib/publicSite/types";

interface Props { data: PublicEventData; }

export const MidnightGalaAgenda: React.FC<Props> = ({ data }) => {
  if (data.agenda.length === 0) return null;

  const grouped = data.agenda.reduce<Record<number, typeof data.agenda>>((acc, item) => {
    const day = item.dayNumber || 1;
    if (!acc[day]) acc[day] = [];
    acc[day].push(item);
    return acc;
  }, {});

  const days = Object.keys(grouped).map(Number).sort((a, b) => a - b);

  return (
    <section id="agenda" className="py-20 sm:py-28" style={{ background: "#0D0D14" }}>
      <div className="max-w-4xl mx-auto px-6 sm:px-10">
        {/* Section heading */}
        <h2
          className="text-4xl sm:text-5xl text-center mb-16"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontStyle: "italic", fontWeight: 600, color: "#E8E4DC" }}
        >
          Programme
        </h2>

        {days.map((day) => (
          <div key={day} className="mb-14 last:mb-0">
            {/* Day label */}
            {days.length > 1 && (
              <div className="mb-8">
                <span
                  className="inline-block px-4 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.2em]"
                  style={{ background: "rgba(201,168,76,0.1)", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.2)" }}
                >
                  Day {day}
                </span>
              </div>
            )}

            {/* Timeline */}
            <div className="relative">
              {grouped[day].map((item, idx) => (
                <div key={item.id} className="flex gap-6 sm:gap-10 pb-10 last:pb-0">
                  {/* Time column */}
                  <div className="shrink-0 w-16 sm:w-20 text-right relative">
                    <span
                      className="text-xs font-medium"
                      style={{ fontFamily: "monospace", color: "#C9A84C" }}
                    >
                      {item.startTime || ""}
                    </span>
                    {/* Dot */}
                    <div
                      className="absolute top-1 -right-[13px] sm:-right-[21px] w-2 h-2 rounded-full z-10"
                      style={{ background: "#C9A84C" }}
                    />
                  </div>

                  {/* Vertical line */}
                  <div
                    className="absolute left-[76px] sm:left-[92px] top-0 bottom-0 w-px"
                    style={{ borderLeft: "1px dotted rgba(201,168,76,0.3)" }}
                  />

                  {/* Content */}
                  <div className="flex-1 pb-2">
                    <h3
                      className="text-lg mb-1"
                      style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600, color: "#E8E4DC" }}
                    >
                      {item.title}
                    </h3>
                    {item.description && (
                      <p style={{ color: "rgba(232,228,220,0.5)", fontFamily: "'Lato', sans-serif", fontSize: "0.85rem", lineHeight: 1.7, fontWeight: 300 }}>
                        {item.description}
                      </p>
                    )}
                    {item.speakerName && (
                      <p className="mt-1" style={{ color: "#C9A84C", fontFamily: "'Lato', sans-serif", fontSize: "0.75rem", fontWeight: 400 }}>
                        {item.speakerName}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

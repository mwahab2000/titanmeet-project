import { useState } from "react";
import type { PublicEventData } from "@/lib/publicSite/types";

interface Props { data: PublicEventData; }

export const TechSummitAgenda: React.FC<Props> = ({ data }) => {
  const grouped = data.agenda.reduce<Record<number, typeof data.agenda>>((acc, item) => {
    const day = item.dayNumber || 1;
    if (!acc[day]) acc[day] = [];
    acc[day].push(item);
    return acc;
  }, {});
  const days = Object.keys(grouped).map(Number).sort((a, b) => a - b);
  const [activeDay, setActiveDay] = useState(days[0] ?? 1);

  if (data.agenda.length === 0) return null;

  return (
    <section id="agenda" className="py-20 sm:py-28" style={{ background: "#0E1420" }}>
      <div className="max-w-4xl mx-auto px-6 sm:px-10">
        {/* Heading */}
        <h2 className="text-3xl sm:text-4xl mb-10" style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: "#E2E8F0" }}>
          <span style={{ color: "#00D4FF" }}>{"{ "}</span>Sessions<span style={{ color: "#00D4FF" }}>{" }"}</span>
        </h2>

        {/* Day tabs */}
        {days.length > 1 && (
          <div className="flex gap-2 mb-10">
            {days.map((d) => (
              <button
                key={d}
                onClick={() => setActiveDay(d)}
                className="px-5 py-2 text-xs font-semibold uppercase tracking-[0.1em] transition-all duration-200"
                style={{
                  fontFamily: "'Inter', sans-serif",
                  border: "1px solid rgba(0,212,255,0.3)",
                  borderRadius: 0,
                  color: activeDay === d ? "#0E1420" : "#00D4FF",
                  background: activeDay === d ? "#00D4FF" : "transparent",
                }}
              >
                Day {d}
              </button>
            ))}
          </div>
        )}

        {/* Items */}
        <div className="space-y-0">
          {(grouped[activeDay] || []).map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-4 sm:gap-6 py-4 px-3 -mx-3 transition-colors duration-150 hover:bg-[rgba(255,255,255,0.04)]"
              style={{ borderBottom: "1px solid rgba(226,232,240,0.06)" }}
            >
              {/* Time */}
              <div className="shrink-0 w-[80px] sm:w-[100px] text-right" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.8rem", color: "#00D4FF", paddingTop: 2 }}>
                {item.startTime || ""}
              </div>

              {/* Separator */}
              <div className="shrink-0 w-px self-stretch" style={{ background: "rgba(0,212,255,0.2)" }} />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, color: "#E2E8F0", fontSize: "0.95rem" }}>
                  {item.title}
                </h3>
                {item.description && (
                  <p className="mt-1" style={{ color: "rgba(226,232,240,0.5)", fontFamily: "'Inter', sans-serif", fontSize: "0.8rem", lineHeight: 1.6 }}>
                    {item.description}
                  </p>
                )}
              </div>

              {/* Speaker badge */}
              {item.speakerName && (
                <span className="shrink-0 hidden sm:inline-flex px-3 py-1 text-xs" style={{ background: "rgba(0,212,255,0.08)", color: "#00D4FF", fontFamily: "'Inter', sans-serif", fontWeight: 500, border: "1px solid rgba(0,212,255,0.15)" }}>
                  {item.speakerName}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

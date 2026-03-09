import { useState, useEffect } from "react";
import type { PublicEventData } from "@/lib/publicSite/types";

interface Props { data: PublicEventData; }

function getTimeLeft(target: string) {
  const diff = Math.max(0, new Date(target).getTime() - Date.now());
  const totalDays = Math.ceil(diff / 86400000);
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
    totalDays,
  };
}

export const TechSummitCountdown: React.FC<Props> = ({ data }) => {
  const date = data.hero.date;
  const [time, setTime] = useState(() => date ? getTimeLeft(date) : null);

  useEffect(() => {
    if (!date) return;
    const iv = setInterval(() => setTime(getTimeLeft(date)), 1000);
    return () => clearInterval(iv);
  }, [date]);

  if (!date || !time) return null;

  const units = [
    { label: "Days", value: time.days },
    { label: "Hours", value: time.hours },
    { label: "Min", value: time.minutes },
    { label: "Sec", value: time.seconds },
  ];

  // progress: assume 90-day event window
  const pct = Math.max(0, Math.min(100, ((90 - time.totalDays) / 90) * 100));

  return (
    <section className="relative py-20 sm:py-24 overflow-hidden" style={{ background: "#0A1018" }}>
      {/* Dot grid bg */}
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle, rgba(0,212,255,0.1) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />

      <div className="relative z-10 max-w-4xl mx-auto px-6">
        <div className="flex items-center justify-center gap-3 sm:gap-6">
          {units.map((u, i) => (
            <div key={u.label} className="flex items-center gap-3 sm:gap-6">
              <div className="text-center">
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: "clamp(2rem, 6vw, 4.5rem)", color: "#FFFFFF", lineHeight: 1 }}>
                  {String(u.value).padStart(2, "0")}
                </div>
                <p className="mt-2" style={{ color: "#00D4FF", fontFamily: "'Inter', sans-serif", fontSize: "0.6rem", fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase" }}>
                  {u.label}
                </p>
              </div>
              {i < units.length - 1 && (
                <span className="-mt-5" style={{ color: "#00D4FF", fontFamily: "'JetBrains Mono', monospace", fontSize: "clamp(1.5rem, 4vw, 3rem)", opacity: 0.5 }}>:</span>
              )}
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="mt-10 max-w-md mx-auto">
          <div className="flex items-center justify-between mb-2">
            <span style={{ color: "rgba(226,232,240,0.4)", fontFamily: "'Inter', sans-serif", fontSize: "0.65rem" }}>{time.totalDays} days until event</span>
          </div>
          <div className="h-1 w-full" style={{ background: "rgba(0,212,255,0.1)", borderRadius: 0 }}>
            <div className="h-full transition-all duration-1000" style={{ width: `${pct}%`, background: "#00D4FF" }} />
          </div>
        </div>
      </div>
    </section>
  );
};

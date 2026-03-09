import { useState, useEffect } from "react";
import type { PublicEventData } from "@/lib/publicSite/types";

interface Props { data: PublicEventData; }

function getTimeLeft(target: string) {
  const diff = Math.max(0, new Date(target).getTime() - Date.now());
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

export const MidnightGalaCountdown: React.FC<Props> = ({ data }) => {
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
    { label: "Minutes", value: time.minutes },
    { label: "Seconds", value: time.seconds },
  ];

  return (
    <section className="relative py-20 sm:py-24 overflow-hidden" style={{ background: "#080810" }}>
      {/* Starfield CSS */}
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.4 }}>
        {Array.from({ length: 40 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: 1 + Math.random() * 2,
              height: 1 + Math.random() * 2,
              background: "white",
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              opacity: 0.2 + Math.random() * 0.5,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 flex items-center justify-center gap-4 sm:gap-8">
        {units.map((u, i) => (
          <div key={u.label} className="flex items-center gap-4 sm:gap-8">
            <div className="text-center">
              <div
                className="text-5xl sm:text-7xl leading-none"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700, color: "#C9A84C" }}
              >
                {String(u.value).padStart(2, "0")}
              </div>
              <p
                className="mt-2 text-[0.6rem] uppercase tracking-[0.2em]"
                style={{ color: "rgba(201,168,76,0.6)", fontFamily: "'Lato', sans-serif" }}
              >
                {u.label}
              </p>
            </div>
            {i < units.length - 1 && (
              <span className="text-3xl sm:text-5xl -mt-6" style={{ color: "rgba(201,168,76,0.3)", fontFamily: "'Cormorant Garamond', serif" }}>:</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};

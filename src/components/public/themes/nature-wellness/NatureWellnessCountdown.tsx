import { useState, useEffect } from "react";
import type { PublicEventData } from "@/lib/publicSite/types";

interface Props { data: PublicEventData; }

function getTimeLeft(target: string) {
  const diff = Math.max(0, new Date(target).getTime() - Date.now());
  return { days: Math.floor(diff / 86400000), hours: Math.floor((diff % 86400000) / 3600000), minutes: Math.floor((diff % 3600000) / 60000), seconds: Math.floor((diff % 60000) / 1000) };
}

export const NatureWellnessCountdown: React.FC<Props> = ({ data }) => {
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
    <section className="py-16 sm:py-20" style={{ background: "#2D6A4F" }}>
      <div className="max-w-4xl mx-auto px-6 text-center">
        <h3 className="mb-8" style={{ fontFamily: "'Fraunces', Georgia, serif", fontStyle: "italic", fontWeight: 600, fontSize: "1.3rem", color: "#FFFFFF" }}>
          Gathering Begins In
        </h3>

        <div className="flex items-center justify-center gap-3 sm:gap-5">
          {units.map((u) => (
            <div key={u.label} className="rounded-2xl px-4 sm:px-6 py-4 sm:py-5" style={{ background: "#FAF7F2", minWidth: 72 }}>
              <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: "clamp(1.5rem, 4vw, 2.5rem)", color: "#1C2B1A", lineHeight: 1 }}>
                {String(u.value).padStart(2, "0")}
              </div>
              <p className="mt-1" style={{ color: "#8BB07A", fontFamily: "'DM Sans', sans-serif", fontSize: "0.6rem", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                {u.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

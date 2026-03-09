import { useState, useEffect } from "react";
import type { PublicEventData } from "@/lib/publicSite/types";

interface Props { data: PublicEventData; }

function getTimeLeft(target: string) {
  const diff = Math.max(0, new Date(target).getTime() - Date.now());
  return { days: Math.floor(diff / 86400000), hours: Math.floor((diff % 86400000) / 3600000), minutes: Math.floor((diff % 3600000) / 60000), seconds: Math.floor((diff % 60000) / 1000) };
}

const CONFETTI_COLORS = ["#FDE047", "#7C3AED", "#DB2777", "#10B981", "#F97316", "#3B82F6", "#FFFFFF"];

export const FestivalCountdown: React.FC<Props> = ({ data }) => {
  const date = data.hero.date;
  const [time, setTime] = useState(() => date ? getTimeLeft(date) : null);

  useEffect(() => {
    if (!date) return;
    const iv = setInterval(() => setTime(getTimeLeft(date)), 1000);
    return () => clearInterval(iv);
  }, [date]);

  if (!date || !time) return null;

  const font = "'Cabinet Grotesk', 'Plus Jakarta Sans', sans-serif";
  const units = [
    { label: "Days", value: time.days },
    { label: "Hours", value: time.hours },
    { label: "Min", value: time.minutes },
    { label: "Sec", value: time.seconds },
  ];

  return (
    <section className="relative py-20 sm:py-24 overflow-hidden" style={{ background: "linear-gradient(135deg, #7C3AED 0%, #DB2777 100%)" }}>
      {/* Confetti */}
      <style>{`
        @keyframes fest-confetti { 0% { transform: translateY(-20px) rotate(0deg); opacity: 1; } 100% { transform: translateY(100vh) rotate(720deg); opacity: 0; } }
        .fest-confetti-piece { position: absolute; top: -10px; animation: fest-confetti linear infinite; }
      `}</style>
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="fest-confetti-piece"
          style={{
            left: `${5 + Math.random() * 90}%`,
            width: 6 + Math.random() * 6,
            height: 6 + Math.random() * 6,
            background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animationDuration: `${4 + Math.random() * 6}s`,
            animationDelay: `${Math.random() * 5}s`,
            opacity: 0.7,
          }}
        />
      ))}

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <h3 className="mb-8" style={{ fontFamily: font, fontWeight: 700, fontSize: "1.3rem", color: "#FFFFFF", fontStyle: "italic" }}>
          Until the Festival
        </h3>

        <div className="flex items-center justify-center gap-2 sm:gap-4">
          {units.map((u, i) => (
            <div key={u.label} className="flex items-center gap-2 sm:gap-4">
              <div className="text-center">
                <div style={{ fontFamily: font, fontWeight: 900, fontSize: "clamp(2rem, 6vw, 4.5rem)", color: "#FFFFFF", lineHeight: 1 }}>
                  {String(u.value).padStart(2, "0")}
                </div>
                <p className="mt-1" style={{ fontFamily: font, fontSize: "0.6rem", fontWeight: 500, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  {u.label}
                </p>
              </div>
              {i < units.length - 1 && (
                <span className="-mt-5" style={{ color: "#FDE047", fontSize: "clamp(1rem, 3vw, 2rem)" }}>★</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

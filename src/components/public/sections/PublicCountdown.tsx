import { useState, useEffect } from "react";
import { differenceInDays, differenceInHours, differenceInMinutes, differenceInSeconds, isPast } from "date-fns";

interface Props { targetDate: string; className?: string; }

export const PublicCountdown: React.FC<Props> = ({ targetDate, className = "" }) => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const target = new Date(targetDate);
  if (isPast(target)) return null;

  const days = differenceInDays(target, now);
  const hours = differenceInHours(target, now) % 24;
  const minutes = differenceInMinutes(target, now) % 60;
  const seconds = differenceInSeconds(target, now) % 60;

  const units = [
    { label: "Days", value: days },
    { label: "Hours", value: hours },
    { label: "Min", value: minutes },
    { label: "Sec", value: seconds },
  ];

  return (
    <div className={`flex gap-2.5 sm:gap-4 md:gap-5 ${className}`}>
      {units.map((u) => (
        <div key={u.label} className="flex flex-col items-center">
          <div className="w-14 h-14 sm:w-18 sm:h-18 md:w-20 md:h-20 rounded-xl sm:rounded-2xl border border-border bg-card flex items-center justify-center shadow-sm">
            <span className="text-xl sm:text-2xl md:text-4xl font-bold font-display tabular-nums leading-none">
              {String(Math.max(0, u.value)).padStart(2, "0")}
            </span>
          </div>
          <span className="text-[9px] sm:text-[10px] md:text-xs uppercase tracking-[0.15em] text-muted-foreground mt-1.5 sm:mt-2 font-medium">{u.label}</span>
        </div>
      ))}
    </div>
  );
};

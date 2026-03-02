import { useState, useEffect } from "react";
import { differenceInDays, differenceInHours, differenceInMinutes, differenceInSeconds, isPast } from "date-fns";

interface Props {
  targetDate: string;
  className?: string;
}

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
    { label: "Minutes", value: minutes },
    { label: "Seconds", value: seconds },
  ];

  return (
    <div className={`flex gap-3 sm:gap-4 ${className}`}>
      {units.map((u) => (
        <div key={u.label} className="flex flex-col items-center min-w-[56px] sm:min-w-[68px]">
          <span className="text-2xl sm:text-3xl md:text-4xl font-bold font-display tabular-nums leading-none">
            {String(Math.max(0, u.value)).padStart(2, "0")}
          </span>
          <span className="text-[10px] sm:text-xs uppercase tracking-wider opacity-70 mt-1">{u.label}</span>
        </div>
      ))}
    </div>
  );
};

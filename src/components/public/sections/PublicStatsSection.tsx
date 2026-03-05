import { useEffect, useRef, useState } from "react";
import type { PublicEventData } from "@/lib/publicSite/types";
import { Users, Mic2, CalendarDays, Building2 } from "lucide-react";
import { MotionReveal, MotionRevealItem } from "./MotionReveal";

interface Props { data: PublicEventData; className?: string; }

function useCountUp(target: number, duration = 1500, trigger: boolean) {
  const [value, setValue] = useState(0);
  const ref = useRef<number>();

  useEffect(() => {
    if (!trigger || target === 0) return;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) ref.current = requestAnimationFrame(step);
    };
    ref.current = requestAnimationFrame(step);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [target, duration, trigger]);

  return value;
}

export const PublicStatsSection: React.FC<Props> = ({ data, className = "" }) => {
  const [triggered, setTriggered] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setTriggered(true); obs.disconnect(); }
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const agendaDays = new Set(data.agenda.map((a) => a.dayNumber)).size;

  const stats = [
    { icon: Mic2, label: "Speakers", value: data.speakers.length },
    { icon: CalendarDays, label: "Sessions", value: data.agenda.length },
    ...(agendaDays > 1 ? [{ icon: Building2, label: "Days", value: agendaDays }] : []),
    ...(data.organizers.length > 0 ? [{ icon: Users, label: "Organizers", value: data.organizers.length }] : []),
  ].filter((s) => s.value > 0);

  if (stats.length < 2) return null;

  return (
    <div ref={sectionRef}>
      <MotionReveal className={`max-w-5xl mx-auto px-6 sm:px-8 py-20 ${className}`}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          {stats.map((s, i) => {
            const count = useCountUp(s.value, 1200, triggered);
            return (
              <MotionRevealItem key={s.label} index={i} className="text-center space-y-3">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/8 border border-primary/10 flex items-center justify-center">
                  <s.icon className="h-6 w-6 text-primary" />
                </div>
                <p className="text-4xl sm:text-5xl font-bold font-display tabular-nums">{count}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-[0.15em] font-semibold">{s.label}</p>
              </MotionRevealItem>
            );
          })}
        </div>
      </MotionReveal>
    </div>
  );
};

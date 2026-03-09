import { useEffect, useRef, useState } from "react";
import type { PublicEventData } from "@/lib/publicSite/types";
import { Users, Mic2, CalendarDays, Building2 } from "lucide-react";

function useCountUp(target: number, duration = 1200, trigger: boolean) {
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

interface Props { data: PublicEventData; }

export const TechSummitStats: React.FC<Props> = ({ data }) => {
  const [triggered, setTriggered] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setTriggered(true); obs.disconnect(); } }, { threshold: 0.3 });
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
    <section id="stats" ref={sectionRef} className="py-20" style={{ background: "#0E1420" }}>
      <div className="max-w-5xl mx-auto px-6 sm:px-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {stats.map((s) => {
            const count = useCountUp(s.value, 1200, triggered);
            return (
              <div
                key={s.label}
                className="text-center py-8 px-4"
                style={{ background: "#131D2E", border: "1px solid rgba(0,212,255,0.15)" }}
              >
                <s.icon className="h-5 w-5 mx-auto mb-3" style={{ color: "rgba(0,212,255,0.4)" }} />
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: "3rem", color: "#00D4FF", lineHeight: 1 }}>
                  {count}
                </p>
                <p className="mt-2" style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.7rem", color: "rgba(226,232,240,0.5)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  {s.label}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

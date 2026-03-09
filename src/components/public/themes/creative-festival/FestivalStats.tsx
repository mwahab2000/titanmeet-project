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
      setValue(Math.round((1 - Math.pow(1 - progress, 3)) * target));
      if (progress < 1) ref.current = requestAnimationFrame(step);
    };
    ref.current = requestAnimationFrame(step);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [target, duration, trigger]);
  return value;
}

interface Props { data: PublicEventData; }

export const FestivalStats: React.FC<Props> = ({ data }) => {
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
    ...(data.organizers.length > 0 ? [{ icon: Users, label: "Crew", value: data.organizers.length }] : []),
  ].filter((s) => s.value > 0);

  if (stats.length < 2) return null;

  const font = "'Cabinet Grotesk', 'Plus Jakarta Sans', sans-serif";

  return (
    <section id="stats" ref={sectionRef} className="py-14" style={{ background: "#0A0A0A" }}>
      <div className="max-w-5xl mx-auto px-6">
        <div className="flex items-stretch justify-center divide-x" style={{ borderColor: "#FDE047" }}>
          {stats.map((s) => {
            const count = useCountUp(s.value, 1200, triggered);
            return (
              <div key={s.label} className="flex-1 text-center px-4 py-4" style={{ borderColor: "rgba(253,224,71,0.3)" }}>
                <p style={{ fontFamily: font, fontWeight: 900, fontSize: "3rem", color: "#FFFFFF", lineHeight: 1 }}>
                  {count}
                </p>
                <p className="mt-1" style={{ fontFamily: font, fontSize: "0.7rem", fontWeight: 500, color: "#FDE047", textTransform: "uppercase", letterSpacing: "0.1em" }}>
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

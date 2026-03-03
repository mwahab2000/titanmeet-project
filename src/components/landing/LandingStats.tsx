import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { Users, Calendar, CheckCircle2, Globe } from "lucide-react";

const stats = [
  { icon: Users, value: 2000, suffix: "+", label: "Event Organizers" },
  { icon: Calendar, value: 50, suffix: "K+", label: "Events Hosted" },
  { icon: CheckCircle2, value: 99.9, suffix: "%", label: "Platform Uptime" },
  { icon: Globe, value: 40, suffix: "+", label: "Countries Served" },
];

function AnimatedCounter({ target, suffix, inView }: { target: number; suffix: string; inView: boolean }) {
  const [count, setCount] = useState(0);
  const hasDecimal = target % 1 !== 0;

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const duration = 2000;
    const steps = 60;
    const increment = target / steps;
    const interval = duration / steps;
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, interval);
    return () => clearInterval(timer);
  }, [inView, target]);

  return (
    <span className="font-display text-4xl font-bold md:text-5xl gradient-titan-text">
      {hasDecimal ? count.toFixed(1) : Math.floor(count)}
      {suffix}
    </span>
  );
}

export const LandingStats = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="py-20 bg-[hsl(var(--landing-bg))]" ref={ref}>
      <div className="container">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.15, duration: 0.5 }}
              className="flex flex-col items-center text-center gap-2"
            >
              <stat.icon className="h-6 w-6 text-[hsl(var(--titan-green))] mb-2" />
              <AnimatedCounter target={stat.value} suffix={stat.suffix} inView={isInView} />
              <span className="text-sm text-[hsl(var(--landing-fg-muted))]">{stat.label}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

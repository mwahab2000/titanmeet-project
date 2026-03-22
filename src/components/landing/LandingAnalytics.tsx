import { useRef } from "react";
import { motion, useInView } from "framer-motion";

const metrics = [
  { label: "RSVP Rate", value: "87%", color: "hsl(var(--titan-green))" },
  { label: "Attendance", value: "74%", color: "hsl(var(--titan-blue))" },
  { label: "No-Show", value: "13%", color: "hsl(var(--destructive))" },
  { label: "Survey Response", value: "62%", color: "hsl(var(--titan-green))" },
];

const barData = [35, 42, 58, 72, 85, 91, 88, 76, 45, 30, 18, 8];

export const LandingAnalytics = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="py-24 bg-[hsl(var(--landing-bg))]" ref={ref}>
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="mb-4 text-center"
        >
          <span className="text-sm font-semibold text-[hsl(var(--titan-green))] tracking-wide uppercase">Analytics</span>
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.1 }}
          className="font-display text-3xl font-bold md:text-4xl text-center mb-3"
        >
          Make decisions before it's too late
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.2 }}
          className="mx-auto max-w-2xl text-center text-[hsl(var(--landing-fg-muted))] mb-12"
        >
          Real-time dashboards that update as check-ins happen.
        </motion.p>

        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.3 }}
            className="glass-card-landing rounded-xl border border-[hsl(var(--landing-border)/0.3)] p-6"
          >
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {metrics.map((m, i) => (
                <motion.div
                  key={m.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 0.4 + i * 0.1 }}
                  className="rounded-lg bg-[hsl(var(--landing-fg)/0.04)] p-4 text-center"
                >
                  <p className="text-[11px] text-[hsl(var(--landing-fg-muted)/0.6)] mb-1">{m.label}</p>
                  <p className="font-display text-2xl font-bold" style={{ color: m.color }}>{m.value}</p>
                </motion.div>
              ))}
            </div>

            {/* Check-in histogram */}
            <div className="rounded-lg bg-[hsl(var(--landing-fg)/0.03)] p-4">
              <p className="text-xs text-[hsl(var(--landing-fg-muted)/0.5)] mb-3">Check-in Distribution</p>
              <div className="flex items-end gap-1.5 h-24">
                {barData.map((h, i) => (
                  <motion.div
                    key={i}
                    initial={{ height: 0 }}
                    animate={isInView ? { height: `${h}%` } : {}}
                    transition={{ delay: 0.6 + i * 0.05, duration: 0.5, ease: "easeOut" }}
                    className="flex-1 rounded-t bg-gradient-to-t from-[hsl(var(--titan-green)/0.4)] to-[hsl(var(--titan-blue)/0.4)]"
                  />
                ))}
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[9px] text-[hsl(var(--landing-fg-muted)/0.4)]">8:00 AM</span>
                <span className="text-[9px] text-[hsl(var(--landing-fg-muted)/0.4)]">6:00 PM</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

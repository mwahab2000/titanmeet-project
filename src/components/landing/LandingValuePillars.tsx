import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Bot, MessageSquare, BarChart3, Copy } from "lucide-react";

const pillars = [
  {
    icon: Bot,
    title: "AI Event Builder",
    description: "Create complete events through conversation. Venue, agenda, visuals, and logistics — all generated automatically.",
  },
  {
    icon: MessageSquare,
    title: "Smart Communication",
    description: "WhatsApp + Email campaigns with automated confirmations, reminders, and segmented follow-ups.",
  },
  {
    icon: BarChart3,
    title: "Real-Time Analytics",
    description: "RSVP rate, attendance rate, no-show %, and check-in distribution — all live during your event.",
  },
  {
    icon: Copy,
    title: "Reusable Event System",
    description: "Templates, brand kits, and visual packs. Launch your next event in minutes, not days.",
  },
];

export const LandingValuePillars = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="py-24 bg-[hsl(var(--landing-bg-alt))]" ref={ref}>
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="mb-4 text-center"
        >
          <span className="text-sm font-semibold text-[hsl(var(--titan-green))] tracking-wide uppercase">Platform</span>
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.1 }}
          className="font-display text-3xl font-bold md:text-4xl text-center mb-14"
        >
          Everything you need. Nothing you don't.
        </motion.h2>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
          {pillars.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="glass-card-landing rounded-xl border border-[hsl(var(--landing-border)/0.3)] p-6 text-center hover:border-[hsl(var(--titan-green)/0.3)] transition-colors"
            >
              <div className="h-12 w-12 rounded-xl bg-[hsl(var(--titan-green)/0.1)] flex items-center justify-center mx-auto mb-4">
                <p.icon className="h-6 w-6 text-[hsl(var(--titan-green))]" />
              </div>
              <h3 className="font-display text-base font-semibold mb-2 text-[hsl(var(--landing-fg))]">{p.title}</h3>
              <p className="text-sm text-[hsl(var(--landing-fg-muted))] leading-relaxed">{p.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

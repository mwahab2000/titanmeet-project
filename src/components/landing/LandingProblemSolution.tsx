import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { X, ArrowRight, CheckCircle2 } from "lucide-react";

const problems = [
  "Low RSVP rates with no follow-up system",
  "No-shows that waste budget and planning",
  "Manual follow-ups across WhatsApp, email, and calls",
  "Fragmented tools for invites, surveys, and logistics",
];

export const LandingProblemSolution = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="py-24 bg-[hsl(var(--landing-bg))]" ref={ref}>
      <div className="container max-w-4xl">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="font-display text-3xl font-bold md:text-4xl text-center mb-14"
        >
          Sound familiar?
        </motion.h2>

        <div className="grid md:grid-cols-2 gap-8 items-center">
          {/* Problems */}
          <div className="space-y-4">
            {problems.map((p, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="flex items-start gap-3 rounded-lg bg-[hsl(var(--destructive)/0.05)] border border-[hsl(var(--destructive)/0.15)] p-3"
              >
                <X className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                <span className="text-sm text-[hsl(var(--landing-fg)/0.8)]">{p}</span>
              </motion.div>
            ))}
          </div>

          {/* Solution */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.6 }}
            className="glass-card-landing rounded-xl border border-[hsl(var(--titan-green)/0.3)] p-6 text-center"
          >
            <div className="h-14 w-14 rounded-full gradient-titan flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-7 w-7 text-white" />
            </div>
            <h3 className="font-display text-xl font-bold mb-2 text-[hsl(var(--landing-fg))]">
              TitanMeet replaces all of this
            </h3>
            <p className="text-sm text-[hsl(var(--landing-fg-muted))]">
              One AI-powered platform for event creation, communication, attendance tracking, and analytics.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2 text-[hsl(var(--titan-green))] text-sm font-medium">
              <span>See how</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLANS, PLAN_ORDER, VOICE_MINUTES_NOTE } from "@/config/pricing";

export const LandingPricing = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="pricing" className="py-24" ref={ref}>
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="mb-4 text-center"
        >
          <span className="text-sm font-semibold text-[hsl(var(--titan-green))] tracking-wide uppercase">Pricing</span>
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.1 }}
          className="font-display text-3xl font-bold md:text-4xl text-center mb-4"
        >
          Simple, transparent pricing
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.2 }}
          className="mx-auto max-w-2xl text-center text-[hsl(var(--landing-fg-muted))] mb-12"
        >
          Built for small HR teams. Pick a plan and start publishing events today.
        </motion.p>

        <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
          {PLAN_ORDER.map((planId, i) => {
            const plan = PLANS[planId];
            return (
              <motion.div
                key={planId}
                initial={{ opacity: 0, y: 40 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.3 + i * 0.12 }}
                className={`glass-card-landing rounded-xl p-8 border transition-all duration-300 relative ${
                  plan.highlight ? "border-[hsl(var(--titan-green)/0.5)] scale-105" : "border-[hsl(var(--landing-border)/0.3)]"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full gradient-titan px-4 py-1 text-xs font-semibold text-white">
                    Most Popular
                  </div>
                )}
                <h3 className="font-display text-xl font-semibold mb-1">{plan.name}</h3>
                <div className="mb-4">
                  <span className="font-display text-4xl font-bold">${plan.monthlyPrice}</span>
                  <span className="text-[hsl(var(--landing-fg-muted))]">/mo</span>
                </div>
                <p className="text-sm text-[hsl(var(--landing-fg-muted))] mb-6">{plan.description}</p>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feat) => (
                    <li key={feat.text} className={`flex items-center gap-2 text-sm ${feat.highlight ? "text-[hsl(var(--titan-green))] font-medium" : "text-[hsl(var(--landing-fg-muted))]"}`}>
                      <Check className="h-4 w-4 text-[hsl(var(--titan-green))] shrink-0" />
                      {feat.text}
                    </li>
                  ))}
                </ul>
                <Button
                  className={`w-full font-semibold ${
                    plan.highlight
                      ? "gradient-titan border-0 text-white"
                      : "bg-[hsl(var(--landing-fg)/0.1)] text-[hsl(var(--landing-fg))] hover:bg-[hsl(var(--landing-fg)/0.2)] border-0"
                  }`}
                  asChild
                >
                  <Link to="/login?tab=signup">{plan.buttonText}</Link>
                </Button>
              </motion.div>
            );
          })}
        </div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: 0.7 }}
          className="text-center text-sm text-[hsl(var(--landing-fg-muted)/0.6)] mt-8 max-w-2xl mx-auto"
        >
          {VOICE_MINUTES_NOTE}
        </motion.p>
      </div>
    </section>
  );
};

import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const plans = [
  {
    name: "Starter",
    monthlyPrice: 149,
    annualPrice: 119,
    desc: "Perfect for individuals launching their first few events.",
    features: ["3 clients", "5 active events/mo", "500 attendees/mo", "2,000 emails/mo", "5 GB storage", "Standard support"],
    cta: "Start with Starter",
    popular: false,
  },
  {
    name: "Professional",
    monthlyPrice: 399,
    annualPrice: 319,
    desc: "Designed for growing agencies and frequent organizers.",
    features: ["10 clients", "20 active events/mo", "3,000 attendees/mo", "10,000 emails/mo", "20 GB storage", "Priority support"],
    cta: "Get Started Now",
    popular: true,
  },
  {
    name: "Enterprise",
    monthlyPrice: 1099,
    annualPrice: 879,
    desc: "Enterprise-grade volume for large-scale operations.",
    features: ["30 clients", "75 active events/mo", "15,000 attendees/mo", "50,000 emails/mo", "100 GB storage", "Premium support"],
    cta: "Start with Enterprise",
    popular: false,
  },
];

export const LandingPricing = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const [annual, setAnnual] = useState(false);

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
          className="mx-auto max-w-2xl text-center text-[hsl(var(--landing-fg-muted))] mb-10"
        >
          Choose the plan that fits your current volume and scale as you grow.
        </motion.p>

        {/* Annual/Monthly Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.25 }}
          className="flex items-center justify-center gap-3 mb-12"
        >
          <span className={`text-sm font-medium transition-colors ${!annual ? "text-[hsl(var(--landing-fg))]" : "text-[hsl(var(--landing-fg-muted))]"}`}>Monthly</span>
          <button
            onClick={() => setAnnual(!annual)}
            className={`relative h-7 w-12 rounded-full transition-colors duration-300 ${annual ? "gradient-titan" : "bg-[hsl(var(--landing-fg)/0.15)]"}`}
          >
            <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-300 ${annual ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
          <span className={`text-sm font-medium transition-colors ${annual ? "text-[hsl(var(--landing-fg))]" : "text-[hsl(var(--landing-fg-muted))]"}`}>
            Annual
            <span className="ml-1.5 inline-flex items-center rounded-full bg-[hsl(var(--titan-green)/0.1)] px-2 py-0.5 text-xs font-semibold text-[hsl(var(--titan-green))]">
              Save 20%
            </span>
          </span>
        </motion.div>

        <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
          {plans.map((plan, i) => {
            const price = annual ? plan.annualPrice : plan.monthlyPrice;
            return (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 40 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.3 + i * 0.12 }}
                className={`glass-card-landing rounded-xl p-8 border transition-all duration-300 relative ${
                  plan.popular ? "border-[hsl(var(--titan-green)/0.5)] scale-105" : "border-[hsl(var(--landing-border)/0.3)]"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full gradient-titan px-4 py-1 text-xs font-semibold text-white">
                    Most Popular
                  </div>
                )}
                <h3 className="font-display text-xl font-semibold mb-1">{plan.name}</h3>
                <div className="mb-4">
                  <span className="font-display text-4xl font-bold">${price}</span>
                  <span className="text-[hsl(var(--landing-fg-muted))]">/mo</span>
                </div>
                <p className="text-sm text-[hsl(var(--landing-fg-muted))] mb-6">{plan.desc}</p>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-center gap-2 text-sm text-[hsl(var(--landing-fg-muted))]">
                      <Check className="h-4 w-4 text-[hsl(var(--titan-green))]" />
                      {feat}
                    </li>
                  ))}
                </ul>
                <Button
                  className={`w-full font-semibold ${
                    plan.popular
                      ? "gradient-titan border-0 text-white"
                      : "bg-[hsl(var(--landing-fg)/0.1)] text-[hsl(var(--landing-fg))] hover:bg-[hsl(var(--landing-fg)/0.2)] border-0"
                  }`}
                  asChild
                >
                  <Link to="/login?tab=signup">{plan.cta}</Link>
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
          All plans include unlimited RSVPs and survey responses. Overage fees apply for extra clients, events, attendees, emails, and storage beyond your plan limits.
        </motion.p>
      </div>
    </section>
  );
};

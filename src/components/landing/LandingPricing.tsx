import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { Check, Minus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PLANS, PLAN_ORDER, COMPARISON_TABLE, ANNUAL_DISCOUNT_PERCENT } from "@/config/pricing";

/* ------------------------------------------------------------------ */
/*  Pricing Card                                                       */
/* ------------------------------------------------------------------ */

function PricingCard({
  planId,
  annual,
  index,
}: {
  planId: string;
  annual: boolean;
  index: number;
}) {
  const plan = PLANS[planId];
  const price = annual ? plan.annualMonthlyPrice : plan.monthlyPrice;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ delay: 0.15 + index * 0.1, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.25 } }}
      className={`relative flex flex-col rounded-2xl border p-8 transition-shadow duration-300 ${
        plan.highlight
          ? "border-[hsl(var(--titan-green)/0.5)] bg-[hsl(var(--landing-fg)/0.03)] shadow-[0_8px_40px_-12px_hsl(var(--titan-green)/0.2)]"
          : "border-[hsl(var(--landing-border)/0.3)] bg-[hsl(var(--landing-glass))]"
      }`}
    >
      {/* Badge */}
      {plan.highlight && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full gradient-titan px-4 py-1 text-xs font-semibold text-white shadow-md">
          <Sparkles className="h-3 w-3" />
          Most Popular
        </div>
      )}

      {/* Header */}
      <h3 className="font-display text-lg font-bold tracking-tight">{plan.name}</h3>

      {/* Price */}
      <div className="mt-4 flex items-baseline gap-1">
        <AnimatePresence mode="wait">
          <motion.span
            key={price}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.25 }}
            className="font-display text-5xl font-extrabold tracking-tight"
          >
            ${price}
          </motion.span>
        </AnimatePresence>
        <span className="text-sm text-[hsl(var(--landing-fg-muted))]">/ mo</span>
      </div>

      {annual && (
        <p className="mt-1 text-xs text-[hsl(var(--titan-green))] font-medium">
          ${plan.annualTotalPrice.toLocaleString()} billed annually
        </p>
      )}

      {/* Description */}
      <p className="mt-4 text-sm leading-relaxed text-[hsl(var(--landing-fg-muted))]">
        {plan.description}
      </p>

      {/* Features */}
      <ul className="mt-6 flex-1 space-y-2.5">
        {plan.features.map((feat) => (
          <li key={feat.text} className="flex items-start gap-2.5 text-sm text-[hsl(var(--landing-fg-muted))]">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--titan-green))]" />
            <span>{feat.text}</span>
          </li>
        ))}
      </ul>

      {/* Best for */}
      <p className="mt-6 text-xs font-medium text-[hsl(var(--landing-fg-muted)/0.7)]">
        Best for: {plan.bestFor}
      </p>

      {/* CTA */}
      <Button
        className={`mt-6 w-full font-semibold text-sm h-11 ${
          plan.highlight
            ? "gradient-titan border-0 text-white shadow-md hover:shadow-lg"
            : "bg-[hsl(var(--landing-fg)/0.07)] text-[hsl(var(--landing-fg))] hover:bg-[hsl(var(--landing-fg)/0.12)] border-0"
        }`}
        asChild
      >
        <Link to="/login?tab=signup">{plan.buttonText}</Link>
      </Button>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Comparison Table Cell                                              */
/* ------------------------------------------------------------------ */

function CellValue({ value }: { value: string }) {
  if (value === "✓") return <Check className="mx-auto h-4 w-4 text-[hsl(var(--titan-green))]" />;
  if (value === "—") return <Minus className="mx-auto h-4 w-4 text-[hsl(var(--landing-fg-muted)/0.3)]" />;
  return <span>{value}</span>;
}

/* ------------------------------------------------------------------ */
/*  Main Section                                                       */
/* ------------------------------------------------------------------ */

export const LandingPricing = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" className="py-24" ref={ref}>
      <div className="container max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="text-center"
        >
          <span className="text-sm font-semibold text-[hsl(var(--titan-green))] tracking-wide uppercase">
            Pricing
          </span>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.1 }}
          className="font-display text-3xl font-bold md:text-4xl text-center mt-3"
        >
          Simple pricing. Powerful events.
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.15 }}
          className="mx-auto mt-4 max-w-2xl text-center text-[hsl(var(--landing-fg-muted))]"
        >
          Run your entire event lifecycle with AI, automation, and real-time insights.
        </motion.p>

        {/* Billing Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.2 }}
          className="mt-8 flex items-center justify-center gap-3"
        >
          <span className={`text-sm font-medium transition-colors ${!annual ? "text-[hsl(var(--landing-fg))]" : "text-[hsl(var(--landing-fg-muted))]"}`}>
            Monthly
          </span>
          <Switch checked={annual} onCheckedChange={setAnnual} />
          <span className={`text-sm font-medium transition-colors ${annual ? "text-[hsl(var(--landing-fg))]" : "text-[hsl(var(--landing-fg-muted))]"}`}>
            Annual
          </span>
          <AnimatePresence>
            {annual && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8, x: -8 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8, x: -8 }}
                className="ml-1 rounded-full bg-[hsl(var(--titan-green)/0.12)] px-2.5 py-0.5 text-xs font-semibold text-[hsl(var(--titan-green))]"
              >
                Save {ANNUAL_DISCOUNT_PERCENT}%
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Cards */}
        <div className="mt-12 grid gap-6 md:grid-cols-3 items-stretch">
          {PLAN_ORDER.map((planId, i) => (
            <PricingCard key={planId} planId={planId} annual={annual} index={i} />
          ))}
        </div>

        {/* Trust microcopy */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: 0.7 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-[hsl(var(--landing-fg-muted)/0.6)]"
        >
          <span>Annual plans save {ANNUAL_DISCOUNT_PERCENT}%.</span>
          <span>Existing customers keep their current pricing.</span>
          <span>No setup fees. Cancel anytime.</span>
        </motion.div>

        {/* Comparison Table */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mt-20"
        >
          <h3 className="font-display text-2xl font-bold text-center mb-8">
            Compare plans
          </h3>

          <div className="overflow-x-auto rounded-xl border border-[hsl(var(--landing-border)/0.3)]">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--landing-border)/0.2)]">
                  <th className="p-4 text-left font-medium text-[hsl(var(--landing-fg-muted))]">
                    Feature
                  </th>
                  {PLAN_ORDER.map((id) => (
                    <th
                      key={id}
                      className={`p-4 text-center font-semibold ${
                        PLANS[id].highlight ? "text-[hsl(var(--titan-green))]" : "text-[hsl(var(--landing-fg))]"
                      }`}
                    >
                      {PLANS[id].name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON_TABLE.map((row, i) => (
                  <tr
                    key={row.feature}
                    className={`border-b border-[hsl(var(--landing-border)/0.1)] ${
                      i % 2 === 0 ? "bg-[hsl(var(--landing-fg)/0.01)]" : ""
                    }`}
                  >
                    <td className="p-4 text-left text-[hsl(var(--landing-fg-muted))]">
                      {row.feature}
                    </td>
                    <td className="p-4 text-center text-[hsl(var(--landing-fg-muted))]">
                      <CellValue value={row.starter} />
                    </td>
                    <td className="p-4 text-center text-[hsl(var(--landing-fg-muted))]">
                      <CellValue value={row.professional} />
                    </td>
                    <td className="p-4 text-center text-[hsl(var(--landing-fg-muted))]">
                      <CellValue value={row.enterprise} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

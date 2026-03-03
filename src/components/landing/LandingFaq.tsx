import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  { q: 'What counts as an "active event"?', a: "An active event is any site currently published and accepting RSVPs. Drafts and past archived events do not count against your limit." },
  { q: "Can I manage multiple clients?", a: "Yes! Our multi-tenant architecture is built specifically for agencies. You can create isolated workspaces for different clients under a single login." },
  { q: "How customizable are the pages?", a: "You have full control over branding, colors, fonts, and layout. You can also inject custom CSS and JavaScript if you need extra flexibility." },
  { q: "What happens if I exceed my limits?", a: "We won't shut you down. If you go over your event or storage limits, you'll be billed at the standard overage rate on your next cycle." },
  { q: "Are RSVPs and surveys unlimited?", a: "Yes, we do not charge per RSVP or survey response. Scale your guest list as much as you need without extra costs." },
  { q: "Can I export my data?", a: "Absolutely. You can export guest lists, survey results, and analytics as CSV or PDF at any time." },
];

export const LandingFaq = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="faq" className="py-24 bg-[hsl(var(--landing-bg-alt))]" ref={ref}>
      <div className="container max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="mb-4 text-center"
        >
          <span className="text-sm font-semibold text-[hsl(var(--titan-green))] tracking-wide uppercase">FAQ</span>
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.1 }}
          className="font-display text-3xl font-bold md:text-4xl text-center mb-12"
        >
          Frequently Asked Questions
        </motion.h2>
        <Accordion type="single" collapsible className="space-y-4">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 15 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.2 + i * 0.08 }}
            >
              <AccordionItem value={`faq-${i}`} className="glass-card-landing rounded-xl border border-[hsl(var(--landing-border)/0.3)] px-6">
                <AccordionTrigger className="text-left font-medium text-[hsl(var(--landing-fg))] hover:no-underline">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-[hsl(var(--landing-fg-muted))]">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            </motion.div>
          ))}
        </Accordion>
      </div>
    </section>
  );
};

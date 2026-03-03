import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Layers, Paintbrush, Rocket } from "lucide-react";

const steps = [
  {
    icon: Layers,
    number: "01",
    title: "Create Workspace",
    description: "Set up a dedicated workspace for each client with custom branding, assets, and team permissions.",
  },
  {
    icon: Paintbrush,
    number: "02",
    title: "Build Event Page",
    description: "Use the sidebar editor to craft stunning event pages with agenda, speakers, gallery, venue info, and more.",
  },
  {
    icon: Rocket,
    number: "03",
    title: "Launch & Track",
    description: "Publish instantly, send invitations, track RSVPs in real-time, and collect post-event feedback.",
  },
];

export const LandingHowItWorks = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="how-it-works" className="py-24 bg-[hsl(var(--landing-bg))]" ref={ref}>
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="mb-4 text-center"
        >
          <span className="text-sm font-semibold text-[hsl(var(--titan-green))] tracking-wide uppercase">How It Works</span>
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="font-display text-3xl font-bold md:text-4xl text-center mb-16"
        >
          Three steps to your next event
        </motion.h2>

        <div className="relative max-w-4xl mx-auto">
          {/* Connecting line */}
          <div className="absolute top-16 left-0 right-0 hidden md:block">
            <div className="mx-auto w-2/3 h-0.5 bg-gradient-to-r from-transparent via-[hsl(var(--titan-green)/0.3)] to-transparent" />
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 40 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.2 + i * 0.2, duration: 0.6 }}
                className="relative flex flex-col items-center text-center"
              >
                <div className="relative mb-6">
                  <div className="h-16 w-16 rounded-2xl gradient-titan flex items-center justify-center shadow-lg">
                    <step.icon className="h-7 w-7 text-white" />
                  </div>
                  <span className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-[hsl(var(--landing-bg))] border-2 border-[hsl(var(--titan-green))] flex items-center justify-center text-xs font-bold font-display text-[hsl(var(--titan-green))]">
                    {step.number.replace("0", "")}
                  </span>
                </div>
                <h3 className="font-display text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-[hsl(var(--landing-fg-muted))] max-w-xs">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

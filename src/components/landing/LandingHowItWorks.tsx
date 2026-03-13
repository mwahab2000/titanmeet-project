import { useRef, useCallback } from "react";
import { motion, useInView } from "framer-motion";
import { Building2, CalendarPlus, ImageIcon, Users, MapPin, MessageSquare } from "lucide-react";
import VoiceEarIcon from "@/components/voice/VoiceEarIcon";
import { HowItWorksConnector } from "./HowItWorksConnector";

const steps = [
  {
    icon: Building2,
    number: "1",
    title: "Create the Client Workspace",
    description: "Set up a dedicated workspace for each client with branding, assets, and permissions.",
  },
  {
    icon: CalendarPlus,
    number: "2",
    title: "Create the Event",
    description: "Start a new event, set the basics (name, date, venue), and choose a template if needed.",
  },
  {
    icon: ImageIcon,
    number: "3",
    title: "Design the Event Page",
    description: "Upload banners and logos, configure the hero section, and make the site look premium in minutes.",
  },
  {
    icon: Users,
    number: "4",
    title: "Add Attendees",
    description: "Import from Excel/CSV or add manually, then generate unique invite and survey links per attendee.",
  },
  {
    icon: MapPin,
    number: "5",
    title: "Plan Logistics",
    description: "Capture venue details, transportation, dress code, organizers, and on-ground coordination.",
  },
  {
    icon: MessageSquare,
    number: "6",
    title: "Communicate & Collect Feedback",
    description: "Send WhatsApp/email messages, reminders, and surveys — track responses, view stats, and export results to Excel.",
  },
];

export const LandingHowItWorks = () => {
  const sectionRef = useRef(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const iconRefs = useRef<(HTMLElement | null)[]>([]);
  const isInView = useInView(sectionRef, { once: true, margin: "-80px" });

  const setIconRef = useCallback((index: number) => (el: HTMLDivElement | null) => {
    iconRefs.current[index] = el;
  }, []);

  return (
    <section id="how-it-works" className="py-24 bg-[hsl(var(--landing-bg))]" ref={sectionRef}>
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
          className="font-display text-3xl font-bold md:text-4xl text-center mb-6"
        >
          Six steps to your next event
        </motion.h2>

        {/* Voice Studio badge */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="flex justify-center mb-14"
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-600/15 to-indigo-600/15 border border-purple-500/20 px-4 py-1.5 text-sm font-medium text-purple-300">
            <VoiceEarIcon size={16} className="text-purple-400" />
            Bonus: Build steps 2–5 by voice with Voice Studio
          </span>
        </motion.div>

        <div ref={gridRef} className="relative max-w-5xl mx-auto">
          <HowItWorksConnector
            containerRef={gridRef}
            iconRefs={iconRefs}
            isInView={isInView}
          />

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 relative" style={{ zIndex: 1 }}>
            {steps.map((step, i) => {
              // On desktop (lg:grid-cols-3), reverse row 2 so step 4 is right, 5 middle, 6 left
              const colStart = i >= 3 ? `lg:col-start-${3 - (i - 3)}` : '';
              return (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 40 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.25 + i * 0.12, duration: 0.6 }}
                className={`relative flex flex-col items-center text-center ${colStart}`}
                style={i >= 3 ? { order: undefined } : undefined}
              >
                <div ref={setIconRef(i)} className="relative mb-6">
                  <div className="h-16 w-16 rounded-2xl gradient-titan flex items-center justify-center shadow-lg">
                    <step.icon className="h-7 w-7 text-white" />
                  </div>
                  <span className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-[hsl(var(--landing-bg))] border-2 border-[hsl(var(--titan-green))] flex items-center justify-center text-xs font-bold font-display text-[hsl(var(--titan-green))]">
                    {step.number}
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

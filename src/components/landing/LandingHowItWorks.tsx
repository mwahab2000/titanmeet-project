import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Building2, CalendarPlus, ImageIcon, Users, MapPin, MessageSquare } from "lucide-react";
import VoiceEarIcon from "@/components/voice/VoiceEarIcon";
import { HowItWorksRoad } from "./HowItWorksRoad";

const steps = [
  {
    icon: Building2,
    number: "01",
    title: "Create the Client Workspace",
    description: "Set up a dedicated workspace for each client with branding, assets, and permissions.",
  },
  {
    icon: CalendarPlus,
    number: "02",
    title: "Create the Event",
    description: "Start a new event, set the basics (name, date, venue), and choose a template if needed.",
  },
  {
    icon: ImageIcon,
    number: "03",
    title: "Design the Event Page",
    description: "Upload banners and logos, configure the hero section, and make the site look premium in minutes.",
  },
  {
    icon: Users,
    number: "04",
    title: "Add Attendees",
    description: "Import from Excel/CSV or add manually, then generate unique invite and survey links per attendee.",
  },
  {
    icon: MapPin,
    number: "05",
    title: "Plan Logistics",
    description: "Capture venue details, transportation, dress code, organizers, and on-ground coordination.",
  },
  {
    icon: MessageSquare,
    number: "06",
    title: "Communicate & Collect Feedback",
    description: "Send WhatsApp/email messages, reminders, and surveys — track responses, view stats, and export results to Excel.",
  },
];

/* Step badge (circle with number + "STEP") */
const StepBadge: React.FC<{ number: string; delay: number; isInView: boolean }> = ({ number, delay, isInView }) => (
  <motion.div
    initial={{ scale: 0, opacity: 0 }}
    animate={isInView ? { scale: 1, opacity: 1 } : {}}
    transition={{ delay, duration: 0.4, type: "spring", stiffness: 200 }}
    className="relative mx-auto w-16 h-16 rounded-full flex flex-col items-center justify-center border-2 shadow-lg"
    style={{
      borderColor: "hsl(var(--titan-green))",
      background: "hsl(220, 30%, 10%)",
      boxShadow: "0 0 20px hsl(145 63% 42% / 0.2), 0 0 40px hsl(210 70% 50% / 0.1)",
    }}
  >
    <span className="text-lg font-bold leading-none" style={{ color: "hsl(var(--titan-green))" }}>{number}</span>
    <span className="text-[0.5rem] font-semibold tracking-widest uppercase" style={{ color: "hsl(210, 70%, 60%)" }}>Step</span>
  </motion.div>
);

/* Vertical pin/stem connecting badge to road */
const Stem: React.FC<{ position: "top" | "bottom" }> = ({ position }) => (
  <div
    className={`mx-auto w-px h-6 sm:h-8 ${position === "top" ? "mt-auto" : "mb-auto"}`}
    style={{ background: "linear-gradient(to bottom, hsl(145 63% 42% / 0.4), hsl(210 70% 50% / 0.15))" }}
  />
);

export const LandingHowItWorks = () => {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-80px" });

  return (
    <section id="how-it-works" className="py-24 bg-[hsl(var(--landing-bg))] overflow-hidden" ref={sectionRef}>
      <div className="container">
        {/* Header */}
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
            <VoiceEarIcon size={16} aria-hidden="true" className="text-purple-400 animate-ear-pulse motion-reduce:animate-none" />
          </span>
        </motion.div>

        {/* ===== DESKTOP ROAD LAYOUT (hidden below lg) ===== */}
        <div className="hidden lg:block relative max-w-6xl mx-auto" style={{ height: 420 }}>
          {/* SVG Road */}
          <HowItWorksRoad isInView={isInView} />

          {/* Steps positioned absolutely over the road */}
          {steps.map((step, i) => {
            const isTop = i % 2 === 0; // 0,2,4 top; 1,3,5 bottom
            // x positions: evenly spaced across container (matching road viewBox)
            const leftPercent = (100 / 6) * 0.5 + (100 / 6) * i;
            const delay = 0.3 + i * 0.15;

            return (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: isTop ? -30 : 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay, duration: 0.5 }}
                className="absolute flex flex-col items-center text-center"
                style={{
                  left: `${leftPercent}%`,
                  transform: "translateX(-50%)",
                  width: 170,
                  ...(isTop
                    ? { top: 0, paddingBottom: 8 }
                    : { bottom: 0, paddingTop: 8 }),
                  zIndex: 2,
                }}
              >
                {isTop ? (
                  <>
                    {/* Content above road */}
                    <div className="mb-2">
                      <div className="h-12 w-12 rounded-xl gradient-titan flex items-center justify-center shadow-md mx-auto mb-2">
                        <step.icon className="h-5 w-5 text-white" />
                      </div>
                      <h3 className="font-display text-sm font-semibold mb-1" style={{ color: "hsl(var(--landing-fg))" }}>{step.title}</h3>
                      <p className="text-xs leading-relaxed" style={{ color: "hsl(var(--landing-fg-muted))", opacity: 0.7 }}>{step.description}</p>
                    </div>
                    <Stem position="top" />
                    <StepBadge number={step.number} delay={delay + 0.2} isInView={isInView} />
                  </>
                ) : (
                  <>
                    {/* Content below road */}
                    <StepBadge number={step.number} delay={delay + 0.2} isInView={isInView} />
                    <Stem position="bottom" />
                    <div className="mt-2">
                      <div className="h-12 w-12 rounded-xl gradient-titan flex items-center justify-center shadow-md mx-auto mb-2">
                        <step.icon className="h-5 w-5 text-white" />
                      </div>
                      <h3 className="font-display text-sm font-semibold mb-1" style={{ color: "hsl(var(--landing-fg))" }}>{step.title}</h3>
                      <p className="text-xs leading-relaxed" style={{ color: "hsl(var(--landing-fg-muted))", opacity: 0.7 }}>{step.description}</p>
                    </div>
                  </>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* ===== MOBILE / TABLET VERTICAL TIMELINE (visible below lg) ===== */}
        <div className="lg:hidden relative max-w-md mx-auto">
          {/* Vertical road line */}
          <div
            className="absolute left-8 top-0 bottom-0 w-1 rounded-full"
            style={{ background: "hsl(220, 30%, 10%)", border: "1px solid hsl(215, 25%, 18%)", zIndex: 0 }}
          >
            {/* Center dash */}
            <motion.div
              className="absolute inset-x-0 top-0 bottom-0"
              style={{
                backgroundImage: "repeating-linear-gradient(to bottom, hsl(145 63% 42% / 0.3) 0px, hsl(145 63% 42% / 0.3) 8px, transparent 8px, transparent 18px)",
              }}
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : {}}
              transition={{ delay: 0.4, duration: 0.8 }}
            />
          </div>

          <div className="space-y-10">
            {steps.map((step, i) => {
              const delay = 0.3 + i * 0.12;
              return (
                <motion.div
                  key={step.number}
                  initial={{ opacity: 0, x: 20 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay, duration: 0.5 }}
                  className="relative flex items-start gap-5 pl-0"
                  style={{ zIndex: 1 }}
                >
                  {/* Badge on the vertical line */}
                  <div className="flex-shrink-0 relative" style={{ width: 64 }}>
                    <StepBadge number={step.number} delay={delay + 0.1} isInView={isInView} />
                  </div>

                  {/* Card content */}
                  <div className="flex-1 pt-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-10 w-10 rounded-xl gradient-titan flex items-center justify-center shadow-md flex-shrink-0">
                        <step.icon className="h-4 w-4 text-white" />
                      </div>
                      <h3 className="font-display text-sm font-semibold" style={{ color: "hsl(var(--landing-fg))" }}>{step.title}</h3>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: "hsl(var(--landing-fg-muted))", opacity: 0.7 }}>{step.description}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

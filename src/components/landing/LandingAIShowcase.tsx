import { useRef, useState, useEffect } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { Bot, User, CheckCircle2, Sparkles } from "lucide-react";

const chatSequence = [
  { role: "user" as const, text: "Create a leadership summit in Cairo for 200 attendees", delay: 0 },
  { role: "ai" as const, text: "Creating your event…", delay: 1.2 },
  { role: "status" as const, items: [
    { label: "Event created", delay: 2.0 },
    { label: "Venue: JW Marriott Cairo", delay: 2.6 },
    { label: "Hero image generated", delay: 3.2 },
    { label: "2-day agenda drafted", delay: 3.8 },
  ]},
  { role: "user" as const, text: "Send confirmation to all attendees via WhatsApp and email", delay: 5.0 },
  { role: "ai" as const, text: "Sending attendance confirmation to 200 attendees…", delay: 6.2 },
  { role: "status" as const, items: [
    { label: "WhatsApp: 200 sent", delay: 7.0 },
    { label: "Email: 200 sent", delay: 7.4 },
    { label: "148 confirmed · 52 pending", delay: 8.2 },
  ]},
];

const previewSteps = [
  { label: "Leadership Summit 2026", sub: "Cairo, Egypt · Oct 15–16", progress: 0 },
  { label: "Venue Selected", sub: "JW Marriott Hotel Cairo", progress: 25 },
  { label: "Hero Image Set", sub: "AI-generated premium visual", progress: 50 },
  { label: "Agenda Ready", sub: "12 sessions · 2 days", progress: 75 },
  { label: "Attendees Contacted", sub: "148 confirmed · 74% rate", progress: 100 },
];

export const LandingAIShowcase = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const timers = [2.0, 3.8, 5.0, 7.0, 8.5].map((t, i) =>
      setTimeout(() => setActiveStep(i), t * 1000)
    );
    return () => timers.forEach(clearTimeout);
  }, [isInView]);

  return (
    <section id="ai-builder" className="py-24 bg-[hsl(var(--landing-bg-alt))] overflow-hidden" ref={ref}>
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-4"
        >
          <span className="text-sm font-semibold text-[hsl(var(--titan-green))] tracking-wide uppercase">AI Builder</span>
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.1 }}
          className="font-display text-3xl font-bold md:text-4xl text-center mb-4"
        >
          Describe your event. AI builds it.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.2 }}
          className="mx-auto max-w-2xl text-center text-[hsl(var(--landing-fg-muted))] mb-14"
        >
          From creation to communication — one conversation handles everything.
        </motion.p>

        <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto items-start">
          {/* Chat Panel */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="glass-card-landing rounded-xl border border-[hsl(var(--landing-border)/0.3)] p-5 min-h-[420px] flex flex-col"
          >
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[hsl(var(--landing-border)/0.2)]">
              <div className="h-8 w-8 rounded-lg gradient-titan flex items-center justify-center">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[hsl(var(--landing-fg))]">AI Builder</p>
                <p className="text-[10px] text-[hsl(var(--landing-fg-muted)/0.6)]">TitanMeet Assistant</p>
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[hsl(var(--titan-green))] animate-pulse" />
                <span className="text-[10px] text-[hsl(var(--titan-green))]">Live</span>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-hidden">
              {chatSequence.map((msg, i) => {
                if (msg.role === "status") {
                  return (
                    <div key={i} className="space-y-1.5 pl-4">
                      {msg.items!.map((item, j) => (
                        <motion.div
                          key={j}
                          initial={{ opacity: 0, x: -10 }}
                          animate={isInView ? { opacity: 1, x: 0 } : {}}
                          transition={{ delay: item.delay }}
                          className="flex items-center gap-2"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--titan-green))]" />
                          <span className="text-xs text-[hsl(var(--landing-fg)/0.7)]">{item.label}</span>
                        </motion.div>
                      ))}
                    </div>
                  );
                }

                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: msg.delay }}
                    className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "ai" && (
                      <div className="h-6 w-6 rounded-full bg-[hsl(var(--titan-green)/0.15)] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Sparkles className="h-3 w-3 text-[hsl(var(--titan-green))]" />
                      </div>
                    )}
                    <div className={`max-w-[80%] rounded-lg px-3 py-2 ${
                      msg.role === "user"
                        ? "bg-[hsl(var(--titan-green)/0.1)] border border-[hsl(var(--titan-green)/0.2)]"
                        : "bg-[hsl(var(--landing-fg)/0.05)] border border-[hsl(var(--landing-border)/0.2)]"
                    }`}>
                      <p className="text-xs text-[hsl(var(--landing-fg)/0.8)]">{msg.text}</p>
                    </div>
                    {msg.role === "user" && (
                      <div className="h-6 w-6 rounded-full bg-[hsl(var(--titan-blue)/0.15)] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <User className="h-3 w-3 text-[hsl(var(--titan-blue))]" />
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* Preview Panel */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="glass-card-landing rounded-xl border border-[hsl(var(--landing-border)/0.3)] p-5 min-h-[420px] flex flex-col"
          >
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[hsl(var(--landing-border)/0.2)]">
              <span className="text-sm font-semibold text-[hsl(var(--landing-fg))]">Event Status</span>
              <span className="ml-auto text-[10px] bg-[hsl(var(--titan-green)/0.15)] text-[hsl(var(--titan-green))] px-2 py-0.5 rounded-full font-medium">
                Building…
              </span>
            </div>

            <div className="flex-1 space-y-4">
              <AnimatePresence mode="wait">
                {previewSteps.map((step, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0.3 }}
                    animate={{ opacity: i <= activeStep ? 1 : 0.3 }}
                    transition={{ duration: 0.4 }}
                    className="flex items-start gap-3"
                  >
                    <div className={`mt-1 h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-300 ${
                      i <= activeStep
                        ? "bg-[hsl(var(--titan-green)/0.2)]"
                        : "bg-[hsl(var(--landing-fg)/0.06)]"
                    }`}>
                      {i <= activeStep ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--titan-green))]" />
                      ) : (
                        <div className="h-2 w-2 rounded-full bg-[hsl(var(--landing-fg)/0.2)]" />
                      )}
                    </div>
                    <div>
                      <p className={`text-sm font-medium transition-colors duration-300 ${
                        i <= activeStep ? "text-[hsl(var(--landing-fg))]" : "text-[hsl(var(--landing-fg)/0.4)]"
                      }`}>{step.label}</p>
                      <p className="text-[11px] text-[hsl(var(--landing-fg-muted)/0.6)]">{step.sub}</p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Progress bar */}
              <div className="mt-auto pt-4">
                <div className="flex justify-between text-[10px] text-[hsl(var(--landing-fg-muted)/0.5)] mb-1">
                  <span>Event Readiness</span>
                  <span>{previewSteps[activeStep]?.progress ?? 0}%</span>
                </div>
                <div className="h-2 rounded-full bg-[hsl(var(--landing-fg)/0.06)] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full gradient-titan"
                    initial={{ width: "0%" }}
                    animate={{ width: `${previewSteps[activeStep]?.progress ?? 0}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

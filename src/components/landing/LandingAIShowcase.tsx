import { useRef, useState, useEffect, useCallback } from "react";
import { motion, useInView, useReducedMotion, AnimatePresence } from "framer-motion";
import { TypingIndicator } from "@/components/ui/typing-indicator";
import {
  Bot,
  User,
  Sparkles,
  CheckCircle2,
  Image,
  MessageSquare,
  Mail,
  BarChart3,
  MapPin,
  Calendar,
  Users,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

interface ChatMsg {
  role: "user" | "ai";
  text: string;
  /** Seconds after stage starts */
  offset: number;
}

interface PreviewSlice {
  title?: string;
  date?: string;
  location?: string;
  heroVisible?: boolean;
  comms?: { whatsapp: number; email: number };
  analytics?: { confirmed: number; pending: number; rate: string };
}

interface Stage {
  chat: ChatMsg[];
  preview: PreviewSlice;
  /** Total duration of this stage in seconds */
  duration: number;
}

const STAGES: Stage[] = [
  {
    chat: [
      { role: "user", text: "Create a leadership summit in Cairo for 150 attendees", offset: 0.3 },
      { role: "ai", text: "Done — I created a draft event and set the basics.", offset: 1.4 },
    ],
    preview: { title: "Leadership Summit 2026", date: "Oct 15 – 16, 2026", location: "Cairo, Egypt" },
    duration: 4,
  },
  {
    chat: [
      { role: "user", text: "Generate a premium hero image", offset: 0.3 },
      { role: "ai", text: "I generated 3 options. I selected one for preview.", offset: 1.6 },
    ],
    preview: { heroVisible: true },
    duration: 4,
  },
  {
    chat: [
      { role: "user", text: "Send confirmation through WhatsApp and email", offset: 0.3 },
      { role: "ai", text: "Sent. Tracking confirmations now.", offset: 1.6 },
    ],
    preview: { comms: { whatsapp: 150, email: 150 } },
    duration: 4,
  },
  {
    chat: [
      { role: "ai", text: "42 attendees confirmed. 106 still need a reminder.", offset: 0.6 },
    ],
    preview: { analytics: { confirmed: 42, pending: 106, rate: "28%" } },
    duration: 5,
  },
];

const TOTAL_CYCLE = STAGES.reduce((s, st) => s + st.duration, 0) + 2; // +2s pause

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

const ChatBubble = ({
  msg,
  visible,
  reducedMotion,
}: {
  msg: ChatMsg;
  visible: boolean;
  reducedMotion: boolean;
}) => {
  const isUser = msg.role === "user";
  return (
    <motion.div
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: reducedMotion ? 0 : 12 }}
      transition={{ duration: reducedMotion ? 0.15 : 0.4, ease: "easeOut" }}
      className={`flex items-end gap-2 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser && (
        <div className="h-7 w-7 rounded-full bg-[hsl(var(--titan-green)/0.15)] flex items-center justify-center flex-shrink-0">
          <Sparkles className="h-3.5 w-3.5 text-[hsl(var(--titan-green))]" />
        </div>
      )}
      <div
        className={`max-w-[82%] rounded-xl px-3.5 py-2.5 text-[13px] leading-snug ${
          isUser
            ? "bg-[hsl(var(--titan-blue)/0.12)] border border-[hsl(var(--titan-blue)/0.2)] text-[hsl(var(--landing-fg)/0.85)]"
            : "bg-[hsl(var(--landing-fg)/0.05)] border border-[hsl(var(--landing-border)/0.25)] text-[hsl(var(--landing-fg)/0.8)]"
        }`}
      >
        {msg.text}
      </div>
      {isUser && (
        <div className="h-7 w-7 rounded-full bg-[hsl(var(--titan-blue)/0.12)] flex items-center justify-center flex-shrink-0">
          <User className="h-3.5 w-3.5 text-[hsl(var(--titan-blue))]" />
        </div>
      )}
    </motion.div>
  );
};

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export const LandingAIShowcase = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: false, margin: "-120px" });
  const reducedMotion = !!useReducedMotion();

  const [stageIdx, setStageIdx] = useState(0);
  const [visibleMsgs, setVisibleMsgs] = useState<Set<number>>(new Set());
  const [showTyping, setShowTyping] = useState(false);
  // Accumulated preview state across stages
  const [preview, setPreview] = useState<PreviewSlice>({});

  const advanceStage = useCallback(
    (idx: number) => {
      const stage = STAGES[idx];
      if (!stage) return;

      // Merge preview slice
      setPreview((prev) => ({ ...prev, ...stage.preview }));

      // Reveal chat messages with stagger, show typing before AI replies
      stage.chat.forEach((msg, mi) => {
        const delay = reducedMotion ? 0 : msg.offset * 1000;
        // Show typing indicator before AI messages
        if (msg.role === "ai" && !reducedMotion) {
          const typingDelay = Math.max(0, delay - 600);
          setTimeout(() => setShowTyping(true), typingDelay);
        }
        setTimeout(() => {
          if (msg.role === "ai") setShowTyping(false);
          setVisibleMsgs((prev) => new Set(prev).add(idx * 10 + mi));
        }, delay);
      });
    },
    [reducedMotion],
  );

  // Cycle loop
  useEffect(() => {
    if (!isInView) return;

    let cancelled = false;
    let timeouts: ReturnType<typeof setTimeout>[] = [];

    const runCycle = () => {
      if (cancelled) return;
      setStageIdx(0);
      setVisibleMsgs(new Set());
      setShowTyping(false);
      setPreview({});

      let elapsed = 0;
      STAGES.forEach((stage, idx) => {
        const t = setTimeout(() => {
          if (cancelled) return;
          setStageIdx(idx);
          advanceStage(idx);
        }, elapsed * 1000);
        timeouts.push(t);
        elapsed += stage.duration;
      });

      // Reset after full cycle
      const resetT = setTimeout(() => {
        if (!cancelled) runCycle();
      }, TOTAL_CYCLE * 1000);
      timeouts.push(resetT);
    };

    runCycle();
    return () => {
      cancelled = true;
      timeouts.forEach(clearTimeout);
    };
  }, [isInView, advanceStage]);

  const stage = STAGES[stageIdx];

  return (
    <section
      id="ai-builder"
      ref={sectionRef}
      className="py-24 md:py-32 bg-[hsl(var(--landing-bg-alt))] overflow-hidden"
    >
      <div className="container">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-4"
        >
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[hsl(var(--titan-green))] tracking-wide uppercase">
            <Bot className="h-4 w-4" /> AI Builder
          </span>
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.1 }}
          className="font-display text-3xl font-bold md:text-5xl text-center mb-4"
        >
          Describe your event.{" "}
          <span className="gradient-titan-text">AI builds it.</span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.2 }}
          className="mx-auto max-w-xl text-center text-[hsl(var(--landing-fg-muted))] mb-16"
        >
          From creation to communication — one conversation handles everything.
        </motion.p>

        {/* Two-panel demo */}
        <div className="grid lg:grid-cols-2 gap-6 max-w-6xl mx-auto items-stretch">
          {/* ====== LEFT: Chat ====== */}
          <motion.div
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="glass-card-landing rounded-2xl border border-[hsl(var(--landing-border)/0.3)] flex flex-col min-h-[480px]"
          >
            {/* Chrome bar */}
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[hsl(var(--landing-border)/0.2)]">
              <div className="h-8 w-8 rounded-lg gradient-titan flex items-center justify-center">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[hsl(var(--landing-fg))]">AI Builder</p>
                <p className="text-[10px] text-[hsl(var(--landing-fg-muted)/0.5)] truncate">
                  TitanMeet Assistant
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[hsl(var(--titan-green))] animate-pulse" />
                <span className="text-[10px] font-medium text-[hsl(var(--titan-green))]">Live</span>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 px-5 py-4 space-y-3 overflow-hidden">
              {STAGES.slice(0, stageIdx + 1).flatMap((st, si) =>
                st.chat.map((msg, mi) => (
                  <ChatBubble
                    key={`${si}-${mi}`}
                    msg={msg}
                    visible={visibleMsgs.has(si * 10 + mi)}
                    reducedMotion={reducedMotion}
                  />
                )),
              )}
              <AnimatePresence>
                {showTyping && (
                  <div className="flex items-end gap-2 justify-start">
                    <div className="h-7 w-7 rounded-full bg-[hsl(var(--titan-green)/0.15)] flex items-center justify-center flex-shrink-0">
                      <Sparkles className="h-3.5 w-3.5 text-[hsl(var(--titan-green))]" />
                    </div>
                    <TypingIndicator />
                  </div>
                )}
              </AnimatePresence>
            </div>

            {/* Fake input */}
            <div className="px-5 pb-4">
              <div className="rounded-xl bg-[hsl(var(--landing-fg)/0.04)] border border-[hsl(var(--landing-border)/0.2)] px-4 py-2.5 text-xs text-[hsl(var(--landing-fg-muted)/0.4)] flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5" />
                Type a message…
              </div>
            </div>
          </motion.div>

          {/* ====== RIGHT: Preview ====== */}
          <motion.div
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="glass-card-landing rounded-2xl border border-[hsl(var(--landing-border)/0.3)] flex flex-col min-h-[480px]"
          >
            {/* Chrome bar */}
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[hsl(var(--landing-border)/0.2)]">
              <span className="text-sm font-semibold text-[hsl(var(--landing-fg))]">
                Event Preview
              </span>
              <motion.span
                key={stageIdx}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="ml-auto text-[10px] font-medium px-2.5 py-0.5 rounded-full bg-[hsl(var(--titan-green)/0.12)] text-[hsl(var(--titan-green))]"
              >
                {stageIdx < 3 ? "Building…" : "Ready"}
              </motion.span>
            </div>

            <div className="flex-1 px-5 py-5 space-y-5 overflow-hidden">
              {/* Event basics */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: preview.title ? 1 : 0.15 }}
                transition={{ duration: 0.5 }}
              >
                <p className="font-display text-lg font-bold text-[hsl(var(--landing-fg))]">
                  {preview.title || "Event Title"}
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-[hsl(var(--landing-fg-muted)/0.7)]">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {preview.date || "—"}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {preview.location || "—"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    150 attendees
                  </span>
                </div>
              </motion.div>

              {/* Hero image placeholder */}
              <motion.div
                initial={{ opacity: 0, scale: 0.97, filter: "blur(8px)" }}
                animate={{
                  opacity: preview.heroVisible ? 1 : 0.12,
                  scale: preview.heroVisible ? 1 : 0.97,
                  filter: preview.heroVisible ? "blur(0px)" : "blur(8px)",
                }}
                transition={{ duration: reducedMotion ? 0.2 : 0.7, ease: "easeOut" }}
                className="rounded-xl overflow-hidden border border-[hsl(var(--landing-border)/0.2)]"
              >
                <div className="aspect-[16/7] bg-gradient-to-br from-[hsl(var(--titan-green)/0.15)] via-[hsl(var(--titan-blue)/0.1)] to-[hsl(var(--landing-fg)/0.04)] flex items-center justify-center relative">
                  <Image
                    className={`h-8 w-8 transition-colors duration-500 ${
                      preview.heroVisible
                        ? "text-[hsl(var(--titan-green)/0.6)]"
                        : "text-[hsl(var(--landing-fg)/0.15)]"
                    }`}
                  />
                  {preview.heroVisible && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute bottom-2 right-2 text-[9px] px-2 py-0.5 rounded-full bg-[hsl(var(--titan-green)/0.2)] text-[hsl(var(--titan-green))] font-medium"
                    >
                      AI Generated
                    </motion.div>
                  )}
                </div>
              </motion.div>

              {/* Communication counters */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{
                  opacity: preview.comms ? 1 : 0.12,
                  y: preview.comms ? 0 : 8,
                }}
                transition={{ duration: 0.5 }}
                className="grid grid-cols-2 gap-3"
              >
                <div className="rounded-lg bg-[hsl(var(--landing-fg)/0.04)] border border-[hsl(var(--landing-border)/0.15)] p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <MessageSquare className="h-3.5 w-3.5 text-[hsl(var(--titan-green))]" />
                    <span className="text-[10px] text-[hsl(var(--landing-fg-muted)/0.6)]">
                      WhatsApp
                    </span>
                  </div>
                  <p className="font-display text-xl font-bold text-[hsl(var(--landing-fg))]">
                    {preview.comms?.whatsapp ?? "—"}
                  </p>
                  <p className="text-[9px] text-[hsl(var(--landing-fg-muted)/0.5)]">sent</p>
                </div>
                <div className="rounded-lg bg-[hsl(var(--landing-fg)/0.04)] border border-[hsl(var(--landing-border)/0.15)] p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Mail className="h-3.5 w-3.5 text-[hsl(var(--titan-blue))]" />
                    <span className="text-[10px] text-[hsl(var(--landing-fg-muted)/0.6)]">Email</span>
                  </div>
                  <p className="font-display text-xl font-bold text-[hsl(var(--landing-fg))]">
                    {preview.comms?.email ?? "—"}
                  </p>
                  <p className="text-[9px] text-[hsl(var(--landing-fg-muted)/0.5)]">sent</p>
                </div>
              </motion.div>

              {/* Analytics summary */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{
                  opacity: preview.analytics ? 1 : 0.08,
                  y: preview.analytics ? 0 : 8,
                }}
                transition={{ duration: 0.5 }}
                className="rounded-lg bg-[hsl(var(--landing-fg)/0.04)] border border-[hsl(var(--landing-border)/0.15)] p-3"
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <BarChart3 className="h-3.5 w-3.5 text-[hsl(var(--titan-green))]" />
                  <span className="text-[10px] font-medium text-[hsl(var(--landing-fg-muted)/0.6)]">
                    Confirmation Status
                  </span>
                </div>
                <div className="flex items-baseline gap-4">
                  <div>
                    <span className="font-display text-xl font-bold text-[hsl(var(--titan-green))]">
                      {preview.analytics?.confirmed ?? "—"}
                    </span>
                    <span className="text-[10px] text-[hsl(var(--landing-fg-muted)/0.5)] ml-1">
                      confirmed
                    </span>
                  </div>
                  <div>
                    <span className="font-display text-xl font-bold text-[hsl(var(--landing-fg)/0.6)]">
                      {preview.analytics?.pending ?? "—"}
                    </span>
                    <span className="text-[10px] text-[hsl(var(--landing-fg-muted)/0.5)] ml-1">
                      pending
                    </span>
                  </div>
                </div>
                {preview.analytics && (
                  <div className="mt-2 h-1.5 rounded-full bg-[hsl(var(--landing-fg)/0.06)] overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: preview.analytics.rate }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="h-full rounded-full gradient-titan"
                    />
                  </div>
                )}
              </motion.div>
            </div>
          </motion.div>
        </div>

        {/* Stage dots */}
        <div className="flex items-center justify-center gap-2 mt-8">
          {STAGES.map((_, i) => (
            <motion.div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === stageIdx
                  ? "w-6 gradient-titan"
                  : i < stageIdx
                    ? "w-1.5 bg-[hsl(var(--titan-green)/0.4)]"
                    : "w-1.5 bg-[hsl(var(--landing-fg)/0.12)]"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

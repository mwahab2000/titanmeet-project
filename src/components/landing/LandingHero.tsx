import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Bot, ArrowRight } from "lucide-react";

export const LandingHero = () => {
  return (
    <section className="relative flex min-h-[90vh] items-center pt-16 overflow-hidden">
      {/* Animated gradient mesh */}
      <div className="absolute inset-0">
        <motion.div
          className="absolute -top-40 right-1/4 h-[600px] w-[600px] rounded-full bg-[hsl(var(--titan-green)/var(--landing-glow-opacity))] blur-[140px]"
          animate={{ x: [0, 40, -20, 0], y: [0, -30, 20, 0], scale: [1, 1.1, 0.95, 1] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-40 left-1/4 h-[600px] w-[600px] rounded-full bg-[hsl(var(--titan-blue)/var(--landing-glow-opacity))] blur-[140px]"
          animate={{ x: [0, -30, 20, 0], y: [0, 40, -20, 0], scale: [1, 0.95, 1.1, 1] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-1/3 left-1/2 h-[400px] w-[400px] rounded-full bg-[hsl(var(--titan-green)/calc(var(--landing-glow-opacity)*0.5))] blur-[120px]"
          animate={{ x: [0, 60, -40, 0], y: [0, -50, 30, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="container relative z-10">
        <div className="mx-auto max-w-3xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--landing-border)/0.3)] bg-[hsl(var(--landing-fg)/0.05)] px-4 py-1.5 text-sm text-[hsl(var(--landing-fg-muted))]"
          >
            <Bot className="h-4 w-4 text-[hsl(var(--titan-green))]" />
            AI-Powered Event Platform
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="mb-6 font-display text-5xl font-bold leading-tight tracking-tight md:text-7xl"
          >
            Run High-Performance{" "}
            <span className="gradient-titan-text">Events with AI</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mb-8 text-lg text-[hsl(var(--landing-fg-muted))] md:text-xl max-w-2xl mx-auto"
          >
            Create, manage, and optimize your events with AI Builder, automated WhatsApp & email communication, and real-time analytics — all in one platform.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Button size="lg" className="gradient-titan border-0 text-white px-8 text-base font-semibold" asChild>
              <Link to="/login?tab=signup">
                Start Your First Event <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-[hsl(var(--landing-border)/0.4)] bg-transparent text-[hsl(var(--landing-fg))] hover:bg-[hsl(var(--landing-fg)/0.1)] px-8 text-base"
              asChild
            >
              <a href="#ai-builder">See How It Works</a>
            </Button>
          </motion.div>
        </div>

        {/* Mini AI Builder preview */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.6 }}
          className="mt-16 mx-auto max-w-2xl"
        >
          <div className="glass-card-landing rounded-xl p-5 border border-[hsl(var(--landing-border)/0.3)]">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-3 w-3 rounded-full bg-destructive/60" />
              <div className="h-3 w-3 rounded-full bg-[hsl(var(--titan-green)/0.6)]" />
              <div className="h-3 w-3 rounded-full bg-[hsl(var(--titan-blue)/0.6)]" />
              <span className="ml-3 text-xs text-[hsl(var(--landing-fg-muted)/0.5)]">AI Builder</span>
            </div>
            <div className="space-y-2">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1 }}
                className="ml-auto max-w-[70%] rounded-lg bg-[hsl(var(--titan-green)/0.1)] border border-[hsl(var(--titan-green)/0.2)] px-3 py-2"
              >
                <p className="text-xs text-[hsl(var(--landing-fg)/0.8)]">"Create a leadership summit for 200 attendees in Cairo"</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.4 }}
                className="mr-auto max-w-[80%] rounded-lg bg-[hsl(var(--landing-fg)/0.05)] border border-[hsl(var(--landing-border)/0.2)] px-3 py-2"
              >
                <p className="text-xs text-[hsl(var(--landing-fg)/0.7)]">
                  ✓ Event created · ✓ Venue suggested · ✓ Hero image generated · ✓ Agenda drafted
                </p>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

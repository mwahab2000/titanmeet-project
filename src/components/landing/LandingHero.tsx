import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export const LandingHero = () => (
  <section className="relative flex min-h-screen items-center pt-16 overflow-hidden">
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
          <span className="h-2 w-2 rounded-full bg-[hsl(var(--titan-green))]" />
          V2.0 is now live
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="mb-6 font-display text-5xl font-bold leading-tight tracking-tight md:text-7xl"
        >
          Build premium event sites{" "}
          <span className="gradient-titan-text">in minutes.</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mb-8 text-lg text-[hsl(var(--landing-fg-muted))] md:text-xl max-w-2xl mx-auto"
        >
          The all-in-one multi-tenant platform for event managers. Manage workspaces, RSVPs, surveys, and high-quality media assets from a single centralized dashboard.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <Button size="lg" className="gradient-titan border-0 text-white px-8 text-base font-semibold" asChild>
            <Link to="/login?tab=signup">Get Started Free <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
          <Button size="lg" variant="outline" className="border-[hsl(var(--landing-border)/0.4)] bg-transparent text-[hsl(var(--landing-fg))] hover:bg-[hsl(var(--landing-fg)/0.1)] px-8 text-base" asChild>
            <a href="#features">View Demo</a>
          </Button>
        </motion.div>
      </div>

      {/* Animated Dashboard Mockup */}
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.6 }}
        className="mt-16 mx-auto max-w-4xl"
      >
        <div className="glass-card-landing rounded-xl p-6 border border-[hsl(var(--landing-border)/0.3)]">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-3 w-3 rounded-full bg-destructive/60" />
            <div className="h-3 w-3 rounded-full bg-[hsl(var(--titan-green)/0.6)]" />
            <div className="h-3 w-3 rounded-full bg-[hsl(var(--titan-blue)/0.6)]" />
            <span className="ml-4 text-xs text-[hsl(var(--landing-fg-muted)/0.6)]">titanmeet.io/admin/workspace-alpha</span>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-1 space-y-3">
              {["Dashboard", "Events", "Attendees", "Settings"].map((item, i) => (
                <motion.div
                  key={item}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1 + i * 0.1 }}
                  className="h-8 rounded-lg bg-[hsl(var(--landing-fg)/0.06)] flex items-center px-3 text-xs text-[hsl(var(--landing-fg-muted)/0.6)]"
                >
                  {item}
                </motion.div>
              ))}
            </div>
            <div className="col-span-3 space-y-3">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }}
                className="h-8 rounded-lg bg-[hsl(var(--landing-fg)/0.06)]"
              />
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Total Events", value: "24", color: "" },
                  { label: "RSVPs Today", value: "189", color: "" },
                  { label: "Confirmed", value: "92%", color: "bg-[hsl(var(--titan-green)/0.1)] border border-[hsl(var(--titan-green)/0.2)]" },
                ].map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.3 + i * 0.15 }}
                    className={`h-24 rounded-lg ${stat.color || "bg-[hsl(var(--landing-fg)/0.06)]"} flex flex-col justify-center px-4`}
                  >
                    <span className="text-xs text-[hsl(var(--landing-fg-muted)/0.5)]">{stat.label}</span>
                    <span className="text-lg font-display font-bold text-[hsl(var(--landing-fg)/0.8)]">{stat.value}</span>
                  </motion.div>
                ))}
              </div>
              {/* Animated chart bars */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.7 }}
                className="h-32 rounded-lg bg-[hsl(var(--landing-fg)/0.06)] p-4 flex items-end gap-2"
              >
                {[40, 65, 45, 80, 55, 90, 70, 85, 60, 75, 95, 50].map((h, i) => (
                  <motion.div
                    key={i}
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%` }}
                    transition={{ delay: 1.9 + i * 0.05, duration: 0.5, ease: "easeOut" }}
                    className="flex-1 rounded-t bg-gradient-to-t from-[hsl(var(--titan-green)/0.3)] to-[hsl(var(--titan-blue)/0.3)]"
                  />
                ))}
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  </section>
);

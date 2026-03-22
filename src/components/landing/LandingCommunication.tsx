import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { MessageSquare, Mail, Users, Bell } from "lucide-react";

const channels = [
  { icon: MessageSquare, label: "WhatsApp", desc: "Template-based messaging with delivery tracking", color: "hsl(145, 63%, 42%)" },
  { icon: Mail, label: "Email", desc: "Branded invitations with open & click tracking", color: "hsl(210, 70%, 50%)" },
];

const capabilities = [
  { icon: Users, label: "Audience Segmentation", desc: "Target confirmed, pending, or no-show groups" },
  { icon: Bell, label: "Smart Reminders", desc: "Automated follow-ups to boost attendance" },
];

export const LandingCommunication = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="py-24 bg-[hsl(var(--landing-bg-alt))]" ref={ref}>
      <div className="container max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="mb-4 text-center"
        >
          <span className="text-sm font-semibold text-[hsl(var(--titan-green))] tracking-wide uppercase">Communication</span>
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.1 }}
          className="font-display text-3xl font-bold md:text-4xl text-center mb-3"
        >
          Reach every attendee. Every channel.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.2 }}
          className="mx-auto max-w-xl text-center text-[hsl(var(--landing-fg-muted))] mb-12"
        >
          Unified WhatsApp and email campaigns with real-time delivery status.
        </motion.p>

        <div className="grid sm:grid-cols-2 gap-6">
          {channels.map((ch, i) => (
            <motion.div
              key={ch.label}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="glass-card-landing rounded-xl border border-[hsl(var(--landing-border)/0.3)] p-6"
            >
              <div className="h-10 w-10 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: `${ch.color}15` }}>
                <ch.icon className="h-5 w-5" style={{ color: ch.color }} />
              </div>
              <h3 className="font-display text-lg font-semibold mb-1 text-[hsl(var(--landing-fg))]">{ch.label}</h3>
              <p className="text-sm text-[hsl(var(--landing-fg-muted))]">{ch.desc}</p>
            </motion.div>
          ))}
          {capabilities.map((cap, i) => (
            <motion.div
              key={cap.label}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.5 + i * 0.1 }}
              className="glass-card-landing rounded-xl border border-[hsl(var(--landing-border)/0.3)] p-6"
            >
              <div className="h-10 w-10 rounded-lg bg-[hsl(var(--landing-fg)/0.06)] flex items-center justify-center mb-3">
                <cap.icon className="h-5 w-5 text-[hsl(var(--landing-fg-muted))]" />
              </div>
              <h3 className="font-display text-lg font-semibold mb-1 text-[hsl(var(--landing-fg))]">{cap.label}</h3>
              <p className="text-sm text-[hsl(var(--landing-fg-muted))]">{cap.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

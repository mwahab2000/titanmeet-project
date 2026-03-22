import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Shield, Lock, Server, FileCheck } from "lucide-react";

const trustPoints = [
  { icon: Shield, label: "Enterprise-grade security" },
  { icon: Lock, label: "Role-based access control" },
  { icon: Server, label: "Isolated client workspaces" },
  { icon: FileCheck, label: "Full audit logging" },
];

export const LandingTrust = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="py-16 bg-[hsl(var(--landing-bg))]" ref={ref}>
      <div className="container">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="text-center text-sm font-semibold text-[hsl(var(--landing-fg-muted)/0.5)] tracking-wide uppercase mb-8"
        >
          Built for enterprise-grade events
        </motion.p>
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-14">
          {trustPoints.map((t, i) => (
            <motion.div
              key={t.label}
              initial={{ opacity: 0, y: 15 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.1 + i * 0.1 }}
              className="flex items-center gap-2"
            >
              <t.icon className="h-4 w-4 text-[hsl(var(--titan-green)/0.7)]" />
              <span className="text-sm text-[hsl(var(--landing-fg-muted)/0.7)]">{t.label}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

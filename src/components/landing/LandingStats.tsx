import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Building2, ShieldCheck, MessageSquare, Globe } from "lucide-react";

const bullets = [
  { icon: Building2, label: "Multi-tenant workspaces" },
  { icon: ShieldCheck, label: "Audit logs + approvals" },
  { icon: MessageSquare, label: "WhatsApp / email tracking" },
  { icon: Globe, label: "Client subdomain publishing" },
];

export const LandingStats = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="py-20 bg-[hsl(var(--landing-bg))]" ref={ref}>
      <div className="container">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {bullets.map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.15, duration: 0.5 }}
              className="flex flex-col items-center text-center gap-3"
            >
              <div className="h-12 w-12 rounded-xl bg-[hsl(var(--titan-green)/0.1)] flex items-center justify-center">
                <item.icon className="h-6 w-6 text-[hsl(var(--titan-green))]" />
              </div>
              <span className="text-sm font-medium text-[hsl(var(--landing-fg-muted))]">{item.label}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

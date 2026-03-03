import { useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { Users, PanelLeft, QrCode, BarChart3, Image, Mail } from "lucide-react";

const features = [
  {
    icon: Users,
    title: "Clients Workspace",
    description: "Organize multiple clients into dedicated workspaces. Keep data, branding, and assets separate and secure.",
    detail: "Isolated multi-tenant architecture with per-client branding, asset libraries, and permission management.",
  },
  {
    icon: PanelLeft,
    title: "Sidebar Editor",
    description: "Intuitive drag-and-drop site builder that lives in your sidebar. Live preview your changes instantly.",
    detail: "Real-time visual editing with section-level controls for hero, agenda, speakers, venue, gallery, and more.",
  },
  {
    icon: QrCode,
    title: "RSVP Tracking",
    description: "Real-time attendance tracking with QR code check-ins and automatic confirmation emails.",
    detail: "Generate unique QR codes per attendee, scan at entry, and see live check-in dashboards with analytics.",
  },
  {
    icon: BarChart3,
    title: "Surveys & Analytics",
    description: "Post-event feedback collection with automated sentiment analysis and visual report generation.",
    detail: "Build custom surveys, collect responses in real-time, and generate exportable reports with charts.",
  },
  {
    icon: Image,
    title: "Media Gallery",
    description: "Optimized media library for event photos and videos. Fast delivery via our global CDN.",
    detail: "Upload, organize, and serve high-resolution images with automatic compression and lazy loading.",
  },
  {
    icon: Mail,
    title: "Email Health",
    description: "Monitor your deliverability scores. Get alerts for bounces and maintain a high sender reputation.",
    detail: "Track open rates, bounces, and complaints. Automated warm-up and domain reputation monitoring.",
  },
];

export const LandingFeatures = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <section id="features" className="py-24 bg-[hsl(var(--landing-bg-alt))]" ref={ref}>
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="mb-4 text-center"
        >
          <span className="text-sm font-semibold text-[hsl(var(--titan-green))] tracking-wide uppercase">Features</span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-4 text-center"
        >
          <h2 className="font-display text-3xl font-bold md:text-4xl">Enterprise features for everyone</h2>
        </motion.div>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mx-auto max-w-2xl text-center text-[hsl(var(--landing-fg-muted))] mb-16"
        >
          Scaling your event management business requires tools that handle the complexity so you can focus on the experience.
        </motion.p>

        {/* Interactive feature showcase: tabs + detail */}
        <div className="grid gap-8 lg:grid-cols-5">
          {/* Tab list */}
          <div className="lg:col-span-2 space-y-3">
            {features.map((f, i) => (
              <motion.button
                key={f.title}
                initial={{ opacity: 0, x: -20 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.3 + i * 0.08 }}
                onClick={() => setActiveIndex(i)}
                className={`w-full flex items-start gap-4 rounded-xl p-4 text-left transition-all duration-300 border ${
                  activeIndex === i
                    ? "glass-card-landing border-[hsl(var(--titan-green)/0.4)] shadow-lg"
                    : "border-transparent hover:bg-[hsl(var(--landing-fg)/0.03)]"
                }`}
              >
                <div className={`mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors ${
                  activeIndex === i ? "bg-[hsl(var(--titan-green)/0.15)]" : "bg-[hsl(var(--landing-fg)/0.06)]"
                }`}>
                  <f.icon className={`h-5 w-5 transition-colors ${activeIndex === i ? "text-[hsl(var(--titan-green))]" : "text-[hsl(var(--landing-fg-muted))]"}`} />
                </div>
                <div>
                  <h3 className="font-display text-sm font-semibold">{f.title}</h3>
                  <p className="text-xs text-[hsl(var(--landing-fg-muted))] mt-0.5 line-clamp-2">{f.description}</p>
                </div>
              </motion.button>
            ))}
          </div>

          {/* Feature detail panel */}
          <div className="lg:col-span-3">
            <motion.div
              key={activeIndex}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="glass-card-landing rounded-xl border border-[hsl(var(--landing-border)/0.3)] p-8 h-full flex flex-col justify-center min-h-[360px]"
            >
              <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-[hsl(var(--titan-green)/0.1)]">
                {(() => { const Icon = features[activeIndex].icon; return <Icon className="h-7 w-7 text-[hsl(var(--titan-green))]" />; })()}
              </div>
              <h3 className="mb-3 font-display text-2xl font-bold">{features[activeIndex].title}</h3>
              <p className="text-[hsl(var(--landing-fg-muted))] mb-4 text-lg">{features[activeIndex].description}</p>
              <p className="text-sm text-[hsl(var(--landing-fg-muted)/0.7)] leading-relaxed">{features[activeIndex].detail}</p>

              {/* Decorative visual */}
              <div className="mt-8 rounded-lg bg-[hsl(var(--landing-fg)/0.04)] p-4 border border-[hsl(var(--landing-border)/0.2)]">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-2 w-2 rounded-full bg-[hsl(var(--titan-green))]" />
                  <div className="h-2 flex-1 rounded-full bg-[hsl(var(--landing-fg)/0.08)]">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "75%" }}
                      transition={{ delay: 0.3, duration: 0.8 }}
                      className="h-full rounded-full gradient-titan"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-[hsl(var(--titan-blue))]" />
                  <div className="h-2 flex-1 rounded-full bg-[hsl(var(--landing-fg)/0.08)]">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "60%" }}
                      transition={{ delay: 0.5, duration: 0.8 }}
                      className="h-full rounded-full bg-[hsl(var(--titan-blue))]"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

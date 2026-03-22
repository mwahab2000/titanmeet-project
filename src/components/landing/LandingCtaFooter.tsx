import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEMO_SITE_URL } from "@/config/pricing";
import logo from "@/assets/logo.png";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _Link = Link;

export const LandingCta = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="py-24" ref={ref}>
      <div className="container">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={isInView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-3xl rounded-2xl gradient-titan p-12 text-center"
        >
          <h2 className="mb-4 font-display text-3xl font-bold text-white">Run your next event with AI — not spreadsheets.</h2>
          <p className="mb-8 text-white/80">
            Create, communicate, and track attendance — all from one platform.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" className="bg-white text-[hsl(222,47%,11%)] hover:bg-white/90 px-8 font-semibold border-0" asChild>
              <Link to="/login?tab=signup">
                Create Your First Event
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 px-8" asChild>
              <a href={DEMO_SITE_URL} target="_blank" rel="noopener noreferrer">
                View Demo Site <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export const LandingFooter = () => (
  <footer className="border-t border-[hsl(var(--landing-border)/0.3)] py-16">
    <div className="container">
      <div className="grid gap-12 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <img src={logo} alt="TitanMeet" className="h-8 w-8" />
            <span className="font-display text-lg font-bold gradient-titan-text">TitanMeet</span>
          </div>
          <p className="text-sm text-[hsl(var(--landing-fg-muted))]">Event management for HR teams worldwide.</p>
        </div>
        {[
          { title: "Product", links: ["Features", "Roadmap", "Templates", "API"] },
          { title: "Company", links: ["About Us", "Blog", "Careers", "Contact"] },
          { title: "Legal", links: ["Privacy", "Terms", "Security"] },
        ].map((col) => (
          <div key={col.title}>
            <h4 className="font-display font-semibold mb-4">{col.title}</h4>
            <ul className="space-y-2">
              {col.links.map((link) => (
                <li key={link}>
                  <a href="#" className="text-sm text-[hsl(var(--landing-fg-muted)/0.7)] hover:text-[hsl(var(--landing-fg))] transition-colors">{link}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-[hsl(var(--landing-border)/0.3)] pt-8 sm:flex-row">
        <p className="text-xs text-[hsl(var(--landing-fg-muted)/0.6)]">© 2026 TitanMeet Inc. All rights reserved.</p>
        <div className="flex gap-4">
          <a href="#" className="text-[hsl(var(--landing-fg-muted)/0.6)] hover:text-[hsl(var(--landing-fg))] transition-colors text-sm">Twitter</a>
          <a href="#" className="text-[hsl(var(--landing-fg-muted)/0.6)] hover:text-[hsl(var(--landing-fg))] transition-colors text-sm">GitHub</a>
        </div>
      </div>
    </div>
  </footer>
);

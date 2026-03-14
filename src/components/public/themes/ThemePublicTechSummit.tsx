import { useEffect } from "react";
import type { PublicEventData } from "@/lib/publicSite/types";
import { TechSummitHero } from "./tech-summit/TechSummitHero";
import { TechSummitNav } from "./tech-summit/TechSummitNav";
import { TechSummitAgenda } from "./tech-summit/TechSummitAgenda";
import { TechSummitSpeakers } from "./tech-summit/TechSummitSpeakers";
import { TechSummitCountdown } from "./tech-summit/TechSummitCountdown";
import { TechSummitStats } from "./tech-summit/TechSummitStats";
import { TechSummitFooter } from "./tech-summit/TechSummitFooter";

import { PublicAnnouncementsTicker } from "../sections/PublicAnnouncementsTicker";
import { PublicAnnouncementsSection } from "../sections/PublicAnnouncementsSection";
import { PublicEventInfoSection } from "../sections/PublicEventInfoSection";
import { PublicVenueSection } from "../sections/PublicVenueSection";
import { PublicGallerySection } from "../sections/PublicGallerySection";
import { PublicOrganizersSection } from "../sections/PublicOrganizersSection";
import { PublicDressCodeSection } from "../sections/PublicDressCodeSection";
import { PublicTransportSection } from "../sections/PublicTransportSection";
import { PublicAttendeesSection } from "../sections/PublicAttendeesSection";

interface Props { data: PublicEventData; }

const FONT_ID = "tech-summit-fonts";
const STYLE_ID = "tech-summit-style";

const themeCSS = `
  .theme-tech-summit {
    background: #0E1420;
    color: #E2E8F0;
    font-family: 'Inter', system-ui, sans-serif;
  }
  .theme-tech-summit h1,
  .theme-tech-summit h2,
  .theme-tech-summit h3,
  .theme-tech-summit h4 {
    font-family: 'JetBrains Mono', monospace;
    font-weight: 700;
    color: #E2E8F0;
  }
  .theme-tech-summit section {
    background: #0E1420;
    border-color: rgba(0,212,255,0.1) !important;
  }
  .theme-tech-summit .ts-alt section,
  .theme-tech-summit .ts-alt {
    background: #111827 !important;
  }
  .theme-tech-summit p,
  .theme-tech-summit span,
  .theme-tech-summit li {
    color: rgba(226,232,240,0.7);
  }
  .theme-tech-summit .text-muted-foreground {
    color: rgba(226,232,240,0.5) !important;
  }
  .theme-tech-summit .text-foreground {
    color: #E2E8F0 !important;
  }
  .theme-tech-summit .bg-background {
    background: #0E1420 !important;
  }
  .theme-tech-summit .bg-card {
    background: #131D2E !important;
  }
  .theme-tech-summit .bg-muted,
  .theme-tech-summit .bg-muted\\/30,
  .theme-tech-summit .bg-muted\\/50 {
    background: rgba(0,212,255,0.05) !important;
  }
  .theme-tech-summit .border-border,
  .theme-tech-summit .border-border\\/30,
  .theme-tech-summit .border-border\\/40 {
    border-color: rgba(0,212,255,0.1) !important;
  }
  .theme-tech-summit .text-primary {
    color: #00D4FF !important;
  }
  .theme-tech-summit .bg-primary {
    background: #00D4FF !important;
  }
  .theme-tech-summit .bg-primary\\/10,
  .theme-tech-summit .bg-primary\\/5 {
    background: rgba(0,212,255,0.08) !important;
  }
  .theme-tech-summit .rounded-xl,
  .theme-tech-summit .rounded-lg {
    border-color: rgba(0,212,255,0.1);
    background: rgba(19,29,46,0.8);
    border-radius: 0 !important;
  }
`;

export const ThemePublicTechSummit: React.FC<Props> = ({ data }) => {
  useEffect(() => {
    if (!document.getElementById(FONT_ID)) {
      const link = document.createElement("link");
      link.id = FONT_ID;
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap";
      document.head.appendChild(link);
    }
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = themeCSS;
      document.head.appendChild(style);
    }
    return () => {
      document.getElementById(FONT_ID)?.remove();
      document.getElementById(STYLE_ID)?.remove();
    };
  }, []);

  return (
    <div className="theme-tech-summit min-h-screen">
      <TechSummitNav data={data} />
      <TechSummitHero data={data} />
      <PublicAnnouncementsTicker eventId={data.event.id} />
      <TechSummitCountdown data={data} />
      <PublicAnnouncementsSection data={data} />
      <TechSummitStats data={data} />
      <div className="ts-alt">
        <PublicEventInfoSection data={data} />
      </div>
      <TechSummitAgenda data={data} />
      <TechSummitSpeakers data={data} />
      <PublicVenueSection data={data} />
      <div className="ts-alt">
        <PublicGallerySection data={data} />
      </div>
      <PublicOrganizersSection data={data} />
      <div className="ts-alt">
        <PublicDressCodeSection data={data} />
      </div>
      <PublicTransportSection data={data} />
      <TechSummitFooter data={data} />
    </div>
  );
};

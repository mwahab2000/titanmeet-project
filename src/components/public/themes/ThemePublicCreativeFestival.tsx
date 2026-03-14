import { useEffect } from "react";
import type { PublicEventData } from "@/lib/publicSite/types";
import { FestivalHero } from "./creative-festival/FestivalHero";
import { FestivalNav } from "./creative-festival/FestivalNav";
import { FestivalAgenda } from "./creative-festival/FestivalAgenda";
import { FestivalSpeakers } from "./creative-festival/FestivalSpeakers";
import { FestivalCountdown } from "./creative-festival/FestivalCountdown";
import { FestivalStats } from "./creative-festival/FestivalStats";
import { FestivalFooter } from "./creative-festival/FestivalFooter";

import { PublicAnnouncementsTicker } from "../sections/PublicAnnouncementsTicker";
import { PublicAnnouncementsSection } from "../sections/PublicAnnouncementsSection";
import { PublicEventInfoSection } from "../sections/PublicEventInfoSection";
import { PublicVenueSection } from "../sections/PublicVenueSection";
import { PublicGallerySection } from "../sections/PublicGallerySection";
import { PublicOrganizersSection } from "../sections/PublicOrganizersSection";
import { PublicDressCodeSection } from "../sections/PublicDressCodeSection";
import { PublicTransportSection } from "../sections/PublicTransportSection";


interface Props { data: PublicEventData; }

const FONT_ID = "creative-festival-fonts";
const STYLE_ID = "creative-festival-style";

const themeCSS = `
  .theme-creative-festival {
    background: #FAFAFA;
    color: #0A0A0A;
    font-family: 'Cabinet Grotesk', 'Plus Jakarta Sans', system-ui, sans-serif;
  }
  .theme-creative-festival h1,
  .theme-creative-festival h2,
  .theme-creative-festival h3,
  .theme-creative-festival h4 {
    font-family: 'Cabinet Grotesk', 'Plus Jakarta Sans', system-ui, sans-serif;
    font-weight: 800;
    color: #0A0A0A;
  }
  .theme-creative-festival section {
    background: #FAFAFA;
  }
  .theme-creative-festival .cf-alt section,
  .theme-creative-festival .cf-alt {
    background: #F5F0FF !important;
  }
  .theme-creative-festival .text-muted-foreground {
    color: rgba(10,10,10,0.45) !important;
  }
  .theme-creative-festival .text-foreground {
    color: #0A0A0A !important;
  }
  .theme-creative-festival .bg-background {
    background: #FAFAFA !important;
  }
  .theme-creative-festival .bg-card {
    background: #FFFFFF !important;
  }
  .theme-creative-festival .bg-muted,
  .theme-creative-festival .bg-muted\\/30,
  .theme-creative-festival .bg-muted\\/50 {
    background: rgba(124,58,237,0.05) !important;
  }
  .theme-creative-festival .border-border,
  .theme-creative-festival .border-border\\/30,
  .theme-creative-festival .border-border\\/40 {
    border-color: rgba(0,0,0,0.08) !important;
  }
  .theme-creative-festival .text-primary {
    color: #7C3AED !important;
  }
  .theme-creative-festival .bg-primary {
    background: #7C3AED !important;
  }
  .theme-creative-festival .bg-primary\\/10,
  .theme-creative-festival .bg-primary\\/5 {
    background: rgba(124,58,237,0.08) !important;
  }
  .theme-creative-festival .rounded-xl {
    border-radius: 0 !important;
    border: 2px solid #0A0A0A !important;
  }
  .theme-creative-festival .rounded-lg {
    border-radius: 0 !important;
  }
  .theme-creative-festival [id="stats"] .text-3xl,
  .theme-creative-festival [id="stats"] .text-4xl,
  .theme-creative-festival [id="stats"] .text-5xl {
    color: #7C3AED !important;
  }
`;

export const ThemePublicCreativeFestival: React.FC<Props> = ({ data }) => {
  useEffect(() => {
    if (!document.getElementById(FONT_ID)) {
      const link = document.createElement("link");
      link.id = FONT_ID;
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;700;800&display=swap";
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
    <div className="theme-creative-festival min-h-screen">
      <FestivalNav data={data} />
      <FestivalHero data={data} />
      <PublicAnnouncementsTicker eventId={data.event.id} />
      <FestivalCountdown data={data} />
      <PublicAnnouncementsSection data={data} />
      <FestivalStats data={data} />
      <PublicEventInfoSection data={data} />
      <FestivalAgenda data={data} />
      <FestivalSpeakers data={data} />
      <PublicVenueSection data={data} />
      <div className="cf-alt">
        <PublicGallerySection data={data} />
      </div>
      <PublicOrganizersSection data={data} />
      <PublicAttendeesSection data={data} />
      <PublicDressCodeSection data={data} />
      <PublicTransportSection data={data} />
      <FestivalFooter data={data} />
    </div>
  );
};

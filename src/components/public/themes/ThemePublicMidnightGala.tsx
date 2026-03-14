import { useEffect } from "react";
import type { PublicEventData } from "@/lib/publicSite/types";
import { MidnightGalaHero } from "./midnight-gala/MidnightGalaHero";
import { MidnightGalaNav } from "./midnight-gala/MidnightGalaNav";
import { MidnightGalaAgenda } from "./midnight-gala/MidnightGalaAgenda";
import { MidnightGalaSpeakers } from "./midnight-gala/MidnightGalaSpeakers";
import { MidnightGalaCountdown } from "./midnight-gala/MidnightGalaCountdown";
import { MidnightGalaFooter } from "./midnight-gala/MidnightGalaFooter";

/* Reuse shared sections for content the custom components don't cover */
import { PublicAnnouncementsTicker } from "../sections/PublicAnnouncementsTicker";
import { PublicAnnouncementsSection } from "../sections/PublicAnnouncementsSection";
import { PublicEventInfoSection } from "../sections/PublicEventInfoSection";
import { PublicStatsSection } from "../sections/PublicStatsSection";
import { PublicVenueSection } from "../sections/PublicVenueSection";
import { PublicGallerySection } from "../sections/PublicGallerySection";
import { PublicOrganizersSection } from "../sections/PublicOrganizersSection";
import { PublicDressCodeSection } from "../sections/PublicDressCodeSection";
import { PublicTransportSection } from "../sections/PublicTransportSection";


interface Props { data: PublicEventData; }

const FONT_ID = "midnight-gala-fonts";
const STYLE_ID = "midnight-gala-style";

const themeCSS = `
  .theme-midnight-gala {
    background: #0D0D14;
    color: #E8E4DC;
    font-family: 'Lato', sans-serif;
    font-weight: 300;
  }

  .theme-midnight-gala h1,
  .theme-midnight-gala h2,
  .theme-midnight-gala h3,
  .theme-midnight-gala h4 {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-weight: 600;
    color: #E8E4DC;
  }

  /* Override shared section colors for dark theme */
  .theme-midnight-gala section {
    background: #0D0D14;
    border-color: rgba(201,168,76,0.12) !important;
  }
  .theme-midnight-gala .mg-alt-bg section,
  .theme-midnight-gala .mg-alt-bg {
    background: #111118 !important;
  }

  .theme-midnight-gala p,
  .theme-midnight-gala span,
  .theme-midnight-gala li {
    color: rgba(232,228,220,0.7);
  }

  .theme-midnight-gala .text-muted-foreground {
    color: rgba(232,228,220,0.5) !important;
  }
  .theme-midnight-gala .text-foreground {
    color: #E8E4DC !important;
  }
  .theme-midnight-gala .bg-background {
    background: #0D0D14 !important;
  }
  .theme-midnight-gala .bg-card {
    background: #111118 !important;
  }
  .theme-midnight-gala .bg-muted,
  .theme-midnight-gala .bg-muted\\/30,
  .theme-midnight-gala .bg-muted\\/50 {
    background: rgba(201,168,76,0.06) !important;
  }
  .theme-midnight-gala .border-border,
  .theme-midnight-gala .border-border\\/30,
  .theme-midnight-gala .border-border\\/40 {
    border-color: rgba(201,168,76,0.12) !important;
  }

  /* Gold accent for primary elements */
  .theme-midnight-gala .text-primary {
    color: #C9A84C !important;
  }
  .theme-midnight-gala .bg-primary {
    background: #C9A84C !important;
  }
  .theme-midnight-gala .bg-primary\\/10,
  .theme-midnight-gala .bg-primary\\/5 {
    background: rgba(201,168,76,0.1) !important;
  }

  /* Stat values gold */
  .theme-midnight-gala [id="stats"] .text-3xl,
  .theme-midnight-gala [id="stats"] .text-4xl {
    color: #C9A84C !important;
  }

  /* Cards */
  .theme-midnight-gala .rounded-xl,
  .theme-midnight-gala .rounded-lg {
    border-color: rgba(201,168,76,0.12);
    background: rgba(17,17,24,0.8);
  }
`;

export const ThemePublicMidnightGala: React.FC<Props> = ({ data }) => {
  useEffect(() => {
    if (!document.getElementById(FONT_ID)) {
      const link = document.createElement("link");
      link.id = FONT_ID;
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=Lato:wght@300;400&display=swap";
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
    <div className="theme-midnight-gala min-h-screen">
      <MidnightGalaNav data={data} />
      <MidnightGalaHero data={data} />
      <PublicAnnouncementsTicker eventId={data.event.id} />
      <MidnightGalaCountdown data={data} />
      <PublicAnnouncementsSection data={data} />
      <PublicStatsSection data={data} />
      <div className="mg-alt-bg">
        <PublicEventInfoSection data={data} />
      </div>
      <MidnightGalaAgenda data={data} />
      <MidnightGalaSpeakers data={data} />
      <PublicVenueSection data={data} />
      <div className="mg-alt-bg">
        <PublicGallerySection data={data} />
      </div>
      <PublicOrganizersSection data={data} />
      <PublicAttendeesSection data={data} />
      <div className="mg-alt-bg">
        <PublicDressCodeSection data={data} />
      </div>
      <PublicTransportSection data={data} />
      <MidnightGalaFooter data={data} />
    </div>
  );
};

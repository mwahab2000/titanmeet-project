import { useEffect } from "react";
import type { PublicEventData } from "@/lib/publicSite/types";
import { NatureWellnessHero } from "./nature-wellness/NatureWellnessHero";
import { NatureWellnessNav } from "./nature-wellness/NatureWellnessNav";
import { NatureWellnessAgenda } from "./nature-wellness/NatureWellnessAgenda";
import { NatureWellnessSpeakers } from "./nature-wellness/NatureWellnessSpeakers";
import { NatureWellnessCountdown } from "./nature-wellness/NatureWellnessCountdown";
import { NatureWellnessFooter } from "./nature-wellness/NatureWellnessFooter";

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

const FONT_ID = "nature-wellness-fonts";
const STYLE_ID = "nature-wellness-style";

const themeCSS = `
  .theme-nature-wellness {
    background: #FAF7F2;
    color: #1C2B1A;
    font-family: 'DM Sans', sans-serif;
    font-weight: 400;
  }
  .theme-nature-wellness h1,
  .theme-nature-wellness h2,
  .theme-nature-wellness h3,
  .theme-nature-wellness h4 {
    font-family: 'Fraunces', Georgia, serif;
    font-weight: 700;
    color: #1C2B1A;
  }
  .theme-nature-wellness section {
    background: #FAF7F2;
  }
  .theme-nature-wellness .nw-alt section,
  .theme-nature-wellness .nw-alt {
    background: #F0EBE3 !important;
  }
  .theme-nature-wellness .text-muted-foreground {
    color: rgba(28,43,26,0.5) !important;
  }
  .theme-nature-wellness .text-foreground {
    color: #1C2B1A !important;
  }
  .theme-nature-wellness .bg-background {
    background: #FAF7F2 !important;
  }
  .theme-nature-wellness .bg-card {
    background: #F0EBE3 !important;
  }
  .theme-nature-wellness .bg-muted,
  .theme-nature-wellness .bg-muted\\/30,
  .theme-nature-wellness .bg-muted\\/50 {
    background: rgba(45,106,79,0.05) !important;
  }
  .theme-nature-wellness .border-border,
  .theme-nature-wellness .border-border\\/30,
  .theme-nature-wellness .border-border\\/40 {
    border-color: #C8D8C0 !important;
  }
  .theme-nature-wellness .text-primary {
    color: #2D6A4F !important;
  }
  .theme-nature-wellness .bg-primary {
    background: #2D6A4F !important;
  }
  .theme-nature-wellness .bg-primary\\/10,
  .theme-nature-wellness .bg-primary\\/5 {
    background: rgba(45,106,79,0.08) !important;
  }
  .theme-nature-wellness .rounded-xl,
  .theme-nature-wellness .rounded-lg {
    border-radius: 1rem !important;
    border-color: #C8D8C0;
  }
  .theme-nature-wellness [id="stats"] .text-3xl,
  .theme-nature-wellness [id="stats"] .text-4xl,
  .theme-nature-wellness [id="stats"] .text-5xl {
    color: #2D6A4F !important;
  }
`;

export const ThemePublicNatureWellness: React.FC<Props> = ({ data }) => {
  useEffect(() => {
    if (!document.getElementById(FONT_ID)) {
      const link = document.createElement("link");
      link.id = FONT_ID;
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,700;1,400;1,600&family=DM+Sans:wght@300;400;500&display=swap";
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
    <div className="theme-nature-wellness min-h-screen">
      <NatureWellnessNav data={data} />
      <NatureWellnessHero data={data} />
      <PublicAnnouncementsTicker eventId={data.event.id} />
      <NatureWellnessCountdown data={data} />
      <PublicAnnouncementsSection data={data} />
      <PublicStatsSection data={data} />
      <div className="nw-alt">
        <PublicEventInfoSection data={data} />
      </div>
      <NatureWellnessAgenda data={data} />
      <NatureWellnessSpeakers data={data} />
      <PublicVenueSection data={data} />
      <div className="nw-alt">
        <PublicGallerySection data={data} />
      </div>
      <PublicOrganizersSection data={data} />
      <div className="nw-alt">
        <PublicDressCodeSection data={data} />
      </div>
      <PublicTransportSection data={data} />
      <NatureWellnessFooter data={data} />
    </div>
  );
};

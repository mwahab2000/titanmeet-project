import { useEffect } from "react";
import type { PublicEventData } from "@/lib/publicSite/types";
import { PublicHeroSection } from "../sections/PublicHeroSection";
import { PublicGallerySection } from "../sections/PublicGallerySection";
import { PublicEventInfoSection } from "../sections/PublicEventInfoSection";
import { PublicAnnouncementsSection } from "../sections/PublicAnnouncementsSection";
import { PublicAnnouncementsTicker } from "../sections/PublicAnnouncementsTicker";
import { PublicAgendaSection } from "../sections/PublicAgendaSection";
import { PublicSpeakersSection } from "../sections/PublicSpeakersSection";
import { PublicVenueSection } from "../sections/PublicVenueSection";
import { PublicOrganizersSection } from "../sections/PublicOrganizersSection";
import { PublicDressCodeSection } from "../sections/PublicDressCodeSection";
import { PublicTransportSection } from "../sections/PublicTransportSection";
import { PublicFooterSection } from "../sections/PublicFooterSection";
import { PublicStickyNav } from "../sections/PublicStickyNav";
import { PublicStatsSection } from "../sections/PublicStatsSection";
import { PublicCountdownSection } from "../sections/PublicCountdownSection";
import { PublicAttendeesSection } from "../sections/PublicAttendeesSection";

interface Props { data: PublicEventData; }

const THEME_STYLE_ID = "theme-elegant-style";
const FONT_LINK_ID = "theme-elegant-fonts";

const elegantCSS = `
  .theme-elegant {
    --elg-bg: #FAF8F4;
    --elg-text: #2C1810;
    --elg-accent: #8B6914;
    --elg-gold-light: #D4B896;
    --elg-cream: #F0EAE0;
    --elg-muted: #6B5C4F;

    background-color: var(--elg-bg);
    color: var(--elg-text);
    font-family: 'Lato', sans-serif;
    font-weight: 300;
  }

  /* Headings use Cormorant Garamond */
  .theme-elegant h1,
  .theme-elegant h2,
  .theme-elegant h3,
  .theme-elegant h4 {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-weight: 600;
    letter-spacing: 0.01em;
  }
  .theme-elegant h1 {
    font-weight: 700;
  }

  /* Section dividers: elegant double line */
  .theme-elegant .elg-section {
    border-top: 1px solid var(--elg-gold-light);
    position: relative;
  }
  .theme-elegant .elg-section::before {
    content: '';
    position: absolute;
    top: 3px;
    left: 0;
    right: 0;
    border-top: 1px solid var(--elg-gold-light);
  }

  /* Hero grain/noise overlay */
  .theme-elegant .elg-hero {
    position: relative;
  }
  .theme-elegant .elg-hero::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0.12;
    z-index: 2;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E");
    background-size: 200px 200px;
  }

  /* Speaker photo gold ring */
  .theme-elegant [id="speakers"] img {
    box-shadow: 0 0 0 3px var(--elg-gold-light);
  }

  /* Sticky nav warm tone */
  .theme-elegant .elg-nav > div {
    background: rgba(250, 248, 244, 0.92) !important;
    border-bottom: 1px solid var(--elg-gold-light) !important;
  }

  /* Footer warm cream */
  .theme-elegant .elg-footer {
    background: var(--elg-cream) !important;
    color: var(--elg-text) !important;
    border-color: var(--elg-gold-light) !important;
  }
  .theme-elegant .elg-footer h3,
  .theme-elegant .elg-footer h4 {
    color: var(--elg-text) !important;
    font-family: 'Cormorant Garamond', Georgia, serif !important;
  }
  .theme-elegant .elg-footer p,
  .theme-elegant .elg-footer span {
    color: var(--elg-muted) !important;
  }
  .theme-elegant .elg-footer button {
    border-color: var(--elg-gold-light) !important;
    color: var(--elg-muted) !important;
  }

  /* Countdown gold accent */
  .theme-elegant .elg-countdown {
    background: linear-gradient(135deg, #2C1810 0%, #3D2415 100%) !important;
    color: #FAF8F4 !important;
    border: none !important;
  }
  .theme-elegant .elg-countdown * {
    color: #FAF8F4 !important;
  }

  /* Accent buttons */
  .theme-elegant button[class*="bg-primary"],
  .theme-elegant a[class*="bg-primary"] {
    background: var(--elg-accent) !important;
  }

  /* Card warmth */
  .theme-elegant .rounded-xl,
  .theme-elegant .rounded-lg {
    border-color: var(--elg-gold-light);
  }

  /* Subtle gold accent on stat values */
  .theme-elegant [id="stats"] .text-3xl,
  .theme-elegant [id="stats"] .text-4xl {
    color: var(--elg-accent);
  }
`;

export const ThemePublicElegant: React.FC<Props> = ({ data }) => {
  useEffect(() => {
    // Inject Google Fonts
    if (!document.getElementById(FONT_LINK_ID)) {
      const link = document.createElement("link");
      link.id = FONT_LINK_ID;
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Lato:wght@300;400&display=swap";
      document.head.appendChild(link);
    }
    // Inject theme styles
    if (!document.getElementById(THEME_STYLE_ID)) {
      const style = document.createElement("style");
      style.id = THEME_STYLE_ID;
      style.textContent = elegantCSS;
      document.head.appendChild(style);
    }
    return () => {
      document.getElementById(THEME_STYLE_ID)?.remove();
      document.getElementById(FONT_LINK_ID)?.remove();
    };
  }, []);

  return (
    <div className="theme-elegant min-h-screen">
      <PublicStickyNav data={data} className="elg-nav" />
      <PublicHeroSection data={data} parallax className="elg-hero min-h-[480px] sm:min-h-[560px] flex items-end" />
      <PublicAnnouncementsTicker eventId={data.event.id} />
      <PublicCountdownSection data={data} className="elg-countdown" />
      <PublicAnnouncementsSection data={data} />
      <PublicStatsSection data={data} className="elg-section" />
      <PublicEventInfoSection data={data} className="elg-section" />
      <PublicAgendaSection data={data} className="elg-section" />
      <PublicSpeakersSection data={data} className="elg-section" />
      <PublicVenueSection data={data} className="elg-section" />
      <PublicGallerySection data={data} className="elg-section" />
      <PublicOrganizersSection data={data} className="elg-section" />
      <PublicDressCodeSection data={data} className="elg-section" />
      <PublicTransportSection data={data} className="elg-section" />
      <PublicFooterSection data={data} className="elg-footer" />
    </div>
  );
};

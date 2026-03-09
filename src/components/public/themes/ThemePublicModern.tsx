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

interface Props { data: PublicEventData; }

const THEME_STYLE_ID = "theme-modern-style";
const FONT_LINK_ID = "theme-modern-fonts";

const modernCSS = `
  .theme-modern {
    --mod-bg: #F6F8FC;
    --mod-text: #111827;
    --mod-accent: #2563EB;
    --mod-accent-dark: #1E40AF;
    --mod-dark: #111827;

    background-color: var(--mod-bg);
    color: var(--mod-text);
    font-family: 'Space Grotesk', system-ui, sans-serif;
  }

  .theme-modern h1,
  .theme-modern h2,
  .theme-modern h3,
  .theme-modern h4 {
    font-family: 'Space Grotesk', system-ui, sans-serif;
    font-weight: 700;
    letter-spacing: -0.02em;
  }

  /* Hero geometric grid overlay */
  .theme-modern .mod-hero::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 1;
    opacity: 0.05;
    background-image:
      linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px);
    background-size: 60px 60px;
  }

  /* Dark alternating sections */
  .theme-modern .mod-dark-section {
    background: var(--mod-dark) !important;
    color: #F9FAFB !important;
  }
  .theme-modern .mod-dark-section * {
    color: #D1D5DB !important;
    border-color: rgba(255,255,255,0.1) !important;
  }
  .theme-modern .mod-dark-section h2,
  .theme-modern .mod-dark-section h3,
  .theme-modern .mod-dark-section h4 {
    color: #F9FAFB !important;
  }
  .theme-modern .mod-dark-section .text-3xl,
  .theme-modern .mod-dark-section .text-4xl {
    color: #FFFFFF !important;
  }

  /* Stats: bold blue cards */
  .theme-modern [id="stats"] .rounded-xl,
  .theme-modern [id="stats"] .rounded-lg {
    background: var(--mod-accent) !important;
    border: none !important;
  }
  .theme-modern [id="stats"] .rounded-xl *,
  .theme-modern [id="stats"] .rounded-lg * {
    color: #FFFFFF !important;
  }

  /* Agenda bold left bar */
  .theme-modern [id="agenda"] .rounded-xl,
  .theme-modern [id="agenda"] .rounded-lg {
    border-left: 3px solid var(--mod-accent) !important;
    border-radius: 0 0.75rem 0.75rem 0 !important;
  }

  /* Speaker cards: rectangular, bold bottom border */
  .theme-modern [id="speakers"] .rounded-xl,
  .theme-modern [id="speakers"] .rounded-lg,
  .theme-modern [id="speakers"] .rounded-full {
    border-radius: 0 !important;
  }
  .theme-modern [id="speakers"] > div > div > div {
    border-bottom: 3px solid var(--mod-accent);
  }

  /* Sticky nav */
  .theme-modern .mod-nav > div {
    background: rgba(246, 248, 252, 0.95) !important;
    border-bottom: 1px solid rgba(37, 99, 235, 0.15) !important;
  }

  /* Footer full black */
  .theme-modern .mod-footer {
    background: #000000 !important;
    color: #FFFFFF !important;
    border-color: rgba(255,255,255,0.08) !important;
  }
  .theme-modern .mod-footer * {
    color: rgba(255,255,255,0.6) !important;
  }
  .theme-modern .mod-footer h3,
  .theme-modern .mod-footer h4 {
    color: #FFFFFF !important;
  }
  .theme-modern .mod-footer a,
  .theme-modern .mod-footer button:hover {
    color: var(--mod-accent) !important;
  }
  .theme-modern .mod-footer button {
    border-color: rgba(255,255,255,0.12) !important;
  }

  /* Countdown accent */
  .theme-modern .mod-countdown {
    background: linear-gradient(135deg, var(--mod-accent) 0%, var(--mod-accent-dark) 100%) !important;
    color: #FFFFFF !important;
    border: none !important;
  }
  .theme-modern .mod-countdown * {
    color: #FFFFFF !important;
  }

  /* Primary button accent */
  .theme-modern button[class*="bg-white"] {
    background: var(--mod-accent) !important;
    color: #FFFFFF !important;
  }
`;

export const ThemePublicModern: React.FC<Props> = ({ data }) => {
  useEffect(() => {
    if (!document.getElementById(FONT_LINK_ID)) {
      const link = document.createElement("link");
      link.id = FONT_LINK_ID;
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap";
      document.head.appendChild(link);
    }
    if (!document.getElementById(THEME_STYLE_ID)) {
      const style = document.createElement("style");
      style.id = THEME_STYLE_ID;
      style.textContent = modernCSS;
      document.head.appendChild(style);
    }
    return () => {
      document.getElementById(THEME_STYLE_ID)?.remove();
      document.getElementById(FONT_LINK_ID)?.remove();
    };
  }, []);

  return (
    <div className="theme-modern min-h-screen">
      <PublicStickyNav data={data} className="mod-nav" />
      <PublicHeroSection data={data} parallax className="mod-hero min-h-[480px] sm:min-h-[560px] flex items-end" />
      <PublicAnnouncementsTicker eventId={data.event.id} />
      <PublicCountdownSection data={data} className="mod-countdown" />
      <PublicAnnouncementsSection data={data} />
      <div className="mod-dark-section">
        <PublicStatsSection data={data} />
      </div>
      <PublicEventInfoSection data={data} />
      <div className="mod-dark-section">
        <PublicAgendaSection data={data} />
      </div>
      <PublicSpeakersSection data={data} />
      <div className="mod-dark-section">
        <PublicVenueSection data={data} />
      </div>
      <PublicGallerySection data={data} />
      <div className="mod-dark-section">
        <PublicOrganizersSection data={data} />
      </div>
      <PublicDressCodeSection data={data} />
      <PublicTransportSection data={data} />
      <PublicFooterSection data={data} className="mod-footer" />
    </div>
  );
};

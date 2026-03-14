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

const THEME_STYLE_ID = "theme-corporate-style";

const corporateCSS = `
  .theme-corporate {
    --corp-bg: #FFFFFF;
    --corp-text: #0F172A;
    --corp-accent: #1A56A4;
    --corp-accent-light: #E8F0FE;
    --corp-border: #E2E8F0;
    --corp-muted: #64748B;
    --corp-navy: #0F172A;

    background-color: var(--corp-bg);
    color: var(--corp-text);
    font-family: 'DM Sans', system-ui, sans-serif;
  }

  /* Heading left-border accent */
  .theme-corporate h2 {
    border-left: 3px solid var(--corp-accent);
    padding-left: 0.75rem;
  }

  /* Sticky nav override */
  .theme-corporate .corp-nav > div {
    background: var(--corp-bg) !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    border-bottom: 1px solid var(--corp-border) !important;
    box-shadow: none !important;
  }

  /* Alternating diagonal stripe texture */
  .theme-corporate .corp-section-striped {
    position: relative;
  }
  .theme-corporate .corp-section-striped::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: repeating-linear-gradient(
      45deg,
      transparent,
      transparent 10px,
      rgba(15, 23, 42, 0.02) 10px,
      rgba(15, 23, 42, 0.02) 11px
    );
    z-index: 0;
  }
  .theme-corporate .corp-section-striped > * {
    position: relative;
    z-index: 1;
  }

  /* Countdown blue section */
  .theme-corporate .corp-countdown {
    background: var(--corp-accent) !important;
    color: #FFFFFF !important;
    border: none !important;
  }
  .theme-corporate .corp-countdown * {
    color: #FFFFFF !important;
  }

  /* Footer dark navy */
  .theme-corporate .corp-footer {
    background: var(--corp-navy) !important;
    color: #FFFFFF !important;
    border-color: rgba(255,255,255,0.1) !important;
  }
  .theme-corporate .corp-footer * {
    color: rgba(255,255,255,0.7) !important;
  }
  .theme-corporate .corp-footer h3,
  .theme-corporate .corp-footer h4 {
    color: #FFFFFF !important;
  }
  .theme-corporate .corp-footer button {
    border-color: rgba(255,255,255,0.15) !important;
  }

  /* Active nav link accent */
  .theme-corporate .corp-nav a[class*="bg-primary"] {
    background: var(--corp-accent-light) !important;
    color: var(--corp-accent) !important;
  }

  /* Stats cards subtle accent border */
  .theme-corporate [id="stats"] .rounded-xl,
  .theme-corporate [id="stats"] .rounded-lg {
    border-left: 3px solid var(--corp-accent);
  }
`;

export const ThemePublicCorporate: React.FC<Props> = ({ data }) => {
  useEffect(() => {
    if (!document.getElementById(THEME_STYLE_ID)) {
      const style = document.createElement("style");
      style.id = THEME_STYLE_ID;
      style.textContent = corporateCSS;
      document.head.appendChild(style);
    }
    return () => {
      document.getElementById(THEME_STYLE_ID)?.remove();
    };
  }, []);

  return (
    <div className="theme-corporate min-h-screen">
      <PublicStickyNav data={data} className="corp-nav" />
      <PublicHeroSection data={data} parallax className="min-h-[480px] sm:min-h-[560px] flex items-end" />
      <PublicAnnouncementsTicker eventId={data.event.id} />
      <PublicCountdownSection data={data} className="corp-countdown" />
      <div className="corp-section-striped">
        <PublicAnnouncementsSection data={data} />
      </div>
      <PublicStatsSection data={data} />
      <div className="corp-section-striped">
        <PublicEventInfoSection data={data} />
      </div>
      <PublicAgendaSection data={data} />
      <div className="corp-section-striped">
        <PublicSpeakersSection data={data} />
      </div>
      <PublicVenueSection data={data} />
      <PublicGallerySection data={data} />
      <div className="corp-section-striped">
        <PublicOrganizersSection data={data} />
      </div>
      <PublicAttendeesSection data={data} />
      <PublicDressCodeSection data={data} />
      <PublicTransportSection data={data} />
      <PublicFooterSection data={data} className="corp-footer" />
      <PublicFooterSection data={data} className="corp-footer" />
    </div>
  );
};

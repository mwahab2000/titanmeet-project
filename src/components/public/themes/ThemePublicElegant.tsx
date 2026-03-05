import type { PublicEventData } from "@/lib/publicSite/types";
import { PublicHeroSection } from "../sections/PublicHeroSection";
import { PublicGallerySection } from "../sections/PublicGallerySection";
import { PublicEventInfoSection } from "../sections/PublicEventInfoSection";
import { PublicAnnouncementsSection } from "../sections/PublicAnnouncementsSection";
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

export const ThemePublicElegant: React.FC<Props> = ({ data }) => (
  <div className="min-h-screen bg-[hsl(30,20%,97%)] text-[hsl(30,10%,15%)]" style={{ fontFamily: "'Georgia', serif" }}>
    <PublicStickyNav data={data} className="[&_nav>div]:bg-[hsl(30,20%,97%)]/90 [&_nav>div]:backdrop-blur-md" />
    <PublicHeroSection data={data} parallax className="min-h-[480px] sm:min-h-[560px] flex items-end bg-[hsl(30,15%,92%)]" />
    <PublicCountdownSection data={data} className="bg-[hsl(30,15%,94%)]" />
    <PublicAnnouncementsSection data={data} className="[&_div]:border-[hsl(30,30%,70%)]/30 [&_div]:bg-[hsl(30,30%,95%)]" />
    <PublicStatsSection data={data} />
    <PublicEventInfoSection data={data} />
    <PublicAgendaSection data={data} className="[&_div]:border-[hsl(30,15%,85%)] [&_div]:bg-[hsl(30,15%,99%)]" />
    <PublicSpeakersSection data={data} className="[&_div]:border-[hsl(30,15%,85%)] [&_div]:bg-[hsl(30,15%,99%)]" />
    <PublicVenueSection data={data} />
    <PublicGallerySection data={data} />
    <PublicOrganizersSection data={data} className="[&_div]:border-[hsl(30,15%,85%)]" />
    <PublicDressCodeSection data={data} className="[&_div]:border-[hsl(30,15%,85%)] [&_div]:bg-[hsl(30,15%,99%)]" />
    <PublicTransportSection data={data} className="[&_div]:border-[hsl(30,15%,85%)] [&_div]:bg-[hsl(30,15%,99%)]" />
    <PublicFooterSection data={data} className="bg-[hsl(30,15%,94%)] border-[hsl(30,15%,85%)]" />
  </div>
);

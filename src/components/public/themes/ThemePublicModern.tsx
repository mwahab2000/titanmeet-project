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

export const ThemePublicModern: React.FC<Props> = ({ data }) => (
  <div className="min-h-screen bg-[hsl(220,20%,97%)] text-[hsl(220,30%,15%)]">
    <PublicStickyNav data={data} className="[&_nav>div]:bg-[hsl(220,20%,97%)]/90 [&_nav>div]:backdrop-blur-md" />
    <PublicHeroSection data={data} parallax className="min-h-[440px] flex items-end bg-[hsl(220,60%,50%)]" />
    <PublicCountdownSection data={data} className="bg-[hsl(220,20%,95%)]" />
    <PublicAnnouncementsSection data={data} className="[&_div]:border-[hsl(220,60%,80%)]/30 [&_div]:bg-[hsl(220,60%,96%)]" />
    <PublicStatsSection data={data} />
    <PublicEventInfoSection data={data} />
    <PublicAgendaSection data={data} className="[&_div]:rounded-2xl [&_div]:shadow-sm" />
    <PublicSpeakersSection data={data} className="[&_div]:rounded-2xl [&_div]:shadow-md" />
    <PublicVenueSection data={data} />
    <PublicGallerySection data={data} className="[&_button]:rounded-2xl" />
    <PublicOrganizersSection data={data} />
    <PublicDressCodeSection data={data} className="[&_div]:rounded-2xl [&_div]:shadow-sm" />
    <PublicTransportSection data={data} className="[&_div]:rounded-2xl [&_div]:shadow-sm" />
    <PublicFooterSection data={data} className="bg-[hsl(220,30%,12%)] text-[hsl(220,10%,85%)] [&_*]:text-[hsl(220,10%,75%)] [&_h3]:text-[hsl(220,10%,95%)] [&_h4]:text-[hsl(220,10%,95%)]" />
  </div>
);

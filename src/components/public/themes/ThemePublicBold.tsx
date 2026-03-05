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

export const ThemePublicBold: React.FC<Props> = ({ data }) => (
  <div className="min-h-screen bg-[hsl(0,0%,5%)] text-[hsl(0,0%,95%)]">
    <PublicStickyNav data={data} className="[&_nav>div]:bg-[hsl(0,0%,5%)]/90 [&_nav>div]:border-[hsl(0,0%,15%)]/50 [&_nav>div]:backdrop-blur-md" />
    <PublicHeroSection data={data} parallax className="min-h-[520px] sm:min-h-[600px] flex items-end bg-gradient-to-br from-[hsl(260,60%,30%)] to-[hsl(320,60%,25%)]" />
    <PublicAnnouncementsTicker eventId={data.event.id} />
    <PublicCountdownSection data={data} className="bg-[hsl(0,0%,8%)] text-[hsl(0,0%,90%)]" />
    <PublicAnnouncementsSection data={data} className="[&_div]:border-[hsl(260,40%,30%)]/40 [&_div]:bg-[hsl(260,30%,12%)] [&_p]:text-[hsl(0,0%,80%)]" />
    <PublicStatsSection data={data} />
    <PublicEventInfoSection data={data} className="[&_p]:text-[hsl(0,0%,70%)]" />
    <PublicAgendaSection data={data} className="[&_div]:border-[hsl(0,0%,20%)] [&_div]:bg-[hsl(0,0%,10%)] [&_p]:text-[hsl(0,0%,65%)]" />
    <PublicSpeakersSection data={data} className="[&_div]:border-[hsl(0,0%,20%)] [&_div]:bg-[hsl(0,0%,10%)] [&_p]:text-[hsl(0,0%,65%)]" />
    <PublicVenueSection data={data} className="[&_p]:text-[hsl(0,0%,65%)]" />
    <PublicGallerySection data={data} />
    <PublicOrganizersSection data={data} className="[&_div]:border-[hsl(0,0%,20%)] [&_div]:bg-[hsl(0,0%,10%)] [&_p]:text-[hsl(0,0%,65%)]" />
    <PublicDressCodeSection data={data} className="[&_div]:border-[hsl(0,0%,20%)] [&_div]:bg-[hsl(0,0%,10%)] [&_p]:text-[hsl(0,0%,65%)]" />
    <PublicTransportSection data={data} className="[&_div]:border-[hsl(0,0%,20%)] [&_div]:bg-[hsl(0,0%,10%)] [&_p]:text-[hsl(0,0%,65%)]" />
    <PublicFooterSection data={data} className="bg-[hsl(0,0%,3%)] border-[hsl(0,0%,15%)] [&_*]:text-[hsl(0,0%,60%)] [&_h3]:text-[hsl(0,0%,90%)] [&_h4]:text-[hsl(0,0%,90%)]" />
  </div>
);

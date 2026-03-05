import type { PublicEventData } from "@/lib/publicSite/types";
import { PublicHeroSection } from "../sections/PublicHeroSection";
import { PublicGallerySection } from "../sections/PublicGallerySection";
import { PublicEventInfoSection } from "../sections/PublicEventInfoSection";
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

export const ThemePublicModern: React.FC<Props> = ({ data }) => (
  <div className="min-h-screen bg-[hsl(220,20%,97%)] text-[hsl(220,30%,15%)]">
    <PublicStickyNav data={data} className="[&_nav>div]:bg-[hsl(220,20%,97%)]/90 [&_nav>div]:backdrop-blur-md" />
    <PublicHeroSection data={data} parallax className="min-h-[480px] sm:min-h-[560px] flex items-end bg-[hsl(220,60%,50%)]" />
    <PublicAnnouncementsTicker eventId={data.event.id} />
    <PublicCountdownSection data={data} className="bg-[hsl(220,20%,95%)]" />
    <PublicStatsSection data={data} />
    <PublicEventInfoSection data={data} />
    <PublicAgendaSection data={data} />
    <PublicSpeakersSection data={data} />
    <PublicVenueSection data={data} />
    <PublicGallerySection data={data} />
    <PublicOrganizersSection data={data} />
    <PublicDressCodeSection data={data} />
    <PublicTransportSection data={data} />
    <PublicFooterSection data={data} className="bg-[hsl(220,30%,12%)] text-[hsl(220,10%,85%)] [&_*]:text-[hsl(220,10%,75%)] [&_h3]:text-[hsl(220,10%,95%)] [&_h4]:text-[hsl(220,10%,95%)]" />
  </div>
);

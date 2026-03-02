import type { PublicEventData } from "@/lib/publicSite/types";
import { PublicHeroSection } from "../sections/PublicHeroSection";
import { PublicGallerySection } from "../sections/PublicGallerySection";
import { PublicEventInfoSection } from "../sections/PublicEventInfoSection";
import { PublicAnnouncementsSection } from "../sections/PublicAnnouncementsSection";
import { PublicAgendaSection } from "../sections/PublicAgendaSection";
import { PublicSpeakersSection } from "../sections/PublicSpeakersSection";
import { PublicVenueSection } from "../sections/PublicVenueSection";
import { PublicOrganizersSection } from "../sections/PublicOrganizersSection";
import { PublicSurveyCtaSection } from "../sections/PublicSurveyCtaSection";
import { PublicDressCodeSection } from "../sections/PublicDressCodeSection";
import { PublicTransportSection } from "../sections/PublicTransportSection";
import { PublicFooterSection } from "../sections/PublicFooterSection";
import { PublicStickyNav } from "../sections/PublicStickyNav";
import { PublicStatsSection } from "../sections/PublicStatsSection";
import { PublicCountdownSection } from "../sections/PublicCountdownSection";

interface Props { data: PublicEventData; }

export const ThemePublicCorporate: React.FC<Props> = ({ data }) => (
  <div className="min-h-screen bg-background text-foreground">
    <PublicStickyNav data={data} />
    <PublicHeroSection data={data} parallax className="bg-muted min-h-[360px] flex items-end" />
    <PublicCountdownSection data={data} className="bg-muted/50" />
    <PublicAnnouncementsSection data={data} />
    <PublicStatsSection data={data} />
    <PublicEventInfoSection data={data} />
    <PublicAgendaSection data={data} />
    <PublicSpeakersSection data={data} />
    <PublicVenueSection data={data} />
    <PublicGallerySection data={data} />
    <PublicOrganizersSection data={data} />
    <PublicDressCodeSection data={data} />
    <PublicTransportSection data={data} />
    <PublicSurveyCtaSection data={data} />
    <PublicFooterSection data={data} />
  </div>
);

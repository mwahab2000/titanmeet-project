import type { PublicEventData } from "@/lib/publicSite/types";
import { PublicEventSeo } from "./PublicEventSeo";
import { ThemePublicCorporate } from "./themes/ThemePublicCorporate";
import { ThemePublicElegant } from "./themes/ThemePublicElegant";
import { ThemePublicModern } from "./themes/ThemePublicModern";
import { ThemePublicCorporateMui } from "./themes/ThemePublicCorporateMui";
import { ThemePublicMidnightGala } from "./themes/ThemePublicMidnightGala";
import { ThemePublicTechSummit } from "./themes/ThemePublicTechSummit";
import { ThemePublicNatureWellness } from "./themes/ThemePublicNatureWellness";
import { ThemePublicCreativeFestival } from "./themes/ThemePublicCreativeFestival";

interface Props {
  data: PublicEventData;
}

const themeMap: Record<string, React.FC<Props>> = {
  corporate: ThemePublicCorporate,
  elegant: ThemePublicElegant,
  modern: ThemePublicModern,
  "corporate-mui": ThemePublicCorporateMui,
  "midnight-gala": ThemePublicMidnightGala,
  "tech-summit": ThemePublicTechSummit,
  "nature-wellness": ThemePublicNatureWellness,
  "creative-festival": ThemePublicCreativeFestival,
};

export const EventThemeRenderer: React.FC<Props> = ({ data }) => {
  const ThemeComponent = themeMap[data.event.themeId] ?? ThemePublicCorporateMui;
  return (
    <>
      <PublicEventSeo data={data} />
      <ThemeComponent data={data} />
    </>
  );
};

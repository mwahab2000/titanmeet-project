import type { PublicEventData } from "@/lib/publicSite/types";
import { ThemePublicCorporate } from "./themes/ThemePublicCorporate";
import { ThemePublicElegant } from "./themes/ThemePublicElegant";
import { ThemePublicModern } from "./themes/ThemePublicModern";
import { ThemePublicCorporateMui } from "./themes/ThemePublicCorporateMui";
import { ThemePublicMidnightGala } from "./themes/ThemePublicMidnightGala";

interface Props {
  data: PublicEventData;
}

const themeMap: Record<string, React.FC<Props>> = {
  corporate: ThemePublicCorporate,
  elegant: ThemePublicElegant,
  modern: ThemePublicModern,
  "corporate-mui": ThemePublicCorporateMui,
  "midnight-gala": ThemePublicMidnightGala,
};

export const EventThemeRenderer: React.FC<Props> = ({ data }) => {
  const ThemeComponent = themeMap[data.event.themeId] ?? ThemePublicCorporateMui;
  return <ThemeComponent data={data} />;
};

import type { PublicEventData } from "@/lib/publicSite/types";
import { ThemePublicCorporate } from "./themes/ThemePublicCorporate";
import { ThemePublicElegant } from "./themes/ThemePublicElegant";
import { ThemePublicModern } from "./themes/ThemePublicModern";
import { ThemePublicBold } from "./themes/ThemePublicBold";

interface Props {
  data: PublicEventData;
}

const themeMap: Record<string, React.FC<Props>> = {
  corporate: ThemePublicCorporate,
  elegant: ThemePublicElegant,
  modern: ThemePublicModern,
  bold: ThemePublicBold,
};

export const EventThemeRenderer: React.FC<Props> = ({ data }) => {
  const ThemeComponent = themeMap[data.event.themeId] ?? ThemePublicCorporate;
  return <ThemeComponent data={data} />;
};

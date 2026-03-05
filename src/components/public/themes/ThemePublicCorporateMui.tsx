import { ThemeProvider, CssBaseline } from "@mui/material";
import type { PublicEventData } from "@/lib/publicSite/types";
import { muiCorporateTheme } from "./mui/muiCorporateTheme";
import { MuiCorporateNav } from "./mui/MuiCorporateNav";
import { MuiCorporateHero } from "./mui/MuiCorporateHero";
import { MuiCorporateCountdown } from "./mui/MuiCorporateCountdown";
import { MuiCorporateAnnouncementsTicker } from "./mui/MuiCorporateAnnouncementsTicker";
import { MuiCorporateStats } from "./mui/MuiCorporateStats";
import { MuiCorporateAbout } from "./mui/MuiCorporateAbout";
import { MuiCorporateAgenda } from "./mui/MuiCorporateAgenda";
import { MuiCorporateSpeakers } from "./mui/MuiCorporateSpeakers";
import { MuiCorporateVenue } from "./mui/MuiCorporateVenue";
import { MuiCorporateGallery } from "./mui/MuiCorporateGallery";
import { MuiCorporateOrganizers } from "./mui/MuiCorporateOrganizers";
import { MuiCorporateDressCode } from "./mui/MuiCorporateDressCode";
import { MuiCorporateTransport } from "./mui/MuiCorporateTransport";
import { MuiCorporateFooter } from "./mui/MuiCorporateFooter";

interface Props { data: PublicEventData; }

export const ThemePublicCorporateMui: React.FC<Props> = ({ data }) => (
  <ThemeProvider theme={muiCorporateTheme}>
    <CssBaseline />
    <div style={{ minHeight: "100vh", backgroundColor: muiCorporateTheme.palette.background.default }}>
      <MuiCorporateNav data={data} />
      <MuiCorporateHero data={data} />
      <MuiCorporateAnnouncementsTicker eventId={data.event.id} />
      <MuiCorporateCountdown data={data} />
      <MuiCorporateStats data={data} />
      <MuiCorporateAbout data={data} />
      <MuiCorporateAgenda data={data} />
      <MuiCorporateSpeakers data={data} />
      <MuiCorporateVenue data={data} />
      <MuiCorporateGallery data={data} />
      <MuiCorporateOrganizers data={data} />
      <MuiCorporateDressCode data={data} />
      <MuiCorporateTransport data={data} />
      <MuiCorporateFooter data={data} />
    </div>
  </ThemeProvider>
);

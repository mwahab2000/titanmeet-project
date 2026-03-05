import type { PublicEventData } from "@/lib/publicSite/types";
import { Container, Typography, Box, Divider } from "@mui/material";

interface Props { data: PublicEventData; }

export const MuiCorporateAbout: React.FC<Props> = ({ data }) => {
  if (!data.event.description) return null;
  return (
    <Box component="section" id="about" sx={{ py: { xs: 8, md: 12 } }}>
      <Container maxWidth="lg">
        <Box sx={{ display: "flex", alignItems: "center", gap: 3, mb: 5 }}>
          <Typography variant="h3" sx={{ fontSize: { xs: "1.75rem", md: "2.25rem" } }}>
            About This Event
          </Typography>
          <Divider sx={{ flex: 1 }} />
        </Box>
        <Typography
          variant="body1"
          sx={{ maxWidth: 720, fontSize: { xs: "1rem", md: "1.1rem" }, whiteSpace: "pre-line" }}
        >
          {data.event.description}
        </Typography>
      </Container>
    </Box>
  );
};

import type { PublicEventData } from "@/lib/publicSite/types";
import { Container, Typography, Box, Divider, Chip } from "@mui/material";

interface Props { data: PublicEventData; }

export const MuiCorporateAbout: React.FC<Props> = ({ data }) => {
  if (!data.event.description) return null;
  return (
    <Box component="section" id="about" sx={{ py: { xs: 8, md: 12 }, bgcolor: "#0d1528" }}>
      <Container maxWidth="lg">
        <Chip
          label="THE CONTEXT"
          size="small"
          sx={{ mb: 2, bgcolor: "rgba(201,168,76,0.1)", color: "#c9a84c", fontWeight: 700, letterSpacing: "0.15em", fontSize: "0.6rem", border: "1px solid rgba(201,168,76,0.15)" }}
        />
        <Box sx={{ display: "flex", alignItems: "center", gap: 3, mb: 5 }}>
          <Typography variant="h3" sx={{ fontSize: { xs: "1.75rem", md: "2.25rem" }, color: "#fff" }}>
            {data.event.title}
          </Typography>
          <Divider sx={{ flex: 1 }} />
        </Box>
        <Typography
          variant="body1"
          sx={{ maxWidth: 720, fontSize: { xs: "1rem", md: "1.1rem" }, whiteSpace: "pre-line", color: "#8b95a8", lineHeight: 1.8 }}
        >
          {data.event.description}
        </Typography>
      </Container>
    </Box>
  );
};

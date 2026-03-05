import type { PublicEventData } from "@/lib/publicSite/types";
import { Box, Container, Typography, Divider, Grid, Stack } from "@mui/material";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";

interface Props { data: PublicEventData; }

export const MuiCorporateFooter: React.FC<Props> = ({ data }) => {
  const contactOrg = data.organizers.find((o) => o.email || o.mobile);
  return (
    <Box
      component="footer"
      sx={{ bgcolor: "#0f172a", color: "grey.400", borderTop: "1px solid", borderColor: "grey.800" }}
    >
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
        <Grid container spacing={6}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="h6" sx={{ color: "#fff", mb: 1 }}>{data.event.title}</Typography>
            <Typography variant="body2" sx={{ color: "grey.500" }}>Hosted by {data.client.name}</Typography>
            {data.hero.venueName && <Typography variant="body2" sx={{ color: "grey.500" }}>{data.hero.venueName}</Typography>}
          </Grid>
          {contactOrg && (
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="overline" sx={{ color: "grey.500", mb: 1.5, display: "block" }}>Contact</Typography>
              <Typography variant="body2" sx={{ color: "grey.300", fontWeight: 500 }}>
                {contactOrg.name}{contactOrg.role ? ` — ${contactOrg.role}` : ""}
              </Typography>
              <Stack spacing={0.5} sx={{ mt: 1 }}>
                {contactOrg.email && (
                  <Typography variant="caption" sx={{ display: "flex", alignItems: "center", gap: 0.75, color: "grey.500" }}>
                    <EmailIcon sx={{ fontSize: 13 }} /> {contactOrg.email}
                  </Typography>
                )}
                {contactOrg.mobile && (
                  <Typography variant="caption" sx={{ display: "flex", alignItems: "center", gap: 0.75, color: "grey.500" }}>
                    <PhoneIcon sx={{ fontSize: 13 }} /> {contactOrg.mobile}
                  </Typography>
                )}
              </Stack>
            </Grid>
          )}
        </Grid>
        <Divider sx={{ my: 4, borderColor: "grey.800" }} />
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="caption" sx={{ color: "grey.600" }}>Powered by TitanMeet</Typography>
          <Typography variant="caption" sx={{ color: "grey.700" }}>© {new Date().getFullYear()}</Typography>
        </Box>
      </Container>
    </Box>
  );
};

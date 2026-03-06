import type { PublicEventData } from "@/lib/publicSite/types";
import { Box, Container, Typography, Divider, Grid, Stack, Chip } from "@mui/material";
import InsightsIcon from "@mui/icons-material/Insights";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";

interface Props { data: PublicEventData; }

export const MuiCorporateFooter: React.FC<Props> = ({ data }) => {
  const contactOrg = data.organizers.find((o) => o.email || o.mobile);
  return (
    <Box
      component="footer"
      sx={{ bgcolor: "#060a14", color: "#6b7a90", borderTop: "1px solid rgba(255,255,255,0.04)" }}
    >
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
        <Grid container spacing={6}>
          <Grid size={{ xs: 12, md: 5 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <InsightsIcon sx={{ color: "#c9a84c", fontSize: 20 }} />
              <Typography variant="h6" sx={{ color: "#c9a84c", fontSize: "0.95rem", letterSpacing: "0.05em" }}>
                {data.client.name.toUpperCase()}
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: "#4a5568", mb: 2, maxWidth: 360 }}>
              A private executive platform for high-level corporate governance and strategic alignment.
            </Typography>
            <Typography variant="caption" sx={{ color: "#4a5568", display: "block" }}>
              Hosted by {data.client.name}
            </Typography>
            {data.hero.venueName && (
              <Typography variant="caption" sx={{ color: "#4a5568" }}>{data.hero.venueName}</Typography>
            )}
          </Grid>

          {contactOrg && (
            <Grid size={{ xs: 12, md: 3 }}>
              <Typography variant="overline" sx={{ color: "#4a5568", mb: 1.5, display: "block" }}>Contact Support</Typography>
              <Typography variant="body2" sx={{ color: "#8b95a8", mb: 1 }}>
                Need assistance with your registration or travel plans?
              </Typography>
              <Stack spacing={0.5}>
                {contactOrg.email && (
                  <Typography variant="caption" sx={{ display: "flex", alignItems: "center", gap: 0.75, color: "#c9a84c" }}>
                    <EmailIcon sx={{ fontSize: 13 }} /> {contactOrg.email}
                  </Typography>
                )}
                {contactOrg.mobile && (
                  <Typography variant="caption" sx={{ display: "flex", alignItems: "center", gap: 0.75, color: "#6b7a90" }}>
                    <PhoneIcon sx={{ fontSize: 13 }} /> {contactOrg.mobile}
                  </Typography>
                )}
              </Stack>
            </Grid>
          )}

          <Grid size={{ xs: 12, md: 4 }}>
            <Typography variant="overline" sx={{ color: "#4a5568", mb: 1.5, display: "block" }}>Quick Links</Typography>
            <Stack spacing={0.75}>
              {[
                { id: "agenda", label: "Event Schedule" },
                { id: "speakers", label: "Speakers Profile" },
                { id: "transport", label: "Travel Guidelines" },
              ].map(link => (
                <Typography
                  key={link.id}
                  component="a"
                  href={`#${link.id}`}
                  variant="caption"
                  sx={{ color: "#6b7a90", textDecoration: "none", "&:hover": { color: "#c9a84c" }, transition: "color 0.2s" }}
                >
                  {link.label}
                </Typography>
              ))}
            </Stack>
          </Grid>
        </Grid>

        <Divider sx={{ my: 4, borderColor: "rgba(255,255,255,0.04)" }} />
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
          <Typography variant="caption" sx={{ color: "#3a4358" }}>
            © {new Date().getFullYear()} {data.client.name}. All rights reserved.
          </Typography>
          <Typography variant="caption" sx={{ color: "#3a4358" }}>
            Powered by <Box component="span" sx={{ color: "#4a5568" }}>TitanMeet</Box>
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

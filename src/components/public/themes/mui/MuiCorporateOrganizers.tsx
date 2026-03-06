import type { PublicEventData } from "@/lib/publicSite/types";
import { Container, Typography, Box, Divider, Card, CardContent, Avatar, Grid, Stack, Chip } from "@mui/material";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";

interface Props { data: PublicEventData; }

const fallback = "/placeholder.svg";

export const MuiCorporateOrganizers: React.FC<Props> = ({ data }) => {
  if (data.organizers.length === 0) return null;
  return (
    <Box component="section" id="organizers" sx={{ py: { xs: 8, md: 12 }, bgcolor: "#0a0f1e" }}>
      <Container maxWidth="lg">
        <Chip
          label="ORGANIZING COMMITTEE"
          size="small"
          sx={{ mb: 3, bgcolor: "rgba(201,168,76,0.1)", color: "#c9a84c", fontWeight: 700, letterSpacing: "0.15em", fontSize: "0.6rem", border: "1px solid rgba(201,168,76,0.15)" }}
        />
        <Grid container spacing={3}>
          {data.organizers.map((o) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={o.id}>
              <Card variant="outlined" sx={{ height: "100%", bgcolor: "#0d1528", borderColor: "rgba(255,255,255,0.06)" }}>
                <CardContent sx={{ p: 3, display: "flex", gap: 2.5, alignItems: "flex-start" }}>
                  {o.photoUrl ? (
                    <Avatar
                      src={o.photoUrl}
                      alt={o.name}
                      sx={{ width: 56, height: 56, border: "2px solid rgba(201,168,76,0.2)" }}
                      imgProps={{ onError: (e: any) => { e.target.src = fallback; } }}
                    />
                  ) : (
                    <Avatar sx={{ width: 56, height: 56, bgcolor: "rgba(201,168,76,0.1)", color: "#c9a84c", fontWeight: 700, fontSize: "1.2rem", border: "2px solid rgba(201,168,76,0.2)" }}>
                      {o.name.charAt(0)}
                    </Avatar>
                  )}
                  <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "#e8e6e1", lineHeight: 1.3 }}>{o.name}</Typography>
                    {o.role && <Typography variant="caption" sx={{ color: "#c9a84c", fontWeight: 600 }}>{o.role}</Typography>}
                    {o.email && (
                      <Typography variant="caption" sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "#6b7a90" }}>
                        <EmailIcon sx={{ fontSize: 13 }} /> {o.email}
                      </Typography>
                    )}
                    {o.mobile && (
                      <Typography variant="caption" sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "#6b7a90" }}>
                        <PhoneIcon sx={{ fontSize: 13 }} /> {o.mobile}
                      </Typography>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
};

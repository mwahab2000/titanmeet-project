import type { PublicEventData } from "@/lib/publicSite/types";
import { Container, Typography, Box, Divider, Card, CardContent, Avatar, Grid, Stack } from "@mui/material";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";

interface Props { data: PublicEventData; }

const fallback = "/placeholder.svg";

export const MuiCorporateOrganizers: React.FC<Props> = ({ data }) => {
  if (data.organizers.length === 0) return null;
  return (
    <Box component="section" id="organizers" sx={{ py: { xs: 8, md: 12 } }}>
      <Container maxWidth="lg">
        <Box sx={{ display: "flex", alignItems: "center", gap: 3, mb: 6 }}>
          <Typography variant="h3" sx={{ fontSize: { xs: "1.75rem", md: "2.25rem" } }}>Organizers</Typography>
          <Divider sx={{ flex: 1 }} />
        </Box>
        <Grid container spacing={3}>
          {data.organizers.map((o) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={o.id}>
              <Card variant="outlined" sx={{ height: "100%" }}>
                <CardContent sx={{ p: 3, display: "flex", gap: 2.5, alignItems: "flex-start" }}>
                  {o.photoUrl ? (
                    <Avatar
                      src={o.photoUrl}
                      alt={o.name}
                      sx={{ width: 52, height: 52 }}
                      imgProps={{ onError: (e: any) => { e.target.src = fallback; } }}
                    />
                  ) : (
                    <Avatar sx={{ width: 52, height: 52, bgcolor: "primary.50", color: "primary.main", fontWeight: 700, fontSize: "1.1rem" }}>
                      {o.name.charAt(0)}
                    </Avatar>
                  )}
                  <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "text.primary", lineHeight: 1.3 }}>{o.name}</Typography>
                    {o.role && <Typography variant="caption" sx={{ color: "primary.main", fontWeight: 600 }}>{o.role}</Typography>}
                    {o.email && (
                      <Typography variant="caption" sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "text.secondary" }}>
                        <EmailIcon sx={{ fontSize: 13 }} /> {o.email}
                      </Typography>
                    )}
                    {o.mobile && (
                      <Typography variant="caption" sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "text.secondary" }}>
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

import type { PublicEventData } from "@/lib/publicSite/types";
import { Container, Typography, Box, Divider, Card, CardContent, Avatar, Grid, IconButton } from "@mui/material";
import LinkedInIcon from "@mui/icons-material/LinkedIn";

interface Props { data: PublicEventData; }

const fallback = "/placeholder.svg";

export const MuiCorporateSpeakers: React.FC<Props> = ({ data }) => {
  if (data.speakers.length === 0) return null;
  return (
    <Box component="section" id="speakers" sx={{ py: { xs: 8, md: 12 } }}>
      <Container maxWidth="lg">
        <Box sx={{ display: "flex", alignItems: "center", gap: 3, mb: 6 }}>
          <Typography variant="h3" sx={{ fontSize: { xs: "1.75rem", md: "2.25rem" } }}>Speakers</Typography>
          <Divider sx={{ flex: 1 }} />
        </Box>

        <Grid container spacing={3}>
          {data.speakers.map((s) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={s.id}>
              <Card variant="outlined" sx={{ height: "100%", textAlign: "center" }}>
                <CardContent sx={{ p: { xs: 3, sm: 4 }, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <Avatar
                    src={s.photoUrl || fallback}
                    alt={s.name}
                    sx={{
                      width: 88,
                      height: 88,
                      border: "3px solid",
                      borderColor: "grey.200",
                      transition: "border-color 0.25s",
                      ".MuiCard-root:hover &": { borderColor: "primary.200" },
                    }}
                    imgProps={{ onError: (e: any) => { e.target.src = fallback; } }}
                  />
                  <Box>
                    <Typography variant="h6" sx={{ fontSize: "1.05rem" }}>{s.name}</Typography>
                    {s.title && (
                      <Typography variant="subtitle2" sx={{ color: "primary.main", fontWeight: 600, mt: 0.25 }}>
                        {s.title}
                      </Typography>
                    )}
                  </Box>
                  {s.bio && (
                    <Typography
                      variant="body2"
                      sx={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                    >
                      {s.bio}
                    </Typography>
                  )}
                  {s.linkedinUrl && (
                    <IconButton
                      component="a"
                      href={s.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      size="small"
                      sx={{ color: "text.secondary", "&:hover": { color: "primary.main" } }}
                    >
                      <LinkedInIcon fontSize="small" />
                    </IconButton>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
};

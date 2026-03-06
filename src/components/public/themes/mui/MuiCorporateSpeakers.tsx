import type { PublicEventData } from "@/lib/publicSite/types";
import { Container, Typography, Box, Divider, Card, CardContent, Avatar, Grid, IconButton, Chip } from "@mui/material";
import LinkedInIcon from "@mui/icons-material/LinkedIn";

interface Props { data: PublicEventData; }

const fallback = "/placeholder.svg";

export const MuiCorporateSpeakers: React.FC<Props> = ({ data }) => {
  if (data.speakers.length === 0) return null;
  return (
    <Box component="section" id="speakers" sx={{ py: { xs: 8, md: 12 }, bgcolor: "#0d1528" }}>
      <Container maxWidth="lg">
        <Chip
          label="KEYNOTE SPEAKERS"
          size="small"
          sx={{ mb: 3, bgcolor: "rgba(201,168,76,0.1)", color: "#c9a84c", fontWeight: 700, letterSpacing: "0.15em", fontSize: "0.6rem", border: "1px solid rgba(201,168,76,0.15)" }}
        />

        <Grid container spacing={3}>
          {data.speakers.map((s) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={s.id}>
              <Card variant="outlined" sx={{ height: "100%", textAlign: "center", bgcolor: "#111b30", borderColor: "rgba(255,255,255,0.06)" }}>
                <CardContent sx={{ p: { xs: 3, sm: 4 }, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <Avatar
                    src={s.photoUrl || fallback}
                    alt={s.name}
                    sx={{
                      width: 96,
                      height: 96,
                      border: "3px solid rgba(201,168,76,0.2)",
                      transition: "border-color 0.3s",
                      ".MuiCard-root:hover &": { borderColor: "rgba(201,168,76,0.5)" },
                    }}
                    imgProps={{ onError: (e: any) => { e.target.src = fallback; } }}
                  />
                  <Box>
                    <Typography variant="h6" sx={{ fontSize: "1.05rem", color: "#fff" }}>{s.name}</Typography>
                    {s.title && (
                      <Typography variant="subtitle2" sx={{ color: "#c9a84c", fontWeight: 600, mt: 0.25, fontSize: "0.8rem" }}>
                        {s.title}
                      </Typography>
                    )}
                  </Box>
                  {s.bio && (
                    <Typography
                      variant="body2"
                      sx={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", color: "#6b7a90" }}
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
                      sx={{ color: "#6b7a90", "&:hover": { color: "#c9a84c" } }}
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

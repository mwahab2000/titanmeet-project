import { useState } from "react";
import type { PublicEventData } from "@/lib/publicSite/types";
import { Container, Typography, Box, Divider, Card, CardMedia, CardContent, Button, Stack } from "@mui/material";
import PlaceIcon from "@mui/icons-material/Place";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { PublicLightbox } from "../../sections/PublicLightbox";

interface Props { data: PublicEventData; }

const fallback = "/placeholder.svg";

export const MuiCorporateVenue: React.FC<Props> = ({ data }) => {
  const { venue } = data;
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  if (!venue.name && !venue.address && venue.images.length === 0) return null;

  return (
    <Box component="section" id="venue" sx={{ py: { xs: 8, md: 12 }, bgcolor: "grey.50" }}>
      <Container maxWidth="lg">
        <Box sx={{ display: "flex", alignItems: "center", gap: 3, mb: 6 }}>
          <Typography variant="h3" sx={{ fontSize: { xs: "1.75rem", md: "2.25rem" } }}>Venue</Typography>
          <Divider sx={{ flex: 1 }} />
        </Box>

        <Card variant="outlined" sx={{ overflow: "hidden" }}>
          <Box sx={{ display: { md: "flex" } }}>
            <CardContent sx={{ p: { xs: 4, md: 5 }, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <Stack spacing={2}>
                {venue.name && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Box sx={{ width: 44, height: 44, borderRadius: 2.5, bgcolor: "primary.50", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <PlaceIcon sx={{ color: "primary.main" }} />
                    </Box>
                    <Typography variant="h5" sx={{ fontSize: "1.35rem" }}>{venue.name}</Typography>
                  </Box>
                )}
                {venue.address && <Typography variant="body2" sx={{ pl: 7 }}>{venue.address}</Typography>}
                {venue.notes && <Typography variant="body2" sx={{ pl: 7, color: "text.disabled" }}>{venue.notes}</Typography>}
                {venue.mapLink && (
                  <Box sx={{ pl: 7 }}>
                    <Button
                      component="a"
                      href={venue.mapLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      size="small"
                      endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                      sx={{ textTransform: "none" }}
                    >
                      Open in Maps
                    </Button>
                  </Box>
                )}
              </Stack>
            </CardContent>

            {venue.images.length > 0 && (
              <CardMedia
                component="img"
                image={venue.images[0]}
                alt={venue.name ?? "Venue"}
                onClick={() => { setLightboxIndex(0); setLightboxOpen(true); }}
                onError={(e: any) => { e.target.src = fallback; }}
                sx={{
                  width: { xs: "100%", md: "50%" },
                  height: { xs: 240, md: "auto" },
                  minHeight: { md: 300 },
                  objectFit: "cover",
                  cursor: "pointer",
                  transition: "opacity 0.3s",
                  "&:hover": { opacity: 0.92 },
                }}
              />
            )}
          </Box>
        </Card>
      </Container>
      <PublicLightbox images={venue.images} initialIndex={lightboxIndex} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
    </Box>
  );
};

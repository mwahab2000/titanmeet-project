import { useState, useEffect, useCallback } from "react";
import type { PublicEventData } from "@/lib/publicSite/types";
import { Container, Typography, Box, Divider, Card, CardContent, Button, Stack, Chip } from "@mui/material";
import PlaceIcon from "@mui/icons-material/Place";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

interface Props { data: PublicEventData; }

const fallback = "/placeholder.svg";
const SLIDE_INTERVAL = 5000;

export const MuiCorporateVenue: React.FC<Props> = ({ data }) => {
  const { venue } = data;
  const images = venue.images;
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const iv = setInterval(() => setActiveIdx(p => (p + 1) % images.length), SLIDE_INTERVAL);
    return () => clearInterval(iv);
  }, [images.length]);

  if (!venue.name && !venue.address && images.length === 0) return null;

  return (
    <Box component="section" id="venue" sx={{ py: { xs: 8, md: 12 }, bgcolor: "#0a0f1e" }}>
      <Container maxWidth="lg">
        <Box sx={{ display: "flex", alignItems: "center", gap: 3, mb: 6 }}>
          <PlaceIcon sx={{ color: "#c9a84c", fontSize: 28 }} />
          <Typography variant="h3" sx={{ fontSize: { xs: "1.75rem", md: "2.25rem" }, color: "#fff" }}>Venue</Typography>
          <Divider sx={{ flex: 1 }} />
        </Box>

        <Card variant="outlined" sx={{ overflow: "hidden", bgcolor: "#0d1528", borderColor: "rgba(255,255,255,0.06)" }}>
          <Box sx={{ display: { md: "flex" } }}>
            <CardContent sx={{ p: { xs: 4, md: 5 }, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <Stack spacing={2}>
                {venue.name && (
                  <Typography variant="h5" sx={{ fontSize: "1.35rem", color: "#fff" }}>{venue.name}</Typography>
                )}
                {venue.address && <Typography variant="body2" sx={{ color: "#8b95a8" }}>{venue.address}</Typography>}
                {venue.notes && <Typography variant="body2" sx={{ color: "#6b7a90", fontStyle: "italic" }}>{venue.notes}</Typography>}
                {venue.mapLink && (
                  <Box>
                    <Button
                      component="a"
                      href={venue.mapLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      size="small"
                      endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                      sx={{ color: "#c9a84c", "&:hover": { bgcolor: "rgba(201,168,76,0.08)" } }}
                    >
                      Open in Maps
                    </Button>
                  </Box>
                )}
              </Stack>
            </CardContent>

            {images.length > 0 && (
              <Box sx={{ position: "relative", width: { xs: "100%", md: "50%" }, height: { xs: 240, md: "auto" }, minHeight: { md: 300 }, overflow: "hidden" }}>
                {images.map((src, i) => (
                  <Box
                    key={src}
                    component="img"
                    src={src}
                    alt={venue.name ?? "Venue"}
                    onError={(e: any) => { e.target.src = fallback; }}
                    sx={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      transition: "opacity 1s ease-in-out",
                      opacity: i === activeIdx ? 1 : 0,
                    }}
                  />
                ))}
                {images.length > 1 && (
                  <Box sx={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 0.75 }}>
                    {images.map((_, i) => (
                      <Box key={i} sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: i === activeIdx ? "#c9a84c" : "rgba(255,255,255,0.3)", transition: "all 0.3s" }} />
                    ))}
                  </Box>
                )}
              </Box>
            )}
          </Box>
        </Card>
      </Container>
    </Box>
  );
};

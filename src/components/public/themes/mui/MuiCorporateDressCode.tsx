import { useState } from "react";
import type { PublicEventData } from "@/lib/publicSite/types";
import { Container, Box, Typography, Divider, Card, CardContent, Chip, Grid } from "@mui/material";
import CheckroomIcon from "@mui/icons-material/Checkroom";
import { PublicLightbox } from "../../sections/PublicLightbox";

interface Props { data: PublicEventData; }

const DRESS_TYPE_LABELS: Record<string, string> = {
  formal: "Formal", semi_formal: "Semi-Formal", business_formal: "Business Formal",
  business_casual: "Business Casual", smart_casual: "Smart Casual",
};
const fallback = "/placeholder.svg";

export const MuiCorporateDressCode: React.FC<Props> = ({ data }) => {
  const { dressCode } = data;
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);

  if (!dressCode || dressCode.length === 0) return null;
  const multiDay = dressCode.length > 1;

  return (
    <Box component="section" id="dress-code" sx={{ py: { xs: 8, md: 12 }, bgcolor: "#0a0f1e" }}>
      <Container maxWidth="lg">
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 6 }}>
          <CheckroomIcon sx={{ color: "#c9a84c", fontSize: 28 }} />
          <Typography variant="h3" sx={{ fontSize: { xs: "1.75rem", md: "2.25rem" }, color: "#fff" }}>Dress Code</Typography>
          <Divider sx={{ flex: 1 }} />
        </Box>
        <Grid container spacing={3}>
          {dressCode.map((dc, i) => (
            <Grid size={{ xs: 12, md: multiDay ? 6 : 12 }} key={i}>
              <Card variant="outlined" sx={{ bgcolor: "#0d1528", borderColor: "rgba(255,255,255,0.06)" }}>
                <CardContent sx={{ p: 3 }}>
                  {multiDay && <Chip label={`Day ${dc.dayNumber}`} size="small" sx={{ mb: 2, bgcolor: "rgba(201,168,76,0.1)", color: "#c9a84c", fontWeight: 700, fontSize: "0.65rem", letterSpacing: "0.08em", textTransform: "uppercase" }} />}
                  <Typography variant="h6" sx={{ mb: 1, color: "#fff" }}>{DRESS_TYPE_LABELS[dc.dressType] ?? dc.dressType}</Typography>
                  {dc.customInstructions && <Typography variant="body2" sx={{ mb: 2, color: "#8b95a8" }}>{dc.customInstructions}</Typography>}
                  {dc.referenceImages.length > 0 && (
                    <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                      {dc.referenceImages.map((img, j) => (
                        <Box
                          key={j}
                          onClick={() => { setLightboxImages(dc.referenceImages); setLightboxIndex(j); setLightboxOpen(true); }}
                          sx={{ width: 80, height: 80, borderRadius: 2, overflow: "hidden", cursor: "pointer", border: "1px solid rgba(255,255,255,0.06)", "&:hover img": { transform: "scale(1.08)" } }}
                        >
                          <img src={img} alt={`Ref ${j + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.3s" }} onError={(e: any) => { e.target.src = fallback; }} />
                        </Box>
                      ))}
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
      <PublicLightbox images={lightboxImages} initialIndex={lightboxIndex} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
    </Box>
  );
};

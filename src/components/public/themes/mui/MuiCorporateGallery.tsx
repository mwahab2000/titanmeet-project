import { useState } from "react";
import type { PublicEventData } from "@/lib/publicSite/types";
import { Container, Box, Typography, Divider, ImageList, ImageListItem } from "@mui/material";
import { PublicLightbox } from "../../sections/PublicLightbox";

interface Props { data: PublicEventData; }

export const MuiCorporateGallery: React.FC<Props> = ({ data }) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  if (!data.gallery || data.gallery.length === 0) return null;

  return (
    <Box component="section" id="gallery" sx={{ py: { xs: 8, md: 12 } }}>
      <Container maxWidth="lg">
        <Box sx={{ display: "flex", alignItems: "center", gap: 3, mb: 6 }}>
          <Typography variant="h3" sx={{ fontSize: { xs: "1.75rem", md: "2.25rem" } }}>Gallery</Typography>
          <Divider sx={{ flex: 1 }} />
        </Box>
        <ImageList variant="masonry" cols={window.innerWidth < 600 ? 2 : 3} gap={12}>
          {data.gallery.map((url, i) => (
            <ImageListItem
              key={i}
              sx={{ cursor: "pointer", borderRadius: 3, overflow: "hidden", "&:hover img": { transform: "scale(1.04)" } }}
              onClick={() => { setLightboxIndex(i); setLightboxOpen(true); }}
            >
              <img
                src={url}
                alt={`Gallery ${i + 1}`}
                loading="lazy"
                style={{ display: "block", width: "100%", transition: "transform 0.4s ease" }}
              />
            </ImageListItem>
          ))}
        </ImageList>
      </Container>
      <PublicLightbox images={data.gallery} initialIndex={lightboxIndex} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
    </Box>
  );
};

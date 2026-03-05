import type { PublicEventData } from "@/lib/publicSite/types";
import { Box, Container, Typography, Chip, Button, Stack } from "@mui/material";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import PlaceIcon from "@mui/icons-material/Place";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { format } from "date-fns";

interface Props { data: PublicEventData; }

export const MuiCorporateHero: React.FC<Props> = ({ data }) => {
  const { hero } = data;
  const bgImage = hero.images.length > 0 ? hero.images[0] : null;
  const formattedDate = hero.date ? format(new Date(hero.date), "EEEE, MMMM d, yyyy") : null;

  return (
    <Box
      component="section"
      sx={{
        position: "relative",
        minHeight: { xs: 480, md: 580 },
        display: "flex",
        alignItems: "center",
        overflow: "hidden",
        bgcolor: bgImage ? "transparent" : "grey.100",
      }}
    >
      {bgImage && (
        <>
          <Box
            component="img"
            src={bgImage}
            alt=""
            sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
          <Box sx={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(15,23,42,0.82), rgba(15,23,42,0.55), rgba(15,23,42,0.88))" }} />
        </>
      )}

      <Container maxWidth="lg" sx={{ position: "relative", zIndex: 1, py: { xs: 10, md: 14 } }}>
        <Stack spacing={3} sx={{ maxWidth: 700 }}>
          <Chip
            label={data.client.name}
            size="small"
            sx={{
              alignSelf: "flex-start",
              bgcolor: bgImage ? "rgba(255,255,255,0.12)" : "primary.50",
              color: bgImage ? "#fff" : "primary.main",
              backdropFilter: bgImage ? "blur(8px)" : undefined,
              border: bgImage ? "1px solid rgba(255,255,255,0.18)" : "1px solid",
              borderColor: bgImage ? undefined : "primary.200",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontSize: "0.65rem",
            }}
          />

          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: "2.25rem", sm: "3rem", md: "3.75rem" },
              color: bgImage ? "#fff" : "text.primary",
              lineHeight: 1.08,
            }}
          >
            {hero.title}
          </Typography>

          {hero.description && (
            <Typography
              variant="h6"
              sx={{
                color: bgImage ? "rgba(255,255,255,0.78)" : "text.secondary",
                fontWeight: 400,
                fontSize: { xs: "1rem", md: "1.15rem" },
                lineHeight: 1.65,
                maxWidth: 560,
              }}
            >
              {hero.description}
            </Typography>
          )}

          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
            {formattedDate && (
              <Chip
                icon={<CalendarTodayIcon sx={{ fontSize: 16, color: bgImage ? "rgba(255,255,255,0.7) !important" : undefined }} />}
                label={formattedDate}
                variant="outlined"
                sx={{
                  borderColor: bgImage ? "rgba(255,255,255,0.2)" : "divider",
                  color: bgImage ? "rgba(255,255,255,0.88)" : "text.primary",
                  bgcolor: bgImage ? "rgba(255,255,255,0.08)" : "background.paper",
                  backdropFilter: bgImage ? "blur(8px)" : undefined,
                }}
              />
            )}
            {hero.venueName && (
              <Chip
                icon={<PlaceIcon sx={{ fontSize: 16, color: bgImage ? "rgba(255,255,255,0.7) !important" : undefined }} />}
                label={hero.venueName}
                variant="outlined"
                sx={{
                  borderColor: bgImage ? "rgba(255,255,255,0.2)" : "divider",
                  color: bgImage ? "rgba(255,255,255,0.88)" : "text.primary",
                  bgcolor: bgImage ? "rgba(255,255,255,0.08)" : "background.paper",
                  backdropFilter: bgImage ? "blur(8px)" : undefined,
                }}
              />
            )}
          </Stack>

          <Box sx={{ pt: 1 }}>
            <Button variant="contained" size="large" sx={{ px: 5, py: 1.5, fontSize: "0.95rem" }}>
              Register Now
            </Button>
          </Box>
        </Stack>
      </Container>

      {/* Scroll hint */}
      <Box
        sx={{
          position: "absolute",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          display: { xs: "none", md: "flex" },
          flexDirection: "column",
          alignItems: "center",
          gap: 0.5,
          color: bgImage ? "rgba(255,255,255,0.35)" : "text.disabled",
          animation: "bounce 2s infinite",
          "@keyframes bounce": {
            "0%, 100%": { transform: "translateX(-50%) translateY(0)" },
            "50%": { transform: "translateX(-50%) translateY(6px)" },
          },
        }}
      >
        <Typography variant="overline" sx={{ fontSize: "0.6rem", color: "inherit" }}>Scroll</Typography>
        <KeyboardArrowDownIcon sx={{ fontSize: 20 }} />
      </Box>
    </Box>
  );
};

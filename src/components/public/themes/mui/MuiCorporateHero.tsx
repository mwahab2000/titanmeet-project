import { lazy, Suspense } from "react";
import type { PublicEventData } from "@/lib/publicSite/types";
import { Box, Container, Typography, Chip, Button, Stack } from "@mui/material";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import PlaceIcon from "@mui/icons-material/Place";
import InsightsIcon from "@mui/icons-material/Insights";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { format } from "date-fns";

const AnimatedShaderBackground = lazy(() => import("@/components/ui/animated-shader-background"));

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
        minHeight: { xs: 520, md: 640 },
        display: "flex",
        alignItems: "center",
        overflow: "hidden",
        bgcolor: "#0a0f1e",
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
          <Box sx={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(10,15,30,0.88) 0%, rgba(10,15,30,0.55) 40%, rgba(10,15,30,0.92) 100%)" }} />
        </>
      )}

      {/* Decorative gradient orbs */}
      {!bgImage && (
        <>
          <Box sx={{ position: "absolute", top: -120, right: -120, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(201,168,76,0.08), transparent 70%)" }} />
          <Box sx={{ position: "absolute", bottom: -80, left: -80, width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(59,130,246,0.06), transparent 70%)" }} />
        </>
      )}

      <Container maxWidth="lg" sx={{ position: "relative", zIndex: 1, py: { xs: 12, md: 16 } }}>
        <Stack spacing={3.5} sx={{ maxWidth: 720 }}>
          {/* Client badge */}
          <Chip
            icon={<InsightsIcon sx={{ fontSize: 14, color: "#c9a84c !important" }} />}
            label={data.client.name.toUpperCase()}
            size="small"
            sx={{
              alignSelf: "flex-start",
              bgcolor: "rgba(201,168,76,0.1)",
              color: "#c9a84c",
              border: "1px solid rgba(201,168,76,0.2)",
              fontWeight: 700,
              letterSpacing: "0.12em",
              fontSize: "0.6rem",
            }}
          />

          {/* Section label */}
          <Typography
            variant="overline"
            sx={{
              color: "#c9a84c",
              fontSize: "0.7rem",
              letterSpacing: "0.2em",
            }}
          >
            EXECUTIVE LEADERSHIP SERIES
          </Typography>

          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: "2.5rem", sm: "3.25rem", md: "4rem" },
              color: "#fff",
              lineHeight: 1.06,
            }}
          >
            {hero.title}
          </Typography>

          {hero.description && (
            <Typography
              variant="body1"
              sx={{
                color: "rgba(255,255,255,0.65)",
                fontWeight: 400,
                fontSize: { xs: "1rem", md: "1.1rem" },
                lineHeight: 1.7,
                maxWidth: 560,
              }}
            >
              {hero.description}
            </Typography>
          )}

          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
            {formattedDate && (
              <Chip
                icon={<CalendarTodayIcon sx={{ fontSize: 14, color: "rgba(255,255,255,0.5) !important" }} />}
                label={formattedDate}
                variant="outlined"
                size="small"
                sx={{
                  borderColor: "rgba(255,255,255,0.12)",
                  color: "rgba(255,255,255,0.8)",
                  bgcolor: "rgba(255,255,255,0.04)",
                }}
              />
            )}
            {hero.venueName && (
              <Chip
                icon={<PlaceIcon sx={{ fontSize: 14, color: "rgba(255,255,255,0.5) !important" }} />}
                label={hero.venueName}
                variant="outlined"
                size="small"
                sx={{
                  borderColor: "rgba(255,255,255,0.12)",
                  color: "rgba(255,255,255,0.8)",
                  bgcolor: "rgba(255,255,255,0.04)",
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
          bottom: 28,
          left: "50%",
          transform: "translateX(-50%)",
          display: { xs: "none", md: "flex" },
          flexDirection: "column",
          alignItems: "center",
          gap: 0.5,
          color: "rgba(255,255,255,0.2)",
          animation: "bounce 2s infinite",
          "@keyframes bounce": {
            "0%, 100%": { transform: "translateX(-50%) translateY(0)" },
            "50%": { transform: "translateX(-50%) translateY(6px)" },
          },
        }}
      >
        <Typography variant="overline" sx={{ fontSize: "0.55rem", color: "inherit" }}>Scroll</Typography>
        <KeyboardArrowDownIcon sx={{ fontSize: 20 }} />
      </Box>
    </Box>
  );
};

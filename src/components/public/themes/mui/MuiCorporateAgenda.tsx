import type { PublicEventData } from "@/lib/publicSite/types";
import { Container, Typography, Box, Divider, Chip, Stack, Button } from "@mui/material";
import ScheduleIcon from "@mui/icons-material/Schedule";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import DownloadIcon from "@mui/icons-material/Download";

interface Props { data: PublicEventData; }

export const MuiCorporateAgenda: React.FC<Props> = ({ data }) => {
  if (data.agenda.length === 0) return null;

  const grouped = data.agenda.reduce<Record<number, typeof data.agenda>>((acc, item) => {
    const day = item.dayNumber ?? 1;
    if (!acc[day]) acc[day] = [];
    acc[day].push(item);
    return acc;
  }, {});
  const days = Object.keys(grouped).map(Number).sort((a, b) => a - b);

  return (
    <Box component="section" id="agenda" sx={{ py: { xs: 8, md: 12 }, bgcolor: "#0a0f1e" }}>
      <Container maxWidth="lg">
        <Box sx={{ display: "flex", alignItems: "center", gap: 3, mb: 2 }}>
          <Typography variant="h3" sx={{ fontSize: { xs: "1.75rem", md: "2.25rem" }, color: "#fff" }}>Event Agenda</Typography>
          <Divider sx={{ flex: 1 }} />
        </Box>
        <Typography variant="body2" sx={{ mb: 5, color: "#6b7a90" }}>
          Structured sessions for meaningful strategic discourse.
        </Typography>

        {days.map((day) => (
          <Box key={day} sx={{ mb: 5, "&:last-child": { mb: 0 } }}>
            {days.length > 1 && (
              <Chip
                label={`Day ${day}`}
                size="small"
                sx={{ mb: 3, bgcolor: "rgba(201,168,76,0.1)", color: "#c9a84c", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: "0.6rem", border: "1px solid rgba(201,168,76,0.15)" }}
              />
            )}
            <Stack spacing={0}>
              {grouped[day].map((item, i) => (
                <Box
                  key={item.id}
                  sx={{
                    display: "flex",
                    gap: { xs: 2, sm: 3 },
                    alignItems: "flex-start",
                    py: 2.5,
                    px: 2,
                    borderBottom: i < grouped[day].length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                    borderRadius: 1,
                    transition: "background 0.2s",
                    "&:hover": { bgcolor: "rgba(255,255,255,0.02)" },
                  }}
                >
                  {(item.startTime || item.endTime) && (
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        color: "#c9a84c",
                        fontSize: "0.85rem",
                        flexShrink: 0,
                        minWidth: { xs: 90, sm: 120 },
                        mt: 0.2,
                        fontFamily: "'Inter', monospace",
                      }}
                    >
                      {item.startTime?.slice(0, 5) ?? ""}{item.endTime ? ` – ${item.endTime.slice(0, 5)}` : ""}
                    </Typography>
                  )}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "#e8e6e1", lineHeight: 1.4 }}>
                      {item.title}
                    </Typography>
                    {item.description && (
                      <Typography variant="body2" sx={{ mt: 0.5, color: "#6b7a90", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {item.description}
                      </Typography>
                    )}
                    {item.speakerName && (
                      <Typography variant="caption" sx={{ mt: 0.75, display: "block", color: "#8b95a8", fontWeight: 500 }}>
                        {item.speakerName}
                      </Typography>
                    )}
                  </Box>
                  <ArrowForwardIcon sx={{ color: "rgba(255,255,255,0.1)", fontSize: 18, mt: 0.5, flexShrink: 0 }} />
                </Box>
              ))}
            </Stack>
          </Box>
        ))}
      </Container>
    </Box>
  );
};

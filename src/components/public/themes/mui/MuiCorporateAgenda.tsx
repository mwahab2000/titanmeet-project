import type { PublicEventData } from "@/lib/publicSite/types";
import { Container, Typography, Box, Divider, Chip, Stack, Paper } from "@mui/material";
import ScheduleIcon from "@mui/icons-material/Schedule";

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
    <Box component="section" id="agenda" sx={{ py: { xs: 8, md: 12 }, bgcolor: "grey.50" }}>
      <Container maxWidth="lg">
        <Box sx={{ display: "flex", alignItems: "center", gap: 3, mb: 6 }}>
          <Typography variant="h3" sx={{ fontSize: { xs: "1.75rem", md: "2.25rem" } }}>Agenda</Typography>
          <Divider sx={{ flex: 1 }} />
        </Box>

        {days.map((day) => (
          <Box key={day} sx={{ mb: 6, "&:last-child": { mb: 0 } }}>
            {days.length > 1 && (
              <Chip
                label={`Day ${day}`}
                color="primary"
                variant="outlined"
                size="small"
                sx={{ mb: 3, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: "0.65rem" }}
              />
            )}
            <Stack spacing={1.5}>
              {grouped[day].map((item) => (
                <Paper
                  key={item.id}
                  variant="outlined"
                  sx={{
                    p: { xs: 2.5, sm: 3 },
                    display: "flex",
                    gap: { xs: 2, sm: 3 },
                    alignItems: "flex-start",
                    transition: "all 0.2s",
                    "&:hover": { borderColor: "primary.200", boxShadow: 2 },
                  }}
                >
                  {(item.startTime || item.endTime) && (
                    <Chip
                      icon={<ScheduleIcon sx={{ fontSize: 14 }} />}
                      label={`${item.startTime?.slice(0, 5) ?? ""}${item.endTime ? ` – ${item.endTime.slice(0, 5)}` : ""}`}
                      size="small"
                      sx={{
                        bgcolor: "primary.50",
                        color: "primary.dark",
                        fontWeight: 600,
                        fontSize: "0.72rem",
                        flexShrink: 0,
                        mt: 0.25,
                        "& .MuiChip-icon": { color: "primary.main" },
                      }}
                    />
                  )}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "text.primary", lineHeight: 1.4 }}>
                      {item.title}
                    </Typography>
                    {item.description && (
                      <Typography variant="body2" sx={{ mt: 0.75, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {item.description}
                      </Typography>
                    )}
                    {item.speakerName && (
                      <Typography variant="caption" sx={{ mt: 1, display: "flex", alignItems: "center", gap: 0.75, color: "primary.main", fontWeight: 600 }}>
                        <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "primary.light" }} />
                        {item.speakerName}
                      </Typography>
                    )}
                  </Box>
                </Paper>
              ))}
            </Stack>
          </Box>
        ))}
      </Container>
    </Box>
  );
};

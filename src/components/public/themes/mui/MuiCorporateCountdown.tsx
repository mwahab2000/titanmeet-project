import { useState, useEffect } from "react";
import type { PublicEventData } from "@/lib/publicSite/types";
import { Box, Container, Typography, Paper, Stack, Chip } from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import { differenceInDays, differenceInHours, differenceInMinutes, differenceInSeconds, isPast } from "date-fns";

interface Props { data: PublicEventData; }

export const MuiCorporateCountdown: React.FC<Props> = ({ data }) => {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  if (!data.hero.date) return null;
  const target = new Date(data.hero.date);
  if (isPast(target)) return null;

  const units = [
    { label: "Days", value: differenceInDays(target, now) },
    { label: "Hours", value: differenceInHours(target, now) % 24 },
    { label: "Min", value: differenceInMinutes(target, now) % 60 },
    { label: "Sec", value: differenceInSeconds(target, now) % 60 },
  ];

  return (
    <Box component="section" sx={{ py: { xs: 5, md: 8 }, bgcolor: "grey.50", borderBottom: "1px solid", borderColor: "divider" }}>
      <Container maxWidth="lg">
        <Stack alignItems="center" spacing={3}>
          <Chip
            icon={<AccessTimeIcon sx={{ fontSize: 14 }} />}
            label="EVENT STARTS IN"
            size="small"
            variant="outlined"
            sx={{ fontWeight: 700, letterSpacing: "0.15em", fontSize: "0.6rem", borderColor: "grey.300", color: "text.secondary" }}
          />
          <Stack direction="row" spacing={{ xs: 1.5, sm: 3 }}>
            {units.map((u) => (
              <Paper
                key={u.label}
                variant="outlined"
                sx={{ width: { xs: 68, sm: 84 }, py: 2, textAlign: "center", borderColor: "grey.200" }}
              >
                <Typography variant="h4" sx={{ fontWeight: 700, fontSize: { xs: "1.5rem", sm: "2rem" } }}>
                  {String(Math.max(0, u.value)).padStart(2, "0")}
                </Typography>
                <Typography variant="overline" sx={{ color: "text.secondary", fontSize: "0.6rem" }}>{u.label}</Typography>
              </Paper>
            ))}
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
};

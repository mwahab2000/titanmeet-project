import { useState, useEffect } from "react";
import type { PublicEventData } from "@/lib/publicSite/types";
import { Box, Container, Typography, Stack } from "@mui/material";
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
    <Box component="section" sx={{ py: { xs: 6, md: 9 }, bgcolor: "#0d1528", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <Container maxWidth="lg">
        <Stack alignItems="center" spacing={4}>
          <Stack direction="row" spacing={{ xs: 2, sm: 3 }}>
            {units.map((u) => (
              <Box key={u.label} sx={{ textAlign: "center" }}>
                <Typography
                  sx={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: { xs: "2.5rem", sm: "3.5rem" },
                    fontWeight: 700,
                    color: "#c9a84c",
                    lineHeight: 1,
                  }}
                >
                  {String(Math.max(0, u.value)).padStart(2, "0")}
                </Typography>
                <Typography variant="overline" sx={{ color: "#6b7a90", fontSize: "0.6rem", mt: 0.5 }}>
                  {u.label}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
};

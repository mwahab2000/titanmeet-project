import { useEffect, useRef, useState } from "react";
import type { PublicEventData } from "@/lib/publicSite/types";
import { Container, Box, Typography, Grid, Paper } from "@mui/material";
import MicIcon from "@mui/icons-material/Mic";
import EventIcon from "@mui/icons-material/Event";
import ApartmentIcon from "@mui/icons-material/Apartment";
import GroupsIcon from "@mui/icons-material/Groups";

interface Props { data: PublicEventData; }

function useCountUp(target: number, duration = 1200, trigger: boolean) {
  const [value, setValue] = useState(0);
  const ref = useRef<number>();
  useEffect(() => {
    if (!trigger || target === 0) return;
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      setValue(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) ref.current = requestAnimationFrame(step);
    };
    ref.current = requestAnimationFrame(step);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [target, duration, trigger]);
  return value;
}

export const MuiCorporateStats: React.FC<Props> = ({ data }) => {
  const [triggered, setTriggered] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setTriggered(true); obs.disconnect(); } }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const agendaDays = new Set(data.agenda.map((a) => a.dayNumber)).size;
  const stats = [
    { icon: MicIcon, label: "Speakers", value: data.speakers.length },
    { icon: EventIcon, label: "Sessions", value: data.agenda.length },
    ...(agendaDays > 1 ? [{ icon: ApartmentIcon, label: "Days", value: agendaDays }] : []),
    ...(data.organizers.length > 0 ? [{ icon: GroupsIcon, label: "Organizers", value: data.organizers.length }] : []),
  ].filter((s) => s.value > 0);

  if (stats.length < 2) return null;

  return (
    <Box ref={sectionRef} sx={{ py: { xs: 6, md: 10 } }}>
      <Container maxWidth="lg">
        <Grid container spacing={3} justifyContent="center">
          {stats.map((s) => {
            const Icon = s.icon;
            const count = useCountUp(s.value, 1200, triggered);
            return (
              <Grid size={{ xs: 6, sm: 3 }} key={s.label}>
                <Paper
                  variant="outlined"
                  sx={{ textAlign: "center", py: 4, px: 2, borderColor: "grey.200" }}
                >
                  <Box sx={{ width: 48, height: 48, borderRadius: 3, bgcolor: "primary.50", display: "inline-flex", alignItems: "center", justifyContent: "center", mb: 2 }}>
                    <Icon sx={{ color: "primary.main", fontSize: 24 }} />
                  </Box>
                  <Typography variant="h3" sx={{ fontSize: { xs: "2rem", md: "2.5rem" }, fontWeight: 700 }}>{count}</Typography>
                  <Typography variant="overline" sx={{ color: "text.secondary" }}>{s.label}</Typography>
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      </Container>
    </Box>
  );
};

import { useEffect, useRef, useState } from "react";
import type { PublicEventData } from "@/lib/publicSite/types";
import { Container, Box, Typography, Grid, Stack } from "@mui/material";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";
import EventNoteIcon from "@mui/icons-material/EventNote";
import GroupsIcon from "@mui/icons-material/Groups";
import ApartmentIcon from "@mui/icons-material/Apartment";

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
    { icon: RecordVoiceOverIcon, label: "Distinguished Speakers", value: data.speakers.length },
    { icon: EventNoteIcon, label: "Strategic Sessions", value: data.agenda.length },
    ...(agendaDays > 1 ? [{ icon: ApartmentIcon, label: "Event Days", value: agendaDays }] : []),
    ...(data.organizers.length > 0 ? [{ icon: GroupsIcon, label: "Lead Organizers", value: data.organizers.length }] : []),
  ].filter((s) => s.value > 0);

  if (stats.length < 2) return null;

  return (
    <Box ref={sectionRef} sx={{ py: { xs: 7, md: 10 }, bgcolor: "#0a0f1e" }}>
      <Container maxWidth="lg">
        <Grid container spacing={3} justifyContent="center">
          {stats.map((s) => {
            const Icon = s.icon;
            const count = useCountUp(s.value, 1200, triggered);
            return (
              <Grid size={{ xs: 6, sm: 3 }} key={s.label}>
                <Stack alignItems="center" spacing={1.5} sx={{ textAlign: "center" }}>
                  <Box sx={{
                    width: 52, height: 52, borderRadius: "50%",
                    bgcolor: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.15)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon sx={{ color: "#c9a84c", fontSize: 22 }} />
                  </Box>
                  <Typography sx={{ fontFamily: "'Playfair Display', serif", fontSize: { xs: "2rem", md: "2.5rem" }, fontWeight: 700, color: "#fff", lineHeight: 1 }}>
                    {count}
                  </Typography>
                  <Typography variant="overline" sx={{ color: "#6b7a90", fontSize: "0.55rem" }}>
                    {s.label}
                  </Typography>
                </Stack>
              </Grid>
            );
          })}
        </Grid>
      </Container>
    </Box>
  );
};

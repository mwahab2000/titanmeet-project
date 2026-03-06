import { useState, useEffect } from "react";
import type { PublicEventData } from "@/lib/publicSite/types";
import { AppBar, Toolbar, Container, Typography, Box, Button, Chip } from "@mui/material";

interface Props { data: PublicEventData; }

const sectionLinks = [
  { id: "about", label: "About" },
  { id: "agenda", label: "Agenda" },
  { id: "speakers", label: "Speakers" },
  { id: "venue", label: "Venue" },
  { id: "gallery", label: "Gallery" },
  { id: "organizers", label: "Organizers" },
];

export const MuiCorporateNav: React.FC<Props> = ({ data }) => {
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState("");

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 300);
      const sections = sectionLinks.map((l) => document.getElementById(l.id)).filter(Boolean);
      let current = "";
      for (const s of sections) if (s && s.getBoundingClientRect().top <= 120) current = s.id;
      setActive(current);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  const availableLinks = sectionLinks.filter((link) => {
    if (link.id === "about" && !data.event.description) return false;
    if (link.id === "agenda" && data.agenda.length === 0) return false;
    if (link.id === "speakers" && data.speakers.length === 0) return false;
    if (link.id === "venue" && !data.venue.name && !data.venue.address) return false;
    if (link.id === "gallery" && (!data.gallery || data.gallery.length === 0)) return false;
    if (link.id === "organizers" && data.organizers.length === 0) return false;
    return true;
  });

  if (availableLinks.length === 0) return null;

  return (
    <AppBar position="fixed" elevation={0}>
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ gap: 1, minHeight: { xs: 52 }, overflowX: "auto" }}>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 700,
              color: "#c9a84c",
              mr: 3,
              flexShrink: 0,
              display: { xs: "none", sm: "block" },
              fontSize: "0.8rem",
              letterSpacing: "0.05em",
            }}
          >
            {data.event.title}
          </Typography>
          <Box sx={{ height: 20, width: "1px", bgcolor: "rgba(255,255,255,0.1)", mr: 1, display: { xs: "none", sm: "block" } }} />
          {availableLinks.map((link) => (
            <Chip
              key={link.id}
              label={link.label}
              component="a"
              href={`#${link.id}`}
              clickable
              size="small"
              variant="outlined"
              sx={{
                fontWeight: 500,
                fontSize: "0.75rem",
                borderColor: active === link.id ? "rgba(201,168,76,0.4)" : "transparent",
                bgcolor: active === link.id ? "rgba(201,168,76,0.1)" : "transparent",
                color: active === link.id ? "#c9a84c" : "#8b95a8",
                "&:hover": { bgcolor: "rgba(255,255,255,0.05)" },
              }}
            />
          ))}
          <Box sx={{ flex: 1 }} />
          <Button variant="contained" size="small" sx={{ flexShrink: 0, display: { xs: "none", md: "inline-flex" } }}>
            Register
          </Button>
        </Toolbar>
      </Container>
    </AppBar>
  );
};

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Box, Container, Typography, IconButton, Link as MuiLink, Stack, Chip } from "@mui/material";
import CampaignIcon from "@mui/icons-material/Campaign";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: string;
  link_url: string | null;
  link_label: string | null;
  is_pinned: boolean;
}

const ROTATION_MS = 5000;

interface Props { eventId: string; }

export const MuiCorporateAnnouncementsTicker: React.FC<Props> = ({ eventId }) => {
  const [items, setItems] = useState<Announcement[]>([]);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("event_announcements" as any)
        .select("id, title, message, type, link_url, link_label, is_pinned")
        .eq("event_id", eventId)
        .eq("target", "public")
        .order("is_pinned", { ascending: false })
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });
      setItems((data as any as Announcement[]) || []);
    };
    load();
  }, [eventId]);

  const goTo = useCallback((dir: "next" | "prev") => {
    if (items.length <= 1 || animating) return;
    setAnimating(true);
    setTimeout(() => {
      setIdx(p => dir === "next" ? (p + 1) % items.length : (p - 1 + items.length) % items.length);
      setAnimating(false);
    }, 300);
  }, [items.length, animating]);

  useEffect(() => {
    if (items.length <= 1 || paused) return;
    const iv = setInterval(() => goTo("next"), ROTATION_MS);
    return () => clearInterval(iv);
  }, [items.length, paused, goTo]);

  if (items.length === 0) return null;
  const current = items[idx % items.length];
  if (!current) return null;

  return (
    <Box
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      sx={{
        borderBottom: "1px solid rgba(201,168,76,0.08)",
        bgcolor: "rgba(201,168,76,0.03)",
      }}
    >
      <Container maxWidth="lg">
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ py: 1.5 }}>
          <CampaignIcon sx={{ color: "#c9a84c", fontSize: 18, flexShrink: 0 }} />
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              transition: "opacity 0.3s, transform 0.3s",
              opacity: animating ? 0 : 1,
              transform: animating ? "translateY(-8px)" : "translateY(0)",
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" sx={{ fontWeight: 600, color: "#e8e6e1" }}>{current.title}</Typography>
              {current.is_pinned && <Chip label="Pinned" size="small" sx={{ height: 18, fontSize: 10, bgcolor: "rgba(201,168,76,0.1)", color: "#c9a84c" }} />}
            </Stack>
            <Typography variant="caption" sx={{ display: "block", color: "#6b7a90" }} noWrap>
              {current.message}
            </Typography>
          </Box>
          {current.link_url && (
            <MuiLink href={current.link_url} target="_blank" rel="noopener" underline="hover" sx={{ fontSize: 12, display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0, color: "#c9a84c" }}>
              {current.link_label || "Learn more"} <OpenInNewIcon sx={{ fontSize: 12 }} />
            </MuiLink>
          )}
          {items.length > 1 && (
            <Stack direction="row" alignItems="center" spacing={0}>
              <IconButton size="small" onClick={() => goTo("prev")} sx={{ color: "#6b7a90" }}><ChevronLeftIcon sx={{ fontSize: 16 }} /></IconButton>
              <Typography variant="caption" sx={{ minWidth: 28, textAlign: "center", color: "#6b7a90" }}>{idx + 1}/{items.length}</Typography>
              <IconButton size="small" onClick={() => goTo("next")} sx={{ color: "#6b7a90" }}><ChevronRightIcon sx={{ fontSize: 16 }} /></IconButton>
            </Stack>
          )}
        </Stack>
      </Container>
    </Box>
  );
};

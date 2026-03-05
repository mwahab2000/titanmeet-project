import type { PublicEventData } from "@/lib/publicSite/types";
import { Container, Box, Paper, Typography, Stack } from "@mui/material";
import CampaignIcon from "@mui/icons-material/Campaign";

interface Props { data: PublicEventData; }

export const MuiCorporateAnnouncements: React.FC<Props> = ({ data }) => {
  if (data.announcements.length === 0) return null;
  return (
    <Box component="section" sx={{ py: 4 }}>
      <Container maxWidth="lg">
        <Paper
          variant="outlined"
          sx={{ p: { xs: 3, sm: 4 }, bgcolor: "primary.50", borderColor: "primary.100" }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: "primary.100", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CampaignIcon sx={{ color: "primary.main", fontSize: 18 }} />
            </Box>
            <Typography variant="overline" sx={{ color: "primary.dark" }}>Announcements</Typography>
          </Stack>
          <Stack spacing={1.5} sx={{ pl: 6 }}>
            {data.announcements.map((a) => (
              <Box key={a.id} sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "primary.light", mt: 1, flexShrink: 0 }} />
                <Typography variant="body2" sx={{ color: "text.primary" }}>{a.text}</Typography>
              </Box>
            ))}
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
};

import type { PublicEventData, PublicTransportRoute } from "@/lib/publicSite/types";
import { Container, Box, Typography, Divider, Card, CardContent, Chip, Stack, Paper } from "@mui/material";
import DirectionsBusIcon from "@mui/icons-material/DirectionsBus";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import PlaceIcon from "@mui/icons-material/Place";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

interface Props { data: PublicEventData; }

export const MuiCorporateTransport: React.FC<Props> = ({ data }) => {
  const { transport } = data;
  if (!transport.enabled || transport.routes.length === 0) return null;
  const hasDays = transport.routes.some((r) => r.dayNumber && r.dayNumber > 0);

  return (
    <Box component="section" id="transport" sx={{ py: { xs: 8, md: 12 }, bgcolor: "grey.50" }}>
      <Container maxWidth="lg">
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
          <Box sx={{ width: 44, height: 44, borderRadius: 2.5, bgcolor: "primary.50", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <DirectionsBusIcon sx={{ color: "primary.main" }} />
          </Box>
          <Typography variant="h3" sx={{ fontSize: { xs: "1.75rem", md: "2.25rem" } }}>Transportation</Typography>
          <Divider sx={{ flex: 1 }} />
        </Box>

        {transport.meetupTime && (
          <Typography variant="body2" sx={{ mb: 3, ml: 7, display: "flex", alignItems: "center", gap: 1 }}>
            <AccessTimeIcon sx={{ fontSize: 16 }} /> Meetup time: {transport.meetupTime}
          </Typography>
        )}

        {transport.generalInstructions && (
          <Paper variant="outlined" sx={{ p: 2.5, mb: 4, bgcolor: "primary.50", borderColor: "primary.100", display: "flex", gap: 1.5, alignItems: "flex-start" }}>
            <InfoOutlinedIcon sx={{ fontSize: 18, color: "primary.main", mt: 0.25 }} />
            <Typography variant="body2">{transport.generalInstructions}</Typography>
          </Paper>
        )}

        <Stack spacing={3}>
          {transport.routes.map((route) => (
            <RouteCard key={route.id} route={route} showDay={hasDays} />
          ))}
        </Stack>
      </Container>
    </Box>
  );
};

const RouteCard: React.FC<{ route: PublicTransportRoute; showDay: boolean }> = ({ route, showDay }) => (
  <Card variant="outlined">
    <CardContent sx={{ p: 3 }}>
      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: route.stops.length > 0 ? 3 : 0 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "text.primary" }}>{route.name}</Typography>
        {showDay && route.dayNumber && <Chip label={`Day ${route.dayNumber}`} size="small" color="primary" variant="outlined" sx={{ fontWeight: 700, fontSize: "0.6rem", letterSpacing: "0.08em", textTransform: "uppercase" }} />}
        {route.departureTime && <Chip icon={<AccessTimeIcon sx={{ fontSize: 13 }} />} label={route.departureTime.slice(0, 5)} size="small" sx={{ bgcolor: "grey.100" }} />}
        {route.vehicleType && <Chip label={route.vehicleType} size="small" sx={{ bgcolor: "grey.100", textTransform: "capitalize" }} />}
      </Stack>
      {route.notes && <Typography variant="body2" sx={{ mb: 2 }}>{route.notes}</Typography>}
      {route.stops.length > 0 && (
        <Box sx={{ pl: 2, borderLeft: "2px solid", borderColor: "divider" }}>
          <Stack spacing={2}>
            {route.stops.map((stop) => (
              <Box key={stop.id}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>{stop.name}</Typography>
                  {stop.pickupTime && <Chip label={stop.pickupTime} size="small" sx={{ height: 20, fontSize: "0.65rem", bgcolor: "grey.100" }} />}
                  <Chip label={stop.stopType === "dropoff" ? "Drop-off" : "Pickup"} size="small" color={stop.stopType === "dropoff" ? "error" : "primary"} variant="outlined" sx={{ height: 20, fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase" }} />
                </Stack>
                {stop.address && <Typography variant="caption" sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5, color: "text.secondary" }}><PlaceIcon sx={{ fontSize: 12 }} /> {stop.address}</Typography>}
                {stop.mapUrl && <Typography variant="caption" component="a" href={stop.mapUrl} target="_blank" rel="noopener noreferrer" sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.25, color: "primary.main", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}><OpenInNewIcon sx={{ fontSize: 12 }} /> View on Map</Typography>}
                {stop.notes && <Typography variant="caption" sx={{ color: "text.disabled", mt: 0.25, display: "block" }}>{stop.notes}</Typography>}
              </Box>
            ))}
          </Stack>
        </Box>
      )}
    </CardContent>
  </Card>
);

import type { PublicEventData, PublicTransportRoute } from "@/lib/publicSite/types";
import { Container, Box, Typography, Divider, Card, CardContent, Chip, Stack, Paper } from "@mui/material";
import CommuteIcon from "@mui/icons-material/Commute";
import FlightTakeoffIcon from "@mui/icons-material/FlightTakeoff";
import HotelIcon from "@mui/icons-material/Hotel";
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
    <Box component="section" id="transport" sx={{ py: { xs: 8, md: 12 }, bgcolor: "#0d1528" }}>
      <Container maxWidth="lg">
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
          <CommuteIcon sx={{ color: "#c9a84c", fontSize: 28 }} />
          <Typography variant="h3" sx={{ fontSize: { xs: "1.75rem", md: "2.25rem" }, color: "#fff" }}>Logistics</Typography>
          <Divider sx={{ flex: 1 }} />
        </Box>

        {transport.generalInstructions && (
          <Paper variant="outlined" sx={{ p: 2.5, mb: 4, bgcolor: "rgba(201,168,76,0.04)", borderColor: "rgba(201,168,76,0.12)", display: "flex", gap: 1.5, alignItems: "flex-start" }}>
            <InfoOutlinedIcon sx={{ fontSize: 18, color: "#c9a84c", mt: 0.25 }} />
            <Typography variant="body2" sx={{ color: "#8b95a8" }}>{transport.generalInstructions}</Typography>
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

const RouteCard: React.FC<{ route: PublicTransportRoute; showDay: boolean }> = ({ route, showDay }) => {
  const isPickup = route.stops.some(s => s.stopType === "pickup");
  const RouteIcon = isPickup ? FlightTakeoffIcon : HotelIcon;

  return (
    <Card variant="outlined" sx={{ bgcolor: "#111b30", borderColor: "rgba(255,255,255,0.06)" }}>
      <CardContent sx={{ p: 3 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: route.stops.length > 0 ? 3 : 0 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: "rgba(201,168,76,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <RouteIcon sx={{ color: "#c9a84c", fontSize: 20 }} />
          </Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "#e8e6e1" }}>{route.name}</Typography>
          {showDay && route.dayNumber && <Chip label={`Day ${route.dayNumber}`} size="small" sx={{ bgcolor: "rgba(201,168,76,0.1)", color: "#c9a84c", fontWeight: 700, fontSize: "0.6rem", letterSpacing: "0.08em", textTransform: "uppercase" }} />}
          {route.departureTime && <Chip icon={<AccessTimeIcon sx={{ fontSize: 13, color: "#8b95a8 !important" }} />} label={route.departureTime.slice(0, 5)} size="small" sx={{ bgcolor: "rgba(255,255,255,0.04)", color: "#8b95a8" }} />}
          {route.vehicleType && <Chip label={route.vehicleType} size="small" sx={{ bgcolor: "rgba(255,255,255,0.04)", color: "#8b95a8", textTransform: "capitalize" }} />}
        </Stack>
        {route.notes && <Typography variant="body2" sx={{ mb: 2, color: "#6b7a90" }}>{route.notes}</Typography>}
        {route.stops.length > 0 && (
          <Box sx={{ pl: 2, borderLeft: "2px solid rgba(201,168,76,0.15)" }}>
            <Stack spacing={2}>
              {route.stops.map((stop) => (
                <Box key={stop.id}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography variant="body2" sx={{ fontWeight: 500, color: "#e8e6e1" }}>{stop.name}</Typography>
                    {stop.pickupTime && <Chip label={stop.pickupTime} size="small" sx={{ height: 20, fontSize: "0.65rem", bgcolor: "rgba(255,255,255,0.04)", color: "#8b95a8" }} />}
                    <Chip label={stop.stopType === "dropoff" ? "Drop-off" : "Pickup"} size="small" variant="outlined" sx={{ height: 20, fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", borderColor: stop.stopType === "dropoff" ? "rgba(239,68,68,0.3)" : "rgba(201,168,76,0.3)", color: stop.stopType === "dropoff" ? "#ef4444" : "#c9a84c" }} />
                  </Stack>
                  {stop.address && <Typography variant="caption" sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5, color: "#6b7a90" }}><PlaceIcon sx={{ fontSize: 12 }} /> {stop.address}</Typography>}
                  {stop.mapUrl && <Typography variant="caption" component="a" href={stop.mapUrl} target="_blank" rel="noopener noreferrer" sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.25, color: "#c9a84c", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}><OpenInNewIcon sx={{ fontSize: 12 }} /> View on Map</Typography>}
                  {stop.notes && <Typography variant="caption" sx={{ color: "#4a5568", mt: 0.25, display: "block" }}>{stop.notes}</Typography>}
                </Box>
              ))}
            </Stack>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

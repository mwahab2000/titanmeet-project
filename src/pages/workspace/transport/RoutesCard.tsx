import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Plus, Trash2, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import SortableStopRow from "./SortableStopRow";

const DAYS = Array.from({ length: 9 }, (_, i) => i + 1);
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export interface TransportRoute {
  id: string;
  event_id: string;
  name: string;
  day_number: number | null;
  vehicle_type: string | null;
  capacity: number | null;
  departure_time: string | null;
  driver_name: string | null;
  driver_mobile: string | null;
  notes: string | null;
}

export interface TransportStop {
  id: string;
  event_id: string;
  route_id: string | null;
  name: string;
  stop_type: string;
  address: string | null;
  destination: string | null;
  pickup_time: string | null;
  notes: string | null;
  order_index: number;
  map_url: string | null;
}

interface NewRowState {
  hour: string;
  name: string;
  stop_type: string;
  notes: string;
}

const emptyNewRow = (): NewRowState => ({ hour: "", name: "", stop_type: "pickup", notes: "" });

interface Props {
  eventId: string;
  disabled: boolean;
  routes: TransportRoute[];
  stops: TransportStop[];
  reload: () => void;
}

const RoutesCard = ({ eventId, disabled, routes, stops, reload }: Props) => {
  const [newRouteName, setNewRouteName] = useState("");
  const [openRoutes, setOpenRoutes] = useState<Record<string, boolean>>({});
  const [newRows, setNewRows] = useState<Record<string, NewRowState>>({});
  const [localDays, setLocalDays] = useState<Record<string, string>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const toggleRoute = (id: string) => setOpenRoutes(prev => ({ ...prev, [id]: !prev[id] }));

  const handleDragEnd = async (routeId: string, routeStops: TransportStop[], event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = routeStops.findIndex(s => s.id === active.id);
    const newIndex = routeStops.findIndex(s => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(routeStops, oldIndex, newIndex);
    const updates = reordered.map((s, i) => 
      supabase.from("transport_pickup_points" as any).update({ order_index: i }).eq("id", s.id)
    );
    await Promise.all(updates);
    reload();
  };

  const getNewRow = (routeId: string) => newRows[routeId] || emptyNewRow();
  const setNewRow = (routeId: string, patch: Partial<NewRowState>) =>
    setNewRows(prev => ({ ...prev, [routeId]: { ...getNewRow(routeId), ...patch } }));

  const addRoute = async () => {
    if (!newRouteName.trim()) return;
    const { error } = await supabase.from("transport_routes" as any).insert({ event_id: eventId, name: newRouteName.trim() });
    if (error) toast.error(error.message);
    else { setNewRouteName(""); reload(); }
  };

  const updateRoute = async (id: string, field: string, value: any) => {
    const { error } = await supabase.from("transport_routes" as any).update({ [field]: value }).eq("id", id);
    if (error) toast.error(error.message);
  };

  const removeRoute = async (id: string) => {
    await supabase.from("transport_routes" as any).delete().eq("id", id);
    reload();
  };

  const saveNewRow = async (routeId: string) => {
    const row = getNewRow(routeId);
    if (!row.name.trim()) return;
    const routeStops = stops.filter(s => s.route_id === routeId);
    const pickupTime = row.hour !== "" ? `${row.hour.padStart(2, "0")}:00` : null;
    const { error } = await supabase.from("transport_pickup_points" as any).insert({
      event_id: eventId,
      route_id: routeId,
      name: row.name.trim(),
      stop_type: row.stop_type,
      pickup_time: pickupTime,
      notes: row.notes || null,
      order_index: routeStops.length,
    });
    if (error) toast.error(error.message);
    else {
      setNewRows(prev => ({ ...prev, [routeId]: emptyNewRow() }));
      reload();
    }
  };

  const updateStop = async (id: string, field: string, value: any) => {
    const { error } = await supabase.from("transport_pickup_points" as any).update({ [field]: value }).eq("id", id);
    if (error) toast.error(error.message);
  };

  const removeStop = async (id: string) => {
    await supabase.from("transport_pickup_points" as any).delete().eq("id", id);
    reload();
  };

  const compactSelect = "h-7 text-xs border-0 shadow-none bg-transparent px-1 focus:ring-1 focus:ring-primary rounded-none";
  const compactInput = "h-7 text-xs border-0 shadow-none bg-transparent px-1 focus:ring-1 focus:ring-primary rounded-none";

  return (
    <div className="space-y-4">
      {routes.map(route => {
        const routeStops = stops.filter(s => s.route_id === route.id).sort((a, b) => a.order_index - b.order_index);
        const isOpen = openRoutes[route.id] ?? true;
        const newRow = getNewRow(route.id);

        return (
          <Card key={route.id}>
            <Collapsible open={isOpen} onOpenChange={() => toggleRoute(route.id)}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CollapsibleTrigger className="flex items-center gap-2 cursor-pointer">
                    <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-0" : "-rotate-90"}`} />
                    <CardTitle className="font-display text-lg">Route</CardTitle>
                  </CollapsibleTrigger>
                  {!disabled && (
                    <Button variant="ghost" size="icon" onClick={() => removeRoute(route.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Day</Label>
                    <Select
                      value={localDays[route.id] ?? (route.day_number ? String(route.day_number) : "none")}
                      onValueChange={v => {
                        setLocalDays(prev => ({ ...prev, [route.id]: v }));
                        updateRoute(route.id, "day_number", v === "none" ? null : Number(v));
                      }}
                      disabled={disabled}
                    >
                      <SelectTrigger><SelectValue placeholder="Select day" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {DAYS.map(d => <SelectItem key={d} value={String(d)}>Day {d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-1 lg:col-span-3">
                    <Label className="text-xs text-muted-foreground">Route Title</Label>
                    <Input
                      defaultValue={route.name}
                      placeholder="e.g. People Arriving at the Airport"
                      disabled={disabled}
                      onBlur={e => { if (e.target.value !== route.name) updateRoute(route.id, "name", e.target.value); }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Vehicle Type</Label>
                    <Input
                      defaultValue={route.vehicle_type || ""}
                      placeholder="e.g. Bus, Van"
                      disabled={disabled}
                      onBlur={e => { const v = e.target.value || null; if (v !== route.vehicle_type) updateRoute(route.id, "vehicle_type", v); }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Capacity</Label>
                    <Input
                      type="number"
                      defaultValue={route.capacity ?? ""}
                      placeholder="e.g. 40"
                      disabled={disabled}
                      onBlur={e => { const v = e.target.value ? Number(e.target.value) : null; if (v !== route.capacity) updateRoute(route.id, "capacity", v); }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Driver Name</Label>
                    <Input
                      defaultValue={route.driver_name || ""}
                      placeholder="Driver name"
                      disabled={disabled}
                      onBlur={e => { const v = e.target.value || null; if (v !== route.driver_name) updateRoute(route.id, "driver_name", v); }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Driver Mobile</Label>
                    <Input
                      defaultValue={route.driver_mobile || ""}
                      placeholder="+1 234 567 890"
                      disabled={disabled}
                      onBlur={e => { const v = e.target.value || null; if (v !== route.driver_mobile) updateRoute(route.id, "driver_mobile", v); }}
                    />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <Label className="text-xs text-muted-foreground">Notes</Label>
                    <Input
                      defaultValue={route.notes || ""}
                      placeholder="Route notes…"
                      disabled={disabled}
                      onBlur={e => { const v = e.target.value || null; if (v !== route.notes) updateRoute(route.id, "notes", v); }}
                    />
                  </div>
                </div>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    modifiers={[restrictToVerticalAxis]}
                    onDragEnd={(event) => handleDragEnd(route.id, routeStops, event)}
                  >
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 border-b border-border">
                        {!disabled && <TableHead className="w-6 py-1 px-0.5 text-[10px]" />}
                        <TableHead className="w-8 py-1 px-1 text-[10px] font-semibold text-center">#</TableHead>
                        <TableHead className="w-20 py-1 px-0.5 text-[10px] font-semibold">Hour</TableHead>
                        <TableHead className="py-1 px-0.5 text-[10px] font-semibold">Stop Name</TableHead>
                        <TableHead className="w-24 py-1 px-0.5 text-[10px] font-semibold">Type</TableHead>
                        <TableHead className="py-1 px-0.5 text-[10px] font-semibold">Notes</TableHead>
                        {!disabled && <TableHead className="w-8 py-1 px-0.5" />}
                      </TableRow>
                    </TableHeader>
                    <SortableContext items={routeStops.map(s => s.id)} strategy={verticalListSortingStrategy}>
                    <TableBody>
                      {routeStops.map((stop, idx) => (
                        <SortableStopRow
                          key={stop.id}
                          stop={stop}
                          index={idx}
                          disabled={disabled}
                          updateStop={updateStop}
                          removeStop={removeStop}
                        />
                      ))}

                      {!disabled && (
                        <TableRow className="bg-muted/20 border-b border-border/50">
                          <TableCell className="py-0 px-0.5" />
                          <TableCell className="text-[11px] text-muted-foreground py-0 px-1 text-center">+</TableCell>
                          <TableCell className="py-0 px-0.5">
                            <Select
                              value={newRow.hour || "none"}
                              onValueChange={v => setNewRow(route.id, { hour: v === "none" ? "" : v })}
                            >
                              <SelectTrigger className={compactSelect}><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">—</SelectItem>
                                {HOURS.map(h => <SelectItem key={h} value={String(h)}>{String(h).padStart(2, "0")}:00</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="py-0 px-0.5">
                            <Input
                              value={newRow.name}
                              className={compactInput}
                              placeholder="Stop name…"
                              onChange={e => setNewRow(route.id, { name: e.target.value })}
                              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); saveNewRow(route.id); } }}
                            />
                          </TableCell>
                          <TableCell className="py-0 px-0.5">
                            <Select
                              value={newRow.stop_type}
                              onValueChange={v => setNewRow(route.id, { stop_type: v })}
                            >
                              <SelectTrigger className={compactSelect}><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pickup">Pickup</SelectItem>
                                <SelectItem value="dropoff">Dropoff</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="py-0 px-0.5">
                            <Input
                              value={newRow.notes}
                              className={compactInput}
                              placeholder="Notes…"
                              onChange={e => setNewRow(route.id, { notes: e.target.value })}
                              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); saveNewRow(route.id); } }}
                            />
                          </TableCell>
                          <TableCell className="py-0 px-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              disabled={!newRow.name.trim()}
                              onClick={() => saveNewRow(route.id)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                    </SortableContext>
                  </Table>
                  </DndContext>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        );
      })}

      {!disabled && (
        <div className="flex items-center gap-3 rounded-lg border border-dashed border-border p-3">
          <Input
            value={newRouteName}
            onChange={e => setNewRouteName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addRoute(); } }}
            placeholder="Type route name and press Enter…"
            className="flex-1"
          />
          <Button size="sm" variant="outline" className="gap-1" onClick={addRoute} disabled={!newRouteName.trim()}>
            <Plus className="h-4 w-4" /> Add Route
          </Button>
        </div>
      )}
    </div>
  );
};

export default RoutesCard;

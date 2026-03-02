import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GripVertical, Trash2 } from "lucide-react";
import { TransportStop } from "./RoutesCard";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function parseHour(val: string | null): string {
  if (!val) return "";
  const match = val.match(/(\d{1,2}):/);
  return match ? String(parseInt(match[1], 10)) : "";
}

function buildTime(hour: string): string | null {
  if (hour === "") return null;
  return `${hour.padStart(2, "0")}:00`;
}

interface Props {
  stop: TransportStop;
  index: number;
  disabled: boolean;
  updateStop: (id: string, field: string, value: any) => void;
  removeStop: (id: string) => void;
}

const compactSelect = "h-7 text-xs border-0 shadow-none bg-transparent px-1 focus:ring-1 focus:ring-primary rounded-none";
const compactInput = "h-7 text-xs border-0 shadow-none bg-transparent px-1 focus:ring-1 focus:ring-primary rounded-none";

const SortableStopRow = ({ stop, index, disabled, updateStop, removeStop }: Props) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stop.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [localHour, setLocalHour] = useState<string | null>(null);
  const [localType, setLocalType] = useState<string | null>(null);

  const hour = localHour ?? parseHour(stop.pickup_time);
  const stopType = localType ?? stop.stop_type;

  return (
    <TableRow ref={setNodeRef} style={style} className={`border-b border-border/50 hover:bg-muted/30 ${index % 2 === 1 ? "bg-muted/20" : ""}`}>
      {!disabled && (
        <TableCell className="py-0 px-0.5 w-6">
          <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-0.5 text-muted-foreground hover:text-foreground">
            <GripVertical className="h-3 w-3" />
          </button>
        </TableCell>
      )}
      <TableCell className="text-[11px] text-muted-foreground py-0 px-1 w-8 text-center">{index + 1}</TableCell>
      <TableCell className="py-0 px-0.5">
        <Select
          value={hour !== "" ? hour : "none"}
          onValueChange={v => {
            const newHour = v === "none" ? "" : v;
            setLocalHour(newHour);
            updateStop(stop.id, "pickup_time", buildTime(newHour));
          }}
          disabled={disabled}
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
          defaultValue={stop.name}
          className={compactInput}
          disabled={disabled}
          onBlur={e => { if (e.target.value !== stop.name) updateStop(stop.id, "name", e.target.value); }}
        />
      </TableCell>
      <TableCell className="py-0 px-0.5">
        <Select
          value={stopType}
          onValueChange={v => {
            setLocalType(v);
            updateStop(stop.id, "stop_type", v);
          }}
          disabled={disabled}
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
          defaultValue={stop.notes || ""}
          className={compactInput}
          disabled={disabled}
          placeholder="Notes…"
          onBlur={e => updateStop(stop.id, "notes", e.target.value || null)}
        />
      </TableCell>
      {!disabled && (
        <TableCell className="py-0 px-0.5">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeStop(stop.id)}>
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
        </TableCell>
      )}
    </TableRow>
  );
};

export default SortableStopRow;

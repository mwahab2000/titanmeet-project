import { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEventWorkspace } from "@/contexts/EventWorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SectionHint } from "@/components/ui/section-hint";

interface Organizer {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  mobile: string | null;
  _isNew?: boolean;
}

const FIELDS = ["name", "role", "email", "mobile"] as const;
type Field = (typeof FIELDS)[number];

const DEBOUNCE_MS = 1500;

const OrganizersSection = () => {
  const { event, isArchived } = useEventWorkspace();
  const [items, setItems] = useState<Organizer[]>([]);
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const cellRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = useCallback(async () => {
    if (!event) return;
    const { data } = await supabase.from("organizers").select("*").eq("event_id", event.id);
    const rows = (data as Organizer[]) || [];
    // Always ensure one empty row at the bottom for new entry
    if (!isArchived) {
      rows.push(createEmptyRow());
    }
    setItems(rows);
  }, [event?.id, isArchived]);

  useEffect(() => {
    load();
    return () => {
      // Flush pending timers on unmount
      Object.values(timersRef.current).forEach(clearTimeout);
    };
  }, [load]);

  function createEmptyRow(): Organizer {
    return { id: `temp-${Date.now()}-${Math.random()}`, name: "", role: null, email: null, mobile: null, _isNew: true };
  }

  const isRowEmpty = (o: Organizer) => !o.name && !o.role && !o.email && !o.mobile;

  const persistRow = async (organizer: Organizer) => {
    if (!event) return null;
    const { data, error } = await supabase
      .from("organizers")
      .insert({ event_id: event.id, name: organizer.name || "", role: organizer.role, email: organizer.email, mobile: organizer.mobile } as any)
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return null;
    }
    return data as unknown as Organizer;
  };

  const saveField = async (id: string, field: Field, value: string) => {
    await supabase.from("organizers").update({ [field]: value || null } as any).eq("id", id);
  };

  const handleChange = (rowIndex: number, field: Field, value: string) => {
    setItems(prev => {
      const updated = [...prev];
      const item = { ...updated[rowIndex] };
      (item as any)[field] = value;
      updated[rowIndex] = item;
      return updated;
    });

    const item = items[rowIndex];
    const timerKey = `${item.id}-${field}`;

    if (timersRef.current[timerKey]) clearTimeout(timersRef.current[timerKey]);

    timersRef.current[timerKey] = setTimeout(async () => {
      const current = items[rowIndex];
      // If it's a new row, persist it first
      if (current._isNew || current.id.startsWith("temp-")) {
        const updatedItem = { ...current, [field]: value };
        if (isRowEmpty(updatedItem)) return;

        const saved = await persistRow(updatedItem);
        if (saved) {
          setItems(prev => {
            const next = prev.map((o, i) => (i === rowIndex ? { ...saved } : o));
            // Add new empty row if the last row is no longer empty
            const last = next[next.length - 1];
            if (!last?._isNew && !last?.id.startsWith("temp-")) {
              next.push(createEmptyRow());
            }
            return next;
          });
        }
      } else {
        saveField(current.id, field, value);
      }
    }, DEBOUNCE_MS);
  };

  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
    const totalRows = items.length;
    const totalCols = FIELDS.length;

    if (e.key === "Tab") {
      e.preventDefault();
      const next = e.shiftKey
        ? { row: colIndex === 0 ? Math.max(0, rowIndex - 1) : rowIndex, col: colIndex === 0 ? totalCols - 1 : colIndex - 1 }
        : { row: colIndex === totalCols - 1 ? Math.min(totalRows - 1, rowIndex + 1) : rowIndex, col: colIndex === totalCols - 1 ? 0 : colIndex + 1 };
      focusCell(next.row, next.col);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (rowIndex < totalRows - 1) focusCell(rowIndex + 1, colIndex);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (rowIndex < totalRows - 1) focusCell(rowIndex + 1, colIndex);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (rowIndex > 0) focusCell(rowIndex - 1, colIndex);
    }
  };

  const focusCell = (row: number, col: number) => {
    setActiveCell({ row, col });
    const ref = cellRefs.current[`${row}-${col}`];
    ref?.focus();
  };

  const remove = async (id: string, rowIndex: number) => {
    if (id.startsWith("temp-")) {
      setItems(prev => prev.filter((_, i) => i !== rowIndex));
      return;
    }
    await supabase.from("organizers").delete().eq("id", id);
    setItems(prev => {
      const next = prev.filter((_, i) => i !== rowIndex);
      // Ensure there's always an empty row
      const last = next[next.length - 1];
      if (!last?._isNew && !last?.id.startsWith("temp-")) {
        next.push(createEmptyRow());
      }
      return next;
    });
  };

  if (!event) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-display flex items-center gap-2">
          <Users className="h-5 w-5" /> Organizers
        </CardTitle>
        <span className="text-xs text-muted-foreground">
          {items.filter(o => !o._isNew && !o.id.startsWith("temp-")).length} organizer(s)
        </span>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[30px] text-center text-xs font-semibold">#</TableHead>
                <TableHead className="text-xs font-semibold">Name</TableHead>
                <TableHead className="text-xs font-semibold">Role</TableHead>
                <TableHead className="text-xs font-semibold">Email</TableHead>
                <TableHead className="text-xs font-semibold">Mobile</TableHead>
                <TableHead className="w-[40px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((o, rowIndex) => {
                const isTemp = o._isNew || o.id.startsWith("temp-");
                return (
                  <TableRow
                    key={o.id}
                    className={cn(
                      "group transition-colors",
                      isTemp && "bg-muted/20"
                    )}
                  >
                    <TableCell className="text-center text-xs text-muted-foreground font-mono tabular-nums p-1">
                      {isTemp ? "+" : rowIndex + 1}
                    </TableCell>
                    {FIELDS.map((field, colIndex) => (
                      <TableCell key={field} className="p-0">
                        <input
                          ref={el => { cellRefs.current[`${rowIndex}-${colIndex}`] = el; }}
                          className={cn(
                            "w-full bg-transparent px-3 py-2 text-sm outline-none border-0",
                            "focus:bg-primary/5 focus:ring-1 focus:ring-primary/30 focus:ring-inset",
                            "transition-colors",
                            isArchived && "pointer-events-none opacity-60",
                            field === "name" && "font-medium"
                          )}
                          value={(o as any)[field] || ""}
                          onChange={e => handleChange(rowIndex, field, e.target.value)}
                          onFocus={() => setActiveCell({ row: rowIndex, col: colIndex })}
                          onKeyDown={e => handleKeyDown(e, rowIndex, colIndex)}
                          disabled={isArchived}
                          placeholder={isTemp ? `Add ${field}…` : ""}
                        />
                      </TableCell>
                    ))}
                    <TableCell className="p-1">
                      {!isArchived && !isRowEmpty(o) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => remove(o.id, rowIndex)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {!isArchived && (
          <p className="text-[11px] text-muted-foreground px-4 py-2 border-t border-border">
            Tab / Enter to navigate • Changes auto-save after {DEBOUNCE_MS / 1000}s
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default OrganizersSection;

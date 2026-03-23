import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Trash2, Brain, Sparkles, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface MemoryEntry {
  id: string;
  memory_type: string;
  key: string;
  value: Record<string, unknown>;
  confidence_score: number;
  usage_count: number;
  source: string;
  is_active: boolean;
  last_used_at: string;
  created_at: string;
}

const memoryTypeLabels: Record<string, string> = {
  preference: "Preference",
  pattern: "Pattern",
  context: "Context",
};

const memoryTypeColors: Record<string, string> = {
  preference: "bg-primary/10 text-primary",
  pattern: "bg-accent/10 text-accent-foreground",
  context: "bg-muted text-muted-foreground",
};

function confidenceLabel(score: number): string {
  if (score >= 0.8) return "Strong";
  if (score >= 0.5) return "Moderate";
  return "Weak";
}

function confidenceColor(score: number): string {
  if (score >= 0.8) return "text-green-600 dark:text-green-400";
  if (score >= 0.5) return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

function formatValue(value: Record<string, unknown>): string {
  if (value.display) return String(value.display);
  if (value.value) return String(value.value);
  const entries = Object.entries(value).filter(([k]) => k !== "type");
  if (entries.length === 1) return String(entries[0][1]);
  return entries.map(([k, v]) => `${k}: ${v}`).join(", ");
}

export function AIMemorySettings() {
  const { user } = useAuth();
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [memoryEnabled, setMemoryEnabled] = useState(true);

  const fetchMemories = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("ai_user_memory")
      .select("*")
      .eq("user_id", user.id)
      .order("last_used_at", { ascending: false });
    setMemories((data as MemoryEntry[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchMemories();
    try {
      const saved = localStorage.getItem("titanmeet_memory_enabled");
      if (saved !== null) setMemoryEnabled(saved !== "false");
    } catch {}
  }, [fetchMemories]);

  const toggleMemoryEnabled = (enabled: boolean) => {
    setMemoryEnabled(enabled);
    try { localStorage.setItem("titanmeet_memory_enabled", String(enabled)); } catch {}
    toast.success(enabled ? "AI memory enabled" : "AI memory disabled");
  };

  const deleteMemory = async (id: string) => {
    const { error } = await supabase.from("ai_user_memory").delete().eq("id", id);
    if (error) { toast.error("Failed to delete memory"); return; }
    setMemories(prev => prev.filter(m => m.id !== id));
    toast.success("Memory removed");
  };

  const clearAllMemories = async () => {
    if (!user) return;
    const { error } = await supabase.from("ai_user_memory").delete().eq("user_id", user.id);
    if (error) { toast.error("Failed to clear memories"); return; }
    setMemories([]);
    toast.success("All AI memories cleared");
  };

  const activeMemories = memories.filter(m => m.is_active);
  const preferenceCount = activeMemories.filter(m => m.memory_type === "preference").length;
  const patternCount = activeMemories.filter(m => m.memory_type === "pattern").length;
  const contextCount = activeMemories.filter(m => m.memory_type === "context").length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="font-display text-lg">AI Preferences & Memory</CardTitle>
              <CardDescription>AI Builder learns from your workflow to suggest better defaults</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="memory-toggle" className="text-sm text-muted-foreground">Memory</Label>
            <Switch id="memory-toggle" checked={memoryEnabled} onCheckedChange={toggleMemoryEnabled} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!memoryEnabled && (
          <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
            AI memory is disabled. AI Builder will not learn from your interactions or suggest personalized defaults.
          </div>
        )}

        {memoryEnabled && (
          <>
            {/* Summary */}
            <div className="flex flex-wrap gap-3 text-sm">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-muted-foreground">{preferenceCount} preferences</span>
              </div>
              <div className="flex items-center gap-1.5">
                <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">{patternCount} patterns</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Brain className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">{contextCount} context items</span>
              </div>
            </div>

            {/* Memories list */}
            {loading ? (
              <div className="text-sm text-muted-foreground py-4">Loading memories...</div>
            ) : activeMemories.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 border border-dashed border-border rounded-lg text-center">
                No saved memories yet. AI Builder will learn from your interactions over time.
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {activeMemories.map(mem => (
                  <div key={mem.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className={`text-[10px] ${memoryTypeColors[mem.memory_type] || ""}`}>
                          {memoryTypeLabels[mem.memory_type] || mem.memory_type}
                        </Badge>
                        <span className="text-xs text-muted-foreground capitalize">{mem.key.replace(/_/g, " ")}</span>
                        <span className={`text-[10px] ${confidenceColor(Number(mem.confidence_score))}`}>
                          {confidenceLabel(Number(mem.confidence_score))}
                        </span>
                      </div>
                      <p className="text-sm font-medium truncate">{formatValue(mem.value as Record<string, unknown>)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Used {mem.usage_count}× · {mem.source === "manual" ? "Set manually" : "Learned from usage"}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => deleteMemory(mem.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {activeMemories.length > 0 && (
              <Button variant="outline" size="sm" className="text-xs" onClick={clearAllMemories}>
                <Trash2 className="h-3 w-3 mr-1" />
                Clear all memories
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

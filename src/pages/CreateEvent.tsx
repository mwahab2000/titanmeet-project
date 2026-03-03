import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const CreateEvent = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [clientId, setClientId] = useState("");

  useEffect(() => {
    supabase.from("clients").select("id, name, slug").then(({ data }) => setClients(data || []));
  }, []);

  const handleTitleChange = (val: string) => { setTitle(val); setSlug(slugify(val)); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    // Pre-check slug uniqueness within the selected client
    if (clientId && slug) {
      const { data: existing } = await supabase
        .from("events")
        .select("id")
        .eq("client_id", clientId)
        .eq("slug", slug)
        .maybeSingle();
      if (existing) {
        toast.error("This slug is already used by another event under this client. Please choose a different one.");
        setLoading(false);
        return;
      }
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase.from("events").insert({
      title,
      slug,
      client_id: clientId || null,
      status: "draft",
      created_by: user.id,
      start_date: now,
      end_date: now,
    } as any).select("id").single();

    setLoading(false);
    if (error) {
      if (error.message?.includes("idx_events_client_slug")) {
        toast.error("This slug is already used by another event under this client.");
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success("Event created! Redirecting to workspace...");
    navigate(`/dashboard/events/${data.id}/hero`);
  };

  return (
    <div className="max-w-lg">
      <Button variant="ghost" className="mb-4 gap-2" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>
      <Card>
        <CardHeader><CardTitle className="font-display text-2xl">Create Event</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Client (optional)</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Select client..." /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {clients.length === 0 && <p className="text-xs text-muted-foreground">No clients yet. <a href="/dashboard/clients/new" className="underline text-primary">Create one</a></p>}
            </div>
            <div className="space-y-2">
              <Label>Event Title *</Label>
              <Input value={title} onChange={e => handleTitleChange(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Event Slug *</Label>
              <Input value={slug} onChange={e => setSlug(slugify(e.target.value))} required />
              <p className="text-xs text-muted-foreground">Public URL path for this event</p>
            </div>
            <Button type="submit" className="gradient-titan border-0 text-primary-foreground" disabled={loading}>
              {loading ? "Creating..." : "Create & Open Workspace"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateEvent;

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const CreateClient = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleNameChange = (val: string) => {
    setName(val);
    setSlug(slugify(val));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    // Check slug uniqueness
    const { data: existing } = await supabase.from("clients").select("id").eq("slug", slug).maybeSingle();
    if (existing) {
      toast.error("Slug already taken. Please choose a different one.");
      setLoading(false);
      return;
    }

    let logo_url: string | null = null;
    if (logoFile) {
      const path = `${slug}/${logoFile.name}`;
      const { error: upErr } = await supabase.storage.from("client-assets").upload(path, logoFile);
      if (upErr) { toast.error("Logo upload failed"); setLoading(false); return; }
      const { data: urlData } = supabase.storage.from("client-assets").getPublicUrl(path);
      logo_url = urlData.publicUrl;
    }

    const { error } = await supabase.from("clients").insert({ name, slug, logo_url, created_by: user.id } as any);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Client created!");
    navigate("/dashboard/events/new");
  };

  return (
    <div className="max-w-lg">
      <Card>
        <CardHeader><CardTitle className="font-display text-2xl">Create Client</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Client Name *</Label>
              <Input value={name} onChange={e => handleNameChange(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Client Slug *</Label>
              <Input value={slug} onChange={e => setSlug(slugify(e.target.value))} required pattern="[a-z0-9-]+" />
              <p className="text-xs text-muted-foreground">Used in the public URL: {slug || "..."}.titanmeet.com</p>
            </div>
            <div className="space-y-2">
              <Label>Logo (optional)</Label>
              <Input type="file" accept="image/*" onChange={e => setLogoFile(e.target.files?.[0] || null)} />
            </div>
            <Button type="submit" className="gradient-titan border-0 text-primary-foreground" disabled={loading}>
              {loading ? "Saving..." : "Save Client"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateClient;

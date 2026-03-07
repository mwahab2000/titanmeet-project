import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Lock, Copy, Check } from "lucide-react";

const EditClient = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          toast.error("Client not found");
          navigate("/dashboard/clients");
          return;
        }
        setName(data.name);
        setSlug(data.slug);
        setLogoUrl(data.logo_url);
        setLoading(false);
      });
  }, [clientId]);

  const copySlug = () => {
    navigator.clipboard.writeText(slug);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) return;
    setSaving(true);

    let logo_url = logoUrl;
    if (logoFile) {
      const path = `${slug}/${logoFile.name}`;
      const { error: upErr } = await supabase.storage.from("client-assets").upload(path, logoFile, { upsert: true });
      if (upErr) {
        toast.error("Logo upload failed");
        setSaving(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("client-assets").getPublicUrl(path);
      logo_url = urlData.publicUrl;
    }

    const { error } = await supabase
      .from("clients")
      .update({ name, logo_url } as any)
      .eq("id", clientId);

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Client updated!");
    navigate("/dashboard/clients");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <Button variant="ghost" className="mb-4 gap-2" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-2xl">Edit Client</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Client Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                Client Slug
                <Lock className="h-3 w-3 text-muted-foreground" />
              </Label>
              <div className="flex gap-2">
                <Input value={slug} disabled className="font-mono bg-muted" />
                <Button type="button" variant="outline" size="icon" onClick={copySlug} className="shrink-0">
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Client slug cannot be changed after creation.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Logo (optional)</Label>
              {logoUrl && !logoFile && (
                <div className="mb-2">
                  <img src={logoUrl} alt="Current logo" className="h-16 w-16 rounded-lg object-cover border" />
                </div>
              )}
              <Input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
            </div>
            <Button type="submit" className="gradient-titan border-0 text-primary-foreground" disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default EditClient;

import { useEffect, useState } from "react";
import { Search, X, Trash2, Copy, FileText, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SECTION_LABELS, IncludedSection } from "@/lib/template-api";
import { UseTemplateDialog } from "@/components/templates/UseTemplateDialog";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const TemplatesPage = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [useDialogOpen, setUseDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from("event_templates" as any)
      .select("*, clients(name)")
      .order("created_at", { ascending: false });
    setTemplates(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchTemplates(); }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from("event_templates" as any).delete().eq("id", deleteId);
    toast.success("Template deleted");
    setDeleteId(null);
    fetchTemplates();
  };

  const handleDuplicate = async (tpl: any) => {
    const { error } = await supabase.from("event_templates" as any).insert({
      user_id: user!.id,
      client_id: tpl.client_id,
      name: `${tpl.name} (Copy)`,
      description: tpl.description,
      template_data: tpl.template_data,
      included_sections: tpl.included_sections,
    });
    if (error) { toast.error("Failed to duplicate"); return; }
    toast.success("Template duplicated");
    fetchTemplates();
  };

  const filtered = templates.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.description || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Templates</h1>
          <p className="text-muted-foreground">Reusable event setups for faster creation</p>
        </div>
      </div>

      <div className="mb-6 relative max-w-md">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search templates…" value={search} onChange={e => setSearch(e.target.value)} className="pl-10 pr-8" />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Layers className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="mb-2 text-lg font-medium">No templates yet</p>
            <p className="text-sm text-muted-foreground">
              Save an event as a template from any event workspace to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="mb-3 text-xs text-muted-foreground">{filtered.length} template{filtered.length !== 1 ? "s" : ""}</p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map(tpl => (
              <Card key={tpl.id} className="border-border/50 hover:border-primary/30 transition-colors">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <h3 className="font-display font-semibold text-sm line-clamp-1">{tpl.name}</h3>
                    </div>
                    {(tpl as any).clients?.name && (
                      <Badge variant="outline" className="text-[10px] shrink-0">{(tpl as any).clients.name}</Badge>
                    )}
                  </div>

                  {tpl.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{tpl.description}</p>
                  )}

                  <div className="flex flex-wrap gap-1">
                    {((tpl.included_sections as string[]) || []).map((s: string) => (
                      <Badge key={s} variant="secondary" className="text-[10px]">
                        {SECTION_LABELS[s as IncludedSection] || s}
                      </Badge>
                    ))}
                  </div>

                  <p className="text-[10px] text-muted-foreground">
                    Updated {format(new Date(tpl.updated_at), "MMM d, yyyy")}
                  </p>

                  <div className="flex items-center gap-2 pt-1 border-t border-border">
                    <Button size="sm" className="flex-1" onClick={() => { setSelectedTemplate(tpl); setUseDialogOpen(true); }}>
                      Use Template
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDuplicate(tpl)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(tpl.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {selectedTemplate && (
        <UseTemplateDialog
          open={useDialogOpen}
          onOpenChange={setUseDialogOpen}
          templateId={selectedTemplate.id}
          templateName={selectedTemplate.name}
          includedSections={selectedTemplate.included_sections || []}
          defaultClientId={selectedTemplate.client_id}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TemplatesPage;

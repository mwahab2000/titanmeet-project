import { useEffect, useState, useMemo } from "react";
import { Search, X, Trash2, Copy, FileText, Layers, Star, Tag, Sparkles, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SECTION_LABELS, CATEGORY_LABELS, IncludedSection, TemplateCategory, MarketplaceTemplate, CommTemplates } from "@/lib/template-api";
import { UseTemplateDialog } from "@/components/templates/UseTemplateDialog";
import { TemplatePreviewSheet } from "@/components/templates/TemplatePreviewSheet";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ALL_CATEGORIES: TemplateCategory[] = ["general", "corporate", "social", "conference", "workshop", "gala", "retreat"];

const TemplateMarketplacePage = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<MarketplaceTemplate[]>([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [useDialogOpen, setUseDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<MarketplaceTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<MarketplaceTemplate | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from("event_templates" as any)
      .select("*, clients(name)")
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false });
    setTemplates((data || []) as unknown as MarketplaceTemplate[]);
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

  const handleDuplicate = async (tpl: MarketplaceTemplate) => {
    const { error } = await supabase.from("event_templates" as any).insert({
      user_id: user!.id,
      client_id: tpl.client_id,
      name: `${tpl.name} (Copy)`,
      description: tpl.description,
      template_data: tpl.template_data,
      included_sections: tpl.included_sections,
      category: tpl.category,
      tags: tpl.tags,
      comm_templates: tpl.comm_templates,
      event_type: tpl.event_type,
      expected_attendees: tpl.expected_attendees,
    });
    if (error) { toast.error("Failed to duplicate"); return; }
    toast.success("Template duplicated");
    fetchTemplates();
  };

  const filtered = useMemo(() => {
    return templates.filter(t => {
      const matchesSearch = !search ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        (t.description || "").toLowerCase().includes(search.toLowerCase()) ||
        (t.tags || []).some(tag => tag.toLowerCase().includes(search.toLowerCase()));
      const matchesCategory = activeCategory === "all" || t.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [templates, search, activeCategory]);

  const featured = useMemo(() => filtered.filter(t => t.is_featured), [filtered]);
  const regular = useMemo(() => filtered.filter(t => !t.is_featured), [filtered]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    templates.forEach(t => (t.tags || []).forEach(tag => tags.add(tag)));
    return Array.from(tags).sort();
  }, [templates]);

  const renderCard = (tpl: MarketplaceTemplate, featured = false) => (
    <Card key={tpl.id} className={`border-border/50 hover:border-primary/30 transition-all cursor-pointer group ${featured ? "ring-1 ring-primary/20 bg-primary/[0.02]" : ""}`}>
      <CardContent className="p-5 space-y-3" onClick={() => setPreviewTemplate(tpl)}>
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {featured && <Star className="h-4 w-4 text-primary shrink-0 fill-primary/30" />}
            <FileText className="h-4 w-4 text-primary shrink-0" />
            <h3 className="font-display font-semibold text-sm line-clamp-1">{tpl.name}</h3>
          </div>
          <Badge variant="outline" className="text-[10px] shrink-0 capitalize">
            {CATEGORY_LABELS[tpl.category as TemplateCategory] || tpl.category}
          </Badge>
        </div>

        {tpl.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{tpl.description}</p>
        )}

        {/* Sections */}
        <div className="flex flex-wrap gap-1">
          {(tpl.included_sections || []).map((s: string) => (
            <Badge key={s} variant="secondary" className="text-[10px]">
              {SECTION_LABELS[s as IncludedSection] || s}
            </Badge>
          ))}
          {tpl.comm_templates && Object.keys(tpl.comm_templates).some(k => (tpl.comm_templates as any)[k]) && (
            <Badge variant="secondary" className="text-[10px] bg-accent">
              📧 Comms
            </Badge>
          )}
        </div>

        {/* Tags */}
        {(tpl.tags || []).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tpl.tags.slice(0, 4).map(tag => (
              <span key={tag} className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Tag className="h-2.5 w-2.5" />{tag}
              </span>
            ))}
          </div>
        )}

        {/* Meta */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Updated {format(new Date(tpl.updated_at), "MMM d, yyyy")}</span>
          {tpl.expected_attendees && <span>{tpl.expected_attendees} attendees</span>}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1 border-t border-border" onClick={e => e.stopPropagation()}>
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
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-primary" />
            Template Marketplace
          </h1>
          <p className="text-muted-foreground">Premium reusable event setups — content, design & communications included</p>
        </div>
      </div>

      {/* Search + Category Filters */}
      <div className="mb-6 space-y-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search templates, tags…" value={search} onChange={e => setSearch(e.target.value)} className="pl-10 pr-8" />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={activeCategory === "all" ? "default" : "outline"} onClick={() => setActiveCategory("all")}>
            All
          </Button>
          {ALL_CATEGORIES.map(cat => (
            <Button key={cat} size="sm" variant={activeCategory === cat ? "default" : "outline"} onClick={() => setActiveCategory(cat)} className="capitalize">
              {CATEGORY_LABELS[cat]}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Layers className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="mb-2 text-lg font-medium">No templates found</p>
            <p className="text-sm text-muted-foreground">
              Save an event as a template from any event workspace to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="mb-3 text-xs text-muted-foreground">{filtered.length} template{filtered.length !== 1 ? "s" : ""}</p>

          {/* Featured Section */}
          {featured.length > 0 && (
            <div className="mb-8">
              <h2 className="font-display text-lg font-semibold mb-3 flex items-center gap-2">
                <Star className="h-4 w-4 text-primary fill-primary/30" /> Featured
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {featured.map(tpl => renderCard(tpl, true))}
              </div>
            </div>
          )}

          {/* Regular Templates */}
          {regular.length > 0 && (
            <div>
              {featured.length > 0 && <h2 className="font-display text-lg font-semibold mb-3">All Templates</h2>}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {regular.map(tpl => renderCard(tpl))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Template Preview Sheet */}
      {previewTemplate && (
        <TemplatePreviewSheet
          template={previewTemplate}
          open={!!previewTemplate}
          onOpenChange={(open) => !open && setPreviewTemplate(null)}
          onUseTemplate={() => {
            setSelectedTemplate(previewTemplate);
            setPreviewTemplate(null);
            setUseDialogOpen(true);
          }}
        />
      )}

      {/* Use Template Dialog */}
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

      {/* Delete Confirm */}
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

export default TemplateMarketplacePage;

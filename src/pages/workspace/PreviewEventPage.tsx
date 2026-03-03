import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { getEventPreview } from "@/lib/publicSite/getEventPreview";
import type { FetchResult } from "@/lib/publicSite/types";
import { EventThemeRenderer } from "@/components/public/EventThemeRenderer";
import { Loader2, ArrowLeft, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const PreviewEventPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [result, setResult] = useState<FetchResult | null>(null);

  useEffect(() => {
    if (!id) { setResult({ status: "not_found" }); return; }
    let cancelled = false;
    getEventPreview(id).then((r) => { if (!cancelled) setResult(r); });
    return () => { cancelled = true; };
  }, [id]);

  if (!result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (result.status !== "ok") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <p className="text-muted-foreground">Unable to load event preview.</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Workspace
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Preview banner */}
      <div className="fixed top-0 left-0 right-0 z-[100] bg-primary text-primary-foreground py-2 px-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <Eye className="h-4 w-4" />
          <span className="text-sm font-semibold">Draft Preview</span>
          <Badge variant="secondary" className="text-xs">Not Published</Badge>
        </div>
        <Button size="sm" variant="secondary" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-3 w-3 mr-1" /> Back to Workspace
        </Button>
      </div>
      {/* Offset for banner */}
      <div className="pt-10">
        <EventThemeRenderer data={result.data} />
      </div>
    </div>
  );
};

export default PreviewEventPage;

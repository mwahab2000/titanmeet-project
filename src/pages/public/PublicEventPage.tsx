import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { getPublicEventBySlugs } from "@/lib/publicSite/getPublicEventBySlugs";
import type { FetchResult } from "@/lib/publicSite/types";
import PublicNotFoundPage from "./PublicNotFoundPage";
import PublicPrivatePage from "./PublicPrivatePage";
import { EventThemeRenderer } from "@/components/public/EventThemeRenderer";
import { Loader2 } from "lucide-react";

const PublicEventPage = () => {
  const { clientSlug, eventSlug } = useParams<{ clientSlug: string; eventSlug: string }>();
  const [result, setResult] = useState<FetchResult | null>(null);

  useEffect(() => {
    if (!clientSlug || !eventSlug) { setResult({ status: "not_found" }); return; }
    let cancelled = false;
    getPublicEventBySlugs(clientSlug, eventSlug).then((r) => { if (!cancelled) setResult(r); });
    return () => { cancelled = true; };
  }, [clientSlug, eventSlug]);

  if (!result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (result.status === "not_found" || result.status === "error") return <PublicNotFoundPage />;
  if (result.status === "private") return <PublicPrivatePage />;

  return <EventThemeRenderer data={result.data} />;
};

export default PublicEventPage;

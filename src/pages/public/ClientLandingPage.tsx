import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, MapPin, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

interface ClientInfo {
  id: string;
  name: string;
  logo_url: string | null;
}

interface PublishedEvent {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  start_date: string;
  venue_name: string | null;
  cover_image: string | null;
}

type PageState =
  | { status: "loading" }
  | { status: "not_found" }
  | { status: "ok"; client: ClientInfo; events: PublishedEvent[] };

const ClientLandingPage = ({ clientSlug }: { clientSlug: string }) => {
  const [state, setState] = useState<PageState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data: client, error: cErr } = await supabase
        .from("clients")
        .select("id, name, logo_url")
        .eq("slug", clientSlug)
        .maybeSingle();

      if (cErr || !client) {
        if (!cancelled) setState({ status: "not_found" });
        return;
      }

      const { data: events } = await supabase
        .from("events")
        .select("id, title, slug, description, start_date, venue_name, cover_image")
        .eq("client_id", client.id)
        .in("status", ["published", "ongoing"])
        .order("start_date", { ascending: true });

      if (!cancelled) {
        setState({ status: "ok", client, events: (events ?? []) as PublishedEvent[] });
      }
    })();

    return () => { cancelled = true; };
  }, [clientSlug]);

  // SEO: set document title
  useEffect(() => {
    if (state.status === "ok") {
      document.title = `${state.client.name} | TitanMeet`;
      const meta = document.querySelector('meta[name="description"]');
      const desc = `Published events for ${state.client.name}`;
      if (meta) {
        meta.setAttribute("content", desc);
      } else {
        const tag = document.createElement("meta");
        tag.name = "description";
        tag.content = desc;
        document.head.appendChild(tag);
      }
    } else if (state.status === "not_found") {
      document.title = "Client Not Found | TitanMeet";
    }
  }, [state]);

  if (state.status === "loading") {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card">
          <div className="max-w-5xl mx-auto px-6 py-8 flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-6 py-10">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
                <Skeleton className="aspect-video w-full" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (state.status === "not_found") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-md space-y-6">
          <h1 className="text-6xl font-bold text-muted-foreground/30">404</h1>
          <h2 className="text-xl font-semibold text-foreground">Client Not Found</h2>
          <p className="text-muted-foreground">
            We couldn't find an organization matching <span className="font-medium text-foreground">"{clientSlug}"</span>.
          </p>
          <Button asChild variant="outline">
            <a href="https://www.titanmeet.com">
              <ExternalLink className="h-4 w-4 mr-2" />
              Go to TitanMeet
            </a>
          </Button>
        </div>
      </div>
    );
  }

  const { client, events } = state;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-8 flex items-center gap-4">
          {client.logo_url && (
            <img src={client.logo_url} alt={client.name} className="h-12 w-12 rounded-lg object-contain" />
          )}
          <div>
            <h1 className="text-2xl font-bold text-foreground">{client.name}</h1>
            <p className="text-sm text-muted-foreground">Upcoming & recent events</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {events.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <p className="text-muted-foreground text-lg">No published events yet.</p>
            <Button asChild variant="outline" size="sm">
              <a href="https://www.titanmeet.com">Visit TitanMeet</a>
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((ev) => (
              <Link
                key={ev.id}
                to={`/${ev.slug}`}
                className="group block rounded-xl border border-border bg-card overflow-hidden hover:shadow-lg transition-shadow"
              >
                {ev.cover_image ? (
                  <div className="aspect-video overflow-hidden">
                    <img
                      src={ev.cover_image}
                      alt={ev.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-muted flex items-center justify-center">
                    <Calendar className="h-10 w-10 text-muted-foreground/40" />
                  </div>
                )}
                <div className="p-4 space-y-2">
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                    {ev.title}
                  </h3>
                  {ev.start_date && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {format(new Date(ev.start_date), "MMM d, yyyy")}
                    </p>
                  )}
                  {ev.venue_name && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      <span className="line-clamp-1">{ev.venue_name}</span>
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default ClientLandingPage;

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Calendar, MapPin } from "lucide-react";
import { format } from "date-fns";

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
  event_date: string | null;
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
        .single();

      if (cErr || !client) {
        if (!cancelled) setState({ status: "not_found" });
        return;
      }

      const { data: events } = await supabase
        .from("events")
        .select("id, title, slug, description, event_date, venue_name, cover_image")
        .eq("client_id", client.id)
        .in("status", ["published", "ongoing"])
        .order("event_date", { ascending: false });

      if (!cancelled) {
        setState({ status: "ok", client, events: (events ?? []) as PublishedEvent[] });
      }
    })();

    return () => { cancelled = true; };
  }, [clientSlug]);

  if (state.status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (state.status === "not_found") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-md space-y-4">
          <h1 className="text-6xl font-bold text-muted-foreground/30">404</h1>
          <h2 className="text-xl font-semibold text-foreground">Client Not Found</h2>
          <p className="text-muted-foreground">
            We couldn't find an organization matching <span className="font-medium text-foreground">"{clientSlug}"</span>.
          </p>
        </div>
      </div>
    );
  }

  const { client, events } = state;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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

      {/* Events grid */}
      <main className="max-w-5xl mx-auto px-6 py-10">
        {events.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg">No published events yet.</p>
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
                  {ev.event_date && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {format(new Date(ev.event_date), "MMM d, yyyy")}
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

import { MapPin, Star, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface VenueResult {
  place_id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating: number | null;
  user_ratings_total: number;
  map_url: string;
  has_photos: boolean;
}

interface AIVenueSearchResultsProps {
  venues: VenueResult[];
  onSelect: (venue: VenueResult) => void;
  disabled?: boolean;
}

export const AIVenueSearchResults = ({ venues, onSelect, disabled }: AIVenueSearchResultsProps) => {
  if (!venues?.length) return null;

  return (
    <div className="flex flex-col gap-2 w-full">
      <p className="text-xs font-medium text-muted-foreground px-1">Select a venue:</p>
      {venues.map((venue) => (
        <div
          key={venue.place_id}
          className={cn(
            "flex flex-col gap-2 rounded-xl border border-border bg-card p-3 sm:p-4 transition-colors",
            !disabled && "hover:border-primary/40 hover:bg-accent/30"
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0 flex-1">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 mt-0.5">
                <MapPin className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-foreground truncate">{venue.name}</h4>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{venue.address}</p>
                {venue.rating && (
                  <div className="flex items-center gap-1 mt-1">
                    <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                    <span className="text-xs text-muted-foreground">
                      {venue.rating} ({venue.user_ratings_total} reviews)
                    </span>
                  </div>
                )}
              </div>
            </div>
            <a
              href={venue.map_url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 p-1.5 rounded-md hover:bg-muted transition-colors"
              title="Open in Google Maps"
            >
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            </a>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full h-10 text-xs font-medium"
            onClick={() => onSelect(venue)}
            disabled={disabled}
          >
            Use this venue
          </Button>
        </div>
      ))}
    </div>
  );
};

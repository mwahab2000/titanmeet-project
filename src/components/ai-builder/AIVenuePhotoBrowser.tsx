import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, ChevronRight, ImageIcon, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface VenuePhoto {
  index: number;
  photo_reference: string;
  width: number;
  height: number;
  attributions: string[];
  preview_url: string;
}

interface AIVenuePhotoBrowserProps {
  photos: VenuePhoto[];
  placeId: string;
  onConfirmSelection: (selectedPhotos: VenuePhoto[]) => void;
  disabled?: boolean;
}

export const AIVenuePhotoBrowser = ({ photos, placeId, onConfirmSelection, disabled }: AIVenuePhotoBrowserProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  if (!photos?.length) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        <ImageIcon className="h-4 w-4" />
        No photos available for this venue.
      </div>
    );
  }

  const currentPhoto = photos[currentIndex];
  const isSelected = selectedIndices.has(currentIndex);

  const toggleSelection = (index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const selected = photos.filter((_, i) => selectedIndices.has(i));
    onConfirmSelection(selected);
  };

  const goTo = (dir: -1 | 1) => {
    setCurrentIndex((prev) => {
      const next = prev + dir;
      if (next < 0) return photos.length - 1;
      if (next >= photos.length) return 0;
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-3 w-full rounded-xl border border-border bg-card overflow-hidden">
      {/* Photo viewer */}
      <div className="relative w-full aspect-video bg-muted">
        <img
          src={currentPhoto.preview_url}
          alt={`Venue photo ${currentIndex + 1}`}
          className="w-full h-full object-cover"
          loading="lazy"
        />

        {/* Nav arrows */}
        {photos.length > 1 && (
          <>
            <button
              onClick={() => goTo(-1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 flex items-center justify-center rounded-full bg-background/80 backdrop-blur border border-border hover:bg-background transition-colors"
              aria-label="Previous photo"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => goTo(1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 flex items-center justify-center rounded-full bg-background/80 backdrop-blur border border-border hover:bg-background transition-colors"
              aria-label="Next photo"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}

        {/* Counter */}
        <div className="absolute bottom-2 right-2 px-2 py-1 rounded-md bg-background/80 backdrop-blur text-xs font-medium">
          {currentIndex + 1} / {photos.length}
        </div>

        {/* Selection badge */}
        {isSelected && (
          <div className="absolute top-2 right-2 h-7 w-7 flex items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="h-4 w-4" />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="px-3 pb-3 space-y-3">
        {/* Attribution */}
        {currentPhoto.attributions?.length > 0 && (
          <p
            className="text-[10px] text-muted-foreground/60 line-clamp-1"
            dangerouslySetInnerHTML={{ __html: currentPhoto.attributions[0] }}
          />
        )}

        {/* Toggle select for current */}
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => toggleSelection(currentIndex)}
            disabled={disabled}
          />
          <span className="text-sm">Select this photo</span>
        </label>

        {/* Thumbnail strip */}
        {photos.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            {photos.map((photo, i) => (
              <button
                key={photo.photo_reference}
                onClick={() => setCurrentIndex(i)}
                className={cn(
                  "shrink-0 h-12 w-16 rounded-md overflow-hidden border-2 transition-colors",
                  i === currentIndex ? "border-primary" : "border-transparent",
                  selectedIndices.has(i) && "ring-2 ring-primary/40"
                )}
              >
                <img
                  src={photo.preview_url}
                  alt={`Thumbnail ${i + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}

        {/* Confirm button */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {selectedIndices.size} photo{selectedIndices.size !== 1 ? "s" : ""} selected
          </span>
          <Button
            size="sm"
            className="h-9"
            onClick={handleConfirm}
            disabled={disabled || selectedIndices.size === 0}
          >
            Confirm Selection
          </Button>
        </div>
      </div>
    </div>
  );
};

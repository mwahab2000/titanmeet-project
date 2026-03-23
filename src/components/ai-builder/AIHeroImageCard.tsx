import { useState } from "react";
import { CheckCircle2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface HeroImageCandidate {
  id: string;
  url: string;
  storagePath: string;
  label?: string;
}

interface AIHeroImageCardProps {
  image: HeroImageCandidate;
  index: number;
  isSelected?: boolean;
  onAdd?: () => void;
  onRemove?: () => void;
  selectionMode?: boolean;
}

export const AIHeroImageCard = ({ image, index, isSelected, onAdd, onRemove, selectionMode }: AIHeroImageCardProps) => {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className={cn(
      "relative group rounded-xl border overflow-hidden transition-all",
      isSelected
        ? "border-primary ring-2 ring-primary/30"
        : "border-border hover:border-primary/40"
    )}>
      <div className="aspect-video bg-muted relative">
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        )}
        <img
          src={image.url}
          alt={image.label || `Hero option ${index + 1}`}
          className={cn(
            "w-full h-full object-cover transition-opacity duration-300",
            loaded ? "opacity-100" : "opacity-0"
          )}
          onLoad={() => setLoaded(true)}
        />
        {isSelected && (
          <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
            <CheckCircle2 className="h-4 w-4 text-primary-foreground" />
          </div>
        )}
      </div>
      <div className="px-3 py-2 flex items-center justify-between bg-card">
        <span className="text-xs font-medium text-foreground">
          {image.label || `Option ${index + 1}`}
        </span>
        {selectionMode && onRemove && isSelected && (
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive hover:text-destructive" onClick={onRemove}>
            <Trash2 className="h-3 w-3" /> Remove
          </Button>
        )}
        {!isSelected && onAdd && (
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-primary" onClick={onAdd}>
            <Plus className="h-3 w-3" /> Add
          </Button>
        )}
      </div>
    </div>
  );
};

interface AIHeroImageGridProps {
  images: HeroImageCandidate[];
  selectedIds?: Set<string>;
  onAdd?: (image: HeroImageCandidate) => void;
  onRemove?: (imageId: string) => void;
  selectionMode?: boolean;
}

export const AIHeroImageGrid = ({ images, selectedIds, onAdd, onRemove, selectionMode }: AIHeroImageGridProps) => {
  if (!images.length) return null;

  return (
    <div className={cn(
      "grid gap-3 w-full",
      images.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"
    )}>
      {images.map((img, i) => (
        <AIHeroImageCard
          key={img.id}
          image={img}
          index={i}
          isSelected={selectedIds?.has(img.id)}
          onAdd={onAdd ? () => onAdd(img) : undefined}
          onRemove={onRemove ? () => onRemove(img.id) : undefined}
          selectionMode={selectionMode}
        />
      ))}
    </div>
  );
};

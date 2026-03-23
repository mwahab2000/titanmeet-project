import { useState } from "react";
import { CheckCircle2, Plus, Trash2, Crown, Star, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface HeroImageCandidate {
  id: string;
  url: string;
  storagePath: string;
  label?: string;
  rank?: number;
  score?: number;
  reason?: string;
  isRecommended?: boolean;
  isRefined?: boolean;
  refinementInstruction?: string;
}

interface AIHeroImageCardProps {
  image: HeroImageCandidate;
  index: number;
  isSelected?: boolean;
  onAdd?: () => void;
  onRemove?: () => void;
  selectionMode?: boolean;
  showRanking?: boolean;
}

export const AIHeroImageCard = ({ image, index, isSelected, onAdd, onRemove, selectionMode, showRanking }: AIHeroImageCardProps) => {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className={cn(
      "relative group rounded-xl border overflow-hidden transition-all",
      image.isRecommended && showRanking
        ? "border-primary ring-2 ring-primary/30"
        : isSelected
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
        {/* Recommended badge */}
        {showRanking && image.isRecommended && (
          <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 shadow-lg">
            <Crown className="h-3 w-3 text-primary-foreground" />
            <span className="text-[10px] font-bold text-primary-foreground uppercase tracking-wide">Recommended</span>
          </div>
        )}
        {/* Rank badge */}
        {showRanking && image.rank && !image.isRecommended && (
          <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-muted/90 backdrop-blur-sm px-2 py-1 border border-border">
            <span className="text-[10px] font-semibold text-foreground">#{image.rank}</span>
          </div>
        )}
        {/* Score indicator */}
        {showRanking && typeof image.score === "number" && (
          <div className="absolute top-2 right-2 flex items-center gap-0.5 rounded-full bg-background/80 backdrop-blur-sm px-2 py-1 border border-border">
            <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
            <span className="text-[10px] font-semibold text-foreground">{Math.round(image.score * 100)}%</span>
          </div>
        )}
        {isSelected && !showRanking && (
          <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
            <CheckCircle2 className="h-4 w-4 text-primary-foreground" />
          </div>
        )}
      </div>
      <div className="px-3 py-2 bg-card space-y-1">
        <div className="flex items-center justify-between">
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
        {/* Ranking reason */}
        {showRanking && image.reason && (
          <p className="text-[11px] text-muted-foreground leading-snug">{image.reason}</p>
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
  showRanking?: boolean;
}

export const AIHeroImageGrid = ({ images, selectedIds, onAdd, onRemove, selectionMode, showRanking }: AIHeroImageGridProps) => {
  if (!images.length) return null;

  // Sort by rank if ranking is shown
  const sortedImages = showRanking
    ? [...images].sort((a, b) => (a.rank || 999) - (b.rank || 999))
    : images;

  return (
    <div className={cn(
      "grid gap-3 w-full",
      sortedImages.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"
    )}>
      {sortedImages.map((img, i) => (
        <AIHeroImageCard
          key={img.id}
          image={img}
          index={i}
          isSelected={selectedIds?.has(img.id)}
          onAdd={onAdd ? () => onAdd(img) : undefined}
          onRemove={onRemove ? () => onRemove(img.id) : undefined}
          selectionMode={selectionMode}
          showRanking={showRanking}
        />
      ))}
    </div>
  );
};

import { useState } from "react";
import { Palette, Type, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface VisualIdentityData {
  hero_image_url?: string;
  hero_asset_id?: string;
  banner_image_url?: string;
  banner_asset_id?: string;
  color_palette?: { name: string; hex: string }[];
  typography_style?: string;
  typography_tone?: string;
  explanation?: string;
}

interface AIVisualIdentityPreviewProps {
  identity: VisualIdentityData;
  onApplyFull?: () => void;
  onApplyPartial?: (part: "hero" | "banner" | "colors") => void;
  onRefine?: () => void;
  onRegenerate?: () => void;
  disabled?: boolean;
}

export const AIVisualIdentityPreview = ({
  identity,
  onApplyFull,
  onApplyPartial,
  onRefine,
  onRegenerate,
  disabled,
}: AIVisualIdentityPreviewProps) => {
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [bannerLoaded, setBannerLoaded] = useState(false);

  return (
    <div className="w-full rounded-xl border border-primary/20 bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-primary/5">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Event Visual Identity</span>
      </div>

      <div className="p-4 space-y-4">
        {/* Hero Image */}
        {identity.hero_image_url && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Hero Image</span>
            <div className="relative rounded-lg overflow-hidden border border-border aspect-video bg-muted">
              {!heroLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                </div>
              )}
              <img
                src={identity.hero_image_url}
                alt="Hero image preview"
                className={cn("w-full h-full object-cover transition-opacity duration-300", heroLoaded ? "opacity-100" : "opacity-0")}
                onLoad={() => setHeroLoaded(true)}
              />
            </div>
          </div>
        )}

        {/* Banner Image */}
        {identity.banner_image_url && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Banner</span>
            <div className="relative rounded-lg overflow-hidden border border-border aspect-[3/1] bg-muted">
              {!bannerLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                </div>
              )}
              <img
                src={identity.banner_image_url}
                alt="Banner preview"
                className={cn("w-full h-full object-cover transition-opacity duration-300", bannerLoaded ? "opacity-100" : "opacity-0")}
                onLoad={() => setBannerLoaded(true)}
              />
            </div>
          </div>
        )}

        {/* Color Palette */}
        {identity.color_palette && identity.color_palette.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Palette className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Color Palette</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {identity.color_palette.map((color, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 bg-background">
                  <div className="h-5 w-5 rounded-full border border-border shrink-0" style={{ backgroundColor: color.hex }} />
                  <div className="flex flex-col">
                    <span className="text-[11px] font-medium text-foreground">{color.name}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{color.hex}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Typography */}
        {identity.typography_style && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Type className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Typography</span>
            </div>
            <div className="rounded-lg border border-border px-3 py-2 bg-background">
              <span className="text-xs font-medium text-foreground">{identity.typography_style}</span>
              {identity.typography_tone && (
                <span className="text-[11px] text-muted-foreground ml-2">— {identity.typography_tone}</span>
              )}
            </div>
          </div>
        )}

        {/* Explanation */}
        {identity.explanation && (
          <p className="text-[11px] text-muted-foreground leading-snug italic">{identity.explanation}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 px-4 py-3 border-t border-border bg-muted/30">
        <Button size="sm" variant="default" className="h-8 text-xs gap-1.5" onClick={onApplyFull} disabled={disabled}>
          <CheckCircle2 className="h-3.5 w-3.5" /> Apply Full Identity
        </Button>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onRefine} disabled={disabled}>
          Refine Design
        </Button>
        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={onRegenerate} disabled={disabled}>
          Try Another Style
        </Button>
      </div>
    </div>
  );
};

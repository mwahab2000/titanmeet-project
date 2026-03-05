import type { PublicEventData } from "@/lib/publicSite/types";
import { Shirt, ExternalLink } from "lucide-react";
import { MotionReveal, MotionRevealItem } from "./MotionReveal";

interface Props { data: PublicEventData; className?: string; }

const DRESS_TYPE_LABELS: Record<string, string> = {
  formal: "Formal",
  semi_formal: "Semi-Formal",
  business_formal: "Business Formal",
  business_casual: "Business Casual",
  smart_casual: "Smart Casual",
};

function getDisplayName(url: string): string {
  try {
    const parts = url.split("/");
    const last = parts[parts.length - 1].split("?")[0];
    return last.replace(/^\d+[-_]/, "") || "Reference image";
  } catch {
    return "Reference image";
  }
}

export const PublicDressCodeSection: React.FC<Props> = ({ data, className = "" }) => {
  const { dressCode } = data;
  if (!dressCode || dressCode.length === 0) return null;

  const multiDay = dressCode.length > 1;

  return (
    <MotionReveal id="dress-code" className={`max-w-4xl mx-auto px-6 py-16 ${className}`}>
      <h2 className="text-2xl md:text-3xl font-bold font-display mb-8 flex items-center gap-3">
        <Shirt className="h-7 w-7 text-primary" />
        Dress Code
      </h2>

      <div className={`grid gap-6 ${multiDay ? "md:grid-cols-2" : ""}`}>
        {dressCode.map((dc, i) => (
          <MotionRevealItem key={i} index={i} className="rounded-xl border border-border bg-card p-6 space-y-4">
            {multiDay && (
              <span className="inline-block text-xs font-semibold uppercase tracking-wider text-primary bg-primary/10 px-3 py-1 rounded-full">
                Day {dc.dayNumber}
              </span>
            )}

            <div>
              <h3 className="text-lg font-semibold">{DRESS_TYPE_LABELS[dc.dressType] ?? dc.dressType}</h3>
            </div>

            {dc.customInstructions && (
              <p className="text-sm text-muted-foreground leading-relaxed">{dc.customInstructions}</p>
            )}

            {dc.referenceImages.length > 0 && (
              <div className="space-y-1 pt-2">
                <p className="text-xs font-medium text-muted-foreground mb-1">Reference Images</p>
                {dc.referenceImages.map((img, j) => (
                  <a
                    key={j}
                    href={img}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-md border border-border text-sm hover:bg-muted/50 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="truncate">{getDisplayName(img)}</span>
                  </a>
                ))}
              </div>
            )}
          </MotionRevealItem>
        ))}
      </div>
    </MotionReveal>
  );
};

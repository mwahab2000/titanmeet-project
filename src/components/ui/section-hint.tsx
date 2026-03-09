import { useState } from "react";
import { Info, X } from "lucide-react";

interface SectionHintProps {
  sectionKey: string;
  title: string;
  description: string;
}

const STORAGE_PREFIX = "titan_hint_dismissed_";

export const SectionHint = ({ sectionKey, title, description }: SectionHintProps) => {
  const storageKey = `${STORAGE_PREFIX}${sectionKey}`;
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(storageKey) === "true");

  if (dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(storageKey, "true");
    setDismissed(true);
  };

  return (
    <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 mb-4">
      <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
      <button
        onClick={handleDismiss}
        className="rounded-sm text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5"
        aria-label="Dismiss hint"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

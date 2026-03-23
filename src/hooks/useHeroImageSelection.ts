import { useState, useCallback } from "react";
import type { HeroImageCandidate } from "@/components/ai-builder/AIHeroImageCard";

export function useHeroImageSelection() {
  const [candidates, setCandidates] = useState<HeroImageCandidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const addCandidate = useCallback((image: HeroImageCandidate) => {
    setCandidates(prev => {
      if (prev.some(c => c.id === image.id)) return prev;
      return [...prev, image];
    });
  }, []);

  const selectImage = useCallback((imageId: string) => {
    setSelectedIds(prev => new Set(prev).add(imageId));
  }, []);

  const deselectImage = useCallback((imageId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(imageId);
      return next;
    });
  }, []);

  const getSelectedImages = useCallback((): HeroImageCandidate[] => {
    return candidates.filter(c => selectedIds.has(c.id));
  }, [candidates, selectedIds]);

  const reset = useCallback(() => {
    setCandidates([]);
    setSelectedIds(new Set());
  }, []);

  const selectedCount = selectedIds.size;
  const hasSelection = selectedCount > 0;

  return {
    candidates,
    selectedIds,
    selectedCount,
    hasSelection,
    addCandidate,
    selectImage,
    deselectImage,
    getSelectedImages,
    reset,
  };
}

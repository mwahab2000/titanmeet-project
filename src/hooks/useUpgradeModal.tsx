import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type UpgradeTrigger =
  | "clients"
  | "events"
  | "attendees"
  | "emails"
  | "storage"
  | "ai_prompts"
  | "ai_images"
  | "whatsapp"
  | "brand_kits"
  | "feature";

interface UpgradeModalState {
  isOpen: boolean;
  trigger: UpgradeTrigger | null;
  featureLabel?: string;
  openUpgradeModal: (trigger: UpgradeTrigger, featureLabel?: string) => void;
  closeUpgradeModal: () => void;
}

const UpgradeModalContext = createContext<UpgradeModalState | null>(null);

export function UpgradeModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [trigger, setTrigger] = useState<UpgradeTrigger | null>(null);
  const [featureLabel, setFeatureLabel] = useState<string | undefined>();

  const openUpgradeModal = useCallback((t: UpgradeTrigger, label?: string) => {
    setTrigger(t);
    setFeatureLabel(label);
    setIsOpen(true);
  }, []);

  const closeUpgradeModal = useCallback(() => {
    setIsOpen(false);
    setTrigger(null);
    setFeatureLabel(undefined);
  }, []);

  return (
    <UpgradeModalContext.Provider value={{ isOpen, trigger, featureLabel, openUpgradeModal, closeUpgradeModal }}>
      {children}
    </UpgradeModalContext.Provider>
  );
}

export function useUpgradeModal(): UpgradeModalState {
  const ctx = useContext(UpgradeModalContext);
  if (!ctx) throw new Error("useUpgradeModal must be inside UpgradeModalProvider");
  return ctx;
}

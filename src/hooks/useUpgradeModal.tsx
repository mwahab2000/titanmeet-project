import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type UpgradeTrigger = "clients" | "events" | "attendees" | "emails" | "storage";

interface UpgradeModalState {
  isOpen: boolean;
  trigger: UpgradeTrigger | null;
  openUpgradeModal: (trigger: UpgradeTrigger) => void;
  closeUpgradeModal: () => void;
}

const UpgradeModalContext = createContext<UpgradeModalState | null>(null);

export function UpgradeModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [trigger, setTrigger] = useState<UpgradeTrigger | null>(null);

  const openUpgradeModal = useCallback((t: UpgradeTrigger) => {
    setTrigger(t);
    setIsOpen(true);
  }, []);

  const closeUpgradeModal = useCallback(() => {
    setIsOpen(false);
    setTrigger(null);
  }, []);

  return (
    <UpgradeModalContext.Provider value={{ isOpen, trigger, openUpgradeModal, closeUpgradeModal }}>
      {children}
    </UpgradeModalContext.Provider>
  );
}

export function useUpgradeModal(): UpgradeModalState {
  const ctx = useContext(UpgradeModalContext);
  if (!ctx) throw new Error("useUpgradeModal must be inside UpgradeModalProvider");
  return ctx;
}

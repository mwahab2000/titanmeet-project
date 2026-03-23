import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type OnboardingStatus = "loading" | "new_user" | "completed";

export function useOnboardingStatus() {
  const { user } = useAuth();
  const [status, setStatus] = useState<OnboardingStatus>("loading");

  useEffect(() => {
    if (!user) { setStatus("loading"); return; }

    const check = async () => {
      // Check if user has completed onboarding
      try {
        const done = localStorage.getItem(`titan_ai_onboarding_${user.id}`);
        if (done === "true") { setStatus("completed"); return; }

        // Check if user has any events
        const { count } = await supabase
          .from("events")
          .select("id", { count: "exact", head: true })
          .eq("created_by", user.id);

        setStatus(count && count > 0 ? "completed" : "new_user");
      } catch {
        setStatus("completed"); // fail-safe: don't block
      }
    };
    check();
  }, [user]);

  const completeOnboarding = useCallback(() => {
    if (user) {
      try { localStorage.setItem(`titan_ai_onboarding_${user.id}`, "true"); } catch {}
    }
    setStatus("completed");
  }, [user]);

  const resetOnboarding = useCallback(() => {
    if (user) {
      try { localStorage.removeItem(`titan_ai_onboarding_${user.id}`); } catch {}
    }
    setStatus("new_user");
  }, [user]);

  return { status, isNewUser: status === "new_user", completeOnboarding, resetOnboarding };
}

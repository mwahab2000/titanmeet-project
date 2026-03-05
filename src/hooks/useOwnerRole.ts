import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Cached owner-role check hook.
 * Queries user_roles once per user session and caches the result.
 * Owner is the highest privilege level — required for billing overrides.
 */
const cache = new Map<string, boolean>();

export function useOwnerRole() {
  const { user, loading: authLoading } = useAuth();
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setIsOwner(false);
      setLoading(false);
      return;
    }

    if (cache.has(user.id)) {
      setIsOwner(cache.get(user.id)!);
      setLoading(false);
      return;
    }

    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "owner")
      .maybeSingle()
      .then(({ data }) => {
        const result = !!data;
        cache.set(user.id, result);
        setIsOwner(result);
        setLoading(false);
      });
  }, [user, authLoading]);

  return { isOwner, loading: loading || authLoading };
}

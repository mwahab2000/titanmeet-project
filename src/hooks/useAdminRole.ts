import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Cached admin-role check hook.
 * Queries user_roles once per user session and caches the result.
 */
const cache = new Map<string, boolean>();

export function useAdminRole() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    if (cache.has(user.id)) {
      setIsAdmin(cache.get(user.id)!);
      setLoading(false);
      return;
    }

    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => {
        const result = !!data;
        cache.set(user.id, result);
        setIsAdmin(result);
        setLoading(false);
      });
  }, [user, authLoading]);

  return { isAdmin, loading: loading || authLoading };
}

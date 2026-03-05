import { useAuth } from "@/contexts/AuthContext";
import { useAdminRole } from "@/hooks/useAdminRole";
import { Navigate } from "react-router-dom";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

export const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useAdminRole();
  const toastShown = useRef(false);

  useEffect(() => {
    if (!authLoading && !roleLoading && user && !isAdmin && !toastShown.current) {
      toastShown.current = true;
      toast.error("You don't have access to admin pages.");
    }
  }, [authLoading, roleLoading, user, isAdmin]);

  if (authLoading || roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};
